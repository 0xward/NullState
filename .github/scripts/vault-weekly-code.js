const ethers = require('ethers');
const admin = require('firebase-admin');

const VAULT_ABI = [
  "function storeWeeklyVaultCode(uint256 weekId, string calldata code) external"
];

// Initialize Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (Object.keys(serviceAccount).length > 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() * 100 + week;
}

function getCurrentSeasonId() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return parseInt(`${year}${month}`);
}

async function storeWeeklyCode() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🎰 WEEKLY VAULT CODE GENERATION STARTED');
    console.log('='.repeat(60) + '\n');

    // Generate random 4-digit code
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const weekId = getISOWeek(new Date());
    const seasonId = getCurrentSeasonId();

    console.log(`📅 Week ID: ${weekId}`);
    console.log(`🎭 Season ID: ${seasonId}`);
    console.log(`🎰 Generated code: ${code}\n`);

    // Setup wallet and contract
    const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC_URL);
    const wallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(
      process.env.TREASURE_VAULT_ADDRESS,
      VAULT_ABI,
      wallet
    );

    console.log(`🔑 Backend wallet: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} CELO\n`);

    // Store code on-chain
    console.log('🚀 Storing weekly code on-chain...');
    const tx = await contract.storeWeeklyVaultCode(weekId, code, {
      gasPrice: ethers.parseUnits('5', 'gwei'),
      gasLimit: 300000
    });

    console.log(`📝 Transaction hash: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...\n');

    const receipt = await tx.wait(1);
    console.log(`✅ Weekly code stored successfully!`);
    console.log(`📦 Block: ${receipt.blockNumber}`);
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}\n`);

    // Store in Firebase if configured
    if (admin.apps.length > 0) {
      try {
        const db = admin.database();
        await db.ref(`vaultCodes/${seasonId}/${weekId}`).set({
          code: code,
          setAt: Date.now(),
          validUntil: Date.now() + 7 * 24 * 60 * 60 * 1000
        });
        console.log(`📱 Code also stored in Firebase`);
      } catch (fbError) {
        console.log(`⚠️  Firebase storage failed: ${fbError.message}`);
      }
    }

    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

storeWeeklyCode();
