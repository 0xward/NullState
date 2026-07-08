const ethers = require('ethers');

const VAULT_ABI = [
  "function storeWeeklyVaultCode(uint256 weekId, string calldata code) external"
];

async function generateWeeklyCode() {
  const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC_URL);
  const wallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(
    process.env.TREASURE_VAULT_ADDRESS,
    VAULT_ABI,
    wallet
  );

  // Generate random 4-digit code
  const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  
  // Get current week (YYYYWW format)
  const now = new Date();
  const year = now.getUTCFullYear();
  const week = Math.ceil((now.getUTCDate() - now.getUTCDay() + 1) / 7);
  const weekId = year * 100 + week;

  console.log(`🎰 Generated code: ${code}`);
  console.log(`📅 Week ID: ${weekId}`);

  console.log('🚀 Storing weekly code...');
  const tx = await contract.storeWeeklyVaultCode(weekId, code, {
    gasPrice: ethers.parseUnits('5', 'gwei')
  });

  console.log(`✅ Transaction: ${tx.hash}`);
  await tx.wait(1);
  console.log('✅ Weekly code stored!');
}

generateWeeklyCode().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
