import {
  doc,
  setDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  runTransaction,
} from 'firebase/firestore'
import { db } from './firebase'
import { LeaderboardEntry } from './contract'

interface LeaderboardDoc {
  walletAddress: string
  username: string
  xp: number
  level: number
  // Real cumulative kill total, tracked entirely off-chain (see
  // recordRunKills below). NOT the same as the on-chain `kills` counter:
  // the NullState contract's executeAction() only takes a boolean
  // `enemyKilled` flag, so it can only ever increment on-chain kills by 0
  // or 1 per death — a run where the player killed 40 enemies before dying
  // still only adds +1 on-chain. totalKills is the accurate figure and is
  // what the Leaderboard/Settings "kills" stat should read from.
  totalKills?: number
  // Legacy field from before totalKills existed; kept only so old docs
  // still render something until their next death re-syncs totalKills.
  kills?: number
  // The run-kills value (game.js's `p.kills`, the live per-life counter)
  // that was last folded into totalKills. Needed because p.kills is NOT
  // reset between deaths within the same continuous play session (a
  // Revive keeps counting from where it left off) — see recordRunKills.
  lastRecordedKills?: number
  updatedAt: number
}

/**
 * Snapshot a player's username/xp/level into Firestore so the leaderboard
 * stays fresh without ever needing to scan chain logs. Deliberately does
 * NOT touch totalKills/kills — see recordRunKills for how the kill stat is
 * maintained; overwriting it here would clobber the accumulated total with
 * the (much smaller, capped) on-chain figure every time a profile is read.
 */
export async function updateLeaderboardEntry(
  walletAddress: string,
  username: string,
  xp: number,
  level: number
): Promise<void> {
  try {
    const normalizedAddr = walletAddress.toLowerCase()
    const record = {
      walletAddress: normalizedAddr,
      username,
      xp,
      level,
      updatedAt: Date.now(),
    }
    await setDoc(doc(db, 'leaderboard', normalizedAddr), record, { merge: true })
  } catch (err) {
    // Never let leaderboard sync failures break gameplay
    console.error('[leaderboard] Failed to update entry:', err)
  }
}

/**
 * Fold this life's kills into the wallet's lifetime totalKills stat.
 * Call this once per death event, passing the RAW p.kills value from the
 * game engine at that moment (the full "SOULS PURGED" figure shown on the
 * death screen), not the on-chain boolean.
 *
 * Because a Revive keeps the run's p.kills counter going instead of
 * resetting it to 0, the same continuous life can dispatch several death
 * events whose `rawKillsThisLife` keeps growing (e.g. 12, then 12+9=21).
 * Naively adding each event's raw value would double-count. Instead we
 * track the raw value we last folded in (`lastRecordedKills`) and only add
 * the delta:
 *   - Same life, kept playing after a Revive: rawKills(21) >= last(12)
 *     -> add the 9 new kills.
 *   - A genuinely new life started (rawKills resets to a smaller number,
 *     e.g. p.kills starts back at 0/low after a fresh run): rawKills(5) <
 *     last(21) -> treat the drop as "a new life started", add all 5 rather
 *     than a negative/zero delta.
 * A Firestore transaction is used so two rapid death events (e.g. a flaky
 * connection retry) can't race and lose an update.
 */
export async function recordRunKills(
  walletAddress: string,
  rawKillsThisLife: number
): Promise<void> {
  if (!Number.isFinite(rawKillsThisLife) || rawKillsThisLife <= 0) return
  try {
    const normalizedAddr = walletAddress.toLowerCase()
    const ref = doc(db, 'leaderboard', normalizedAddr)
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      const data = (snap.exists() ? snap.data() : {}) as Partial<LeaderboardDoc>
      const prevTotal = data.totalKills ?? data.kills ?? 0
      const lastRecorded = data.lastRecordedKills ?? 0
      const delta =
        rawKillsThisLife >= lastRecorded
          ? rawKillsThisLife - lastRecorded
          : rawKillsThisLife // a fresh life started; count it in full
      tx.set(
        ref,
        {
          totalKills: prevTotal + delta,
          lastRecordedKills: rawKillsThisLife,
          updatedAt: Date.now(),
        },
        { merge: true }
      )
    })
  } catch (err) {
    console.error('[leaderboard] Failed to record run kills:', err)
  }
}

/**
 * Fetch the top N players by XP directly from Firestore.
 * Replaces the old on-chain event-log scanning approach.
 */
export async function getLeaderboard(topN: number = 100): Promise<LeaderboardEntry[]> {
  try {
    const q = query(
      collection(db, 'leaderboard'),
      orderBy('xp', 'desc'),
      limit(topN)
    )
    const snap = await getDocs(q)

    const entries: LeaderboardEntry[] = snap.docs.map((d, index) => {
      const data = d.data() as LeaderboardDoc
      return {
        rank: index + 1,
        walletAddress: data.walletAddress,
        username: data.username,
        xp: data.xp,
        level: data.level,
        kills: data.totalKills ?? data.kills ?? 0,
      }
    })

    return entries
  } catch (err) {
    console.error('[leaderboard] Failed to fetch leaderboard:', err)
    return []
  }
}
