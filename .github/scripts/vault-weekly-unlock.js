const ethers = require('ethers');
const admin = require('firebase-admin');

const VAULT_ABI = [
  "function unlockVaultForNewWeek(address user, uint256 newWeekId) external"
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

async function fetchUsersFromFirebase() {
  try {
    if (!admin.apps.length) {
      console.log('⚠️  Firebase not configured');
      return [];
    }

    const db = admin.database();
    const snapshot = await db.ref('playerProfiles').get();
    
    if (!snapshot.exists()) {
      return [];
    }

    const players = snapshot.val();
    return Object.keys(players).map(key => players[key].walletAddress).filter(Boolean);
  } catch (error) {
    console.log(`⚠️  Firebase error: ${error.message}`);
    return [];
  }
}

async function unlockVault() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🔓 WEEKLY VAULT UNLOCK STARTED');
    console.log('='.repeat(60) + '\n');

    const newWeekId = getISOWeek(new Date());
    console.log(`📅 New Week ID: ${newWeekId}\n`);

    // Fetch users from Firebase
    console.log('👥 Fetching users from Firebase...');
    const users = await fetchUsersFromFirebase();
    console.log(`✅ Found ${users.length} users\n`);

    if (users.length === 0) {
      console.log('ℹ️  No users to unlock, skipping batch operation\n');
      console.log('='.repeat(60) + '\n');
      return;
    }

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

    // Unlock users (limit to 10 per batch to avoid gas limits)
    const batchSize = 10;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      console.log(`🚀 Unlocking batch ${Math.floor(i / batchSize) + 1} (${batch.length} users)...`);

      for (const user of batch) {
        try {
          console.log(`   🔓 ${user}...`);
          const tx = await contract.unlockVaultForNewWeek(user, newWeekId, {
            gasPrice: ethers.parseUnits('5', 'gwei'),
            gasLimit: 100000
          });

          await tx.wait(1);
          console.log(`      ✅ ${tx.hash}`);
          successCount++;
        } catch (userError) {
          console.log(`      ⚠️  Failed: ${userError.message.slice(0, 50)}...`);
          failCount++;
        }
      }
    }

    console.log(`\n📊 Unlock summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}\n`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

unlockVault();
