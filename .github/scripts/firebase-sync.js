/**
 * firebase-sync.js
 *
 * Syncs on-chain leaderboard data from the NullStateReward contract
 * into Firebase Realtime Database so the weekly cron job has fresh
 * scores to push back on-chain via updateLeaderboard().
 *
 * This script is run on a schedule by .github/workflows/firebase-sync.yml.
 *
 * Required GitHub Secrets:
 *   CELO_RPC_URL              — e.g. https://forno.celo.org
 *   REWARD_CONTRACT_ADDRESS   — NullStateReward deployed address
 *   FIREBASE_SERVICE_ACCOUNT  — JSON of Firebase service account key
 *   FIREBASE_DATABASE_URL     — Realtime Database URL
 */

const ethers = require('ethers');
const admin = require('firebase-admin');

// ─── Firebase init ────────────────────────────────────────────────────────────

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (Object.keys(serviceAccount).length > 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL ||
      'https://nullstate-35b2e-default-rtdb.firebaseio.com',
  });
}

// ─── Contract ABI (read-only subset) ─────────────────────────────────────────

const REWARD_ABI = [
  'function getSeasonLeaderboard(uint256 _seasonId) view returns (tuple(uint256 seasonId, address[3] topPlayers, uint256[3] topScores, address rewardToken, uint256 totalDeposited, bool deposited, bool finalized, uint256 updatedAt))',
  'function getUserWeeklyBurn(address _user, uint256 _week) view returns (uint256)',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Main sync ────────────────────────────────────────────────────────────────

async function syncToFirebase() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 FIREBASE SYNC STARTED');
  console.log('='.repeat(60) + '\n');

  const seasonId = getCurrentSeasonId();
  const weekId = getISOWeek(new Date());

  console.log(`📅 Season: ${seasonId}  |  Week: ${weekId}\n`);

  // ── Read from chain ──────────────────────────────────────────────────────────
  const provider = new ethers.JsonRpcProvider(
    process.env.CELO_RPC_URL || 'https://forno.celo.org'
  );
  const contract = new ethers.Contract(
    process.env.REWARD_CONTRACT_ADDRESS,
    REWARD_ABI,
    provider
  );

  let leaderboard;
  try {
    leaderboard = await contract.getSeasonLeaderboard(seasonId);
    console.log('✅ Leaderboard fetched from chain');
  } catch (err) {
    console.log(`⚠️  Could not read leaderboard: ${err.message}`);
    leaderboard = null;
  }

  // ── Write to Firebase ────────────────────────────────────────────────────────
  if (!admin.apps.length) {
    console.log('⚠️  Firebase not configured — skipping write');
    return;
  }

  const db = admin.database();

  // Sync leaderboard snapshot
  if (leaderboard) {
    const lbData = {
      seasonId: Number(leaderboard.seasonId),
      rank1: {
        walletAddress: leaderboard.topPlayers[0],
        seasonScore: Number(leaderboard.topScores[0]),
      },
      rank2: {
        walletAddress: leaderboard.topPlayers[1],
        seasonScore: Number(leaderboard.topScores[1]),
      },
      rank3: {
        walletAddress: leaderboard.topPlayers[2],
        seasonScore: Number(leaderboard.topScores[2]),
      },
      deposited: leaderboard.deposited,
      finalized: leaderboard.finalized,
      updatedAt: Number(leaderboard.updatedAt),
      syncedAt: Date.now(),
    };

    await db.ref(`leaderboards/${seasonId}`).set(lbData);
    console.log(`✅ Leaderboard synced → leaderboards/${seasonId}`);
  }

  // Write metadata
  await db.ref('meta/lastSync').set({
    seasonId,
    weekId,
    timestamp: Date.now(),
  });

  console.log('\n✅ Firebase sync complete');
  console.log('='.repeat(60) + '\n');
}

syncToFirebase().catch((err) => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});
