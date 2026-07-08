const ethers = require('ethers');

const VAULT_ABI = [
  "function unlockVaultForNewWeek(address user, uint256 newWeekId) external"
];

async function unlockVaultForNewWeek() {
  const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC_URL);
  const wallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(
    process.env.TREASURE_VAULT_ADDRESS,
    VAULT_ABI,
    wallet
  );

  // Get new week ID
  const now = new Date();
  const year = now.getUTCFullYear();
  const week = Math.ceil((now.getUTCDate() - now.getUTCDay() + 1) / 7);
  const newWeekId = year * 100 + week;

  console.log(`📅 Unlocking for new week: ${newWeekId}`);

  // TODO: Fetch all users from Firebase
  // For now, placeholder
  const users = [
    '0x1111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222'
  ];

  for (const user of users) {
    console.log(`🔓 Unlocking ${user}...`);
    const tx = await contract.unlockVaultForNewWeek(user, newWeekId, {
      gasPrice: ethers.parseUnits('5', 'gwei')
    });
    console.log(`✅ Transaction: ${tx.hash}`);
    await tx.wait(1);
  }

  console.log('✅ All users unlocked for new week!');
}

unlockVaultForNewWeek().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
