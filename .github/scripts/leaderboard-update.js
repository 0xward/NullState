const ethers = require('ethers');

const REWARD_ABI = [
  "function updateLeaderboard(uint256 seasonId, address[3] topPlayers, uint256[3] topScores) external"
];

async function updateLeaderboard() {
  const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC_URL);
  const wallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(
    process.env.REWARD_CONTRACT_ADDRESS,
    REWARD_ABI,
    wallet
  );

  console.log('📊 Fetching leaderboard data...');
  
  // TODO: Fetch from Firebase
  // For now, placeholder data
  const topPlayers = [
    '0x1111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222',
    '0x3333333333333333333333333333333333333333'
  ];
  const topScores = [95, 85, 75];
  const seasonId = 202607;

  console.log('🚀 Calling updateLeaderboard...');
  const tx = await contract.updateLeaderboard(seasonId, topPlayers, topScores, {
    gasPrice: ethers.parseUnits('5', 'gwei')
  });

  console.log(`✅ Transaction: ${tx.hash}`);
  await tx.wait(1);
  console.log('✅ Leaderboard updated!');
}

updateLeaderboard().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
