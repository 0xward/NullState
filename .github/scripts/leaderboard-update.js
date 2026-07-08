const ethers = require('ethers');
const admin = require('firebase-admin');

const REWARD_ABI = [
  "function updateLeaderboard(uint256 seasonId, address[3] calldata topPlayers, uint256[3] calldata topScores) external"
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

async function fetchLeaderboardFromFirebase(seasonId) {
  try {
    if (!admin.apps.length) {
      console.log('⚠️  Firebase not configured, using placeholder data');
      return {
        topPlayers: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
          '0x3333333333333333333333333333333333333333'
        ],
        topScores: [1000, 900, 800]
      };
    }

    const db = admin.database();
    const snapshot = await db.ref(`leaderboards/${seasonId}`).get();
    
    if (!snapshot.exists()) {
      console.log('⚠️  No leaderboard data in Firebase, using placeholder');
      return {
        topPlayers: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
          '0x3333333333333333333333333333333333333333'
        ],
        topScores: [1000, 900, 800]
      };
    }

    const data = snapshot.val();
    return {
      topPlayers: [
        data.rank1?.walletAddress || '0x1111111111111111111111111111111111111111',
        data.rank2?.walletAddress || '0x2222222222222222222222222222222222222222',
        data.rank3?.walletAddress || '0x3333333333333333333333333333333333333333'
      ],
      topScores: [
        Math.floor(data.rank1?.seasonScore || 1000),
        Math.floor(data.rank2?.seasonScore || 900),
        Math.floor(data.rank3?.seasonScore || 800)
      ]
    };
  } catch (error) {
    console.log('⚠️  Firebase error, using placeholder:', error.message);
    return {
      topPlayers: [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333'
      ],
      topScores: [1000, 900, 800]
    };
  }
}

async function updateLeaderboard() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('📊 LEADERBOARD UPDATE STARTED');
    console.log('='.repeat(60) + '\n');

    // Get current season (YYYYMM format)
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const seasonId = parseInt(`${year}${month}`);

    console.log(`📅 Season ID: ${seasonId}`);
    console.log(`⏰ Timestamp: ${now.toISOString()}\n`);

    // Fetch leaderboard data
    console.log('📖 Fetching leaderboard data from Firebase...');
    const leaderboardData = await fetchLeaderboardFromFirebase(seasonId);
    console.log(`🏆 Top 3 addresses:`);
    console.log(`   Rank 1: ${leaderboardData.topPlayers[0]} (Score: ${leaderboardData.topScores[0]})`);
    console.log(`   Rank 2: ${leaderboardData.topPlayers[1]} (Score: ${leaderboardData.topScores[1]})`);
    console.log(`   Rank 3: ${leaderboardData.topPlayers[2]} (Score: ${leaderboardData.topScores[2]})\n`);

    // Setup wallet and contract
    const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC_URL);
    const wallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(
      process.env.REWARD_CONTRACT_ADDRESS,
      REWARD_ABI,
      wallet
    );

    console.log(`🔑 Backend wallet: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} CELO\n`);

    // Call updateLeaderboard
    console.log('🚀 Calling updateLeaderboard...');
    const tx = await contract.updateLeaderboard(
      seasonId,
      leaderboardData.topPlayers,
      leaderboardData.topScores,
      {
        gasPrice: ethers.parseUnits('5', 'gwei'),
        gasLimit: 500000
      }
    );

    console.log(`📝 Transaction hash: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...\n');

    const receipt = await tx.wait(1);
    console.log(`✅ Leaderboard updated successfully!`);
    console.log(`📦 Block: ${receipt.blockNumber}`);
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}\n`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

updateLeaderboard();
