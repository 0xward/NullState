// Season close — computing the top 3 so paying them is a copy-paste.
//
// GAME-DESIGN.md §9. Two of that section's three problems meet here.
//
// PROBLEM 1: TWO LEADERBOARDS THAT DISAGREE. Players saw the Firestore
// `leaderboard` collection sorted by XP (`Leaderboard.tsx`). Payment used a
// different ranking entirely — RTDB `leaderboards/{seasonId}` plus the on-chain
// `getSeasonLeaderboard` — surfaced by `LeaderboardDisplay.tsx`, which was
// rendered nowhere. So the ranking players competed on was not the ranking that
// paid, and nothing in the code said which was meant to win.
//
// OWNER DECISION: **XP is canonical.** It is what players already see, it is
// cumulative and accurate, and the alternative is built on a number that cannot
// be right — the on-chain `kills` counter takes a boolean per `executeAction`,
// so a 40-kill run increments it by one (`leaderboardService.ts` has said so in
// a comment for a long time). This module is therefore the ONE place a season
// ranking comes from, and it reads XP.
//
// PROBLEM 2: THE PAYOUT IS ENTIRELY MANUAL. Paying the season bonus means the
// owner running `scripts/deposit-reward.js update-leaderboard` and then
// `season-deposit`, from memory, every month. Miss it and the claim button is
// dead for every player, with no error anywhere to notice.
//
// OWNER DECISION: **prepare automatically, the owner still signs.** Money keeps
// a human in the loop — no unattended transfer, and no signer key on the server
// (the repo is public and the deployer key stays on the owner's device). What
// is automated is everything up to the signature: the season is detected as
// closed, the top 3 is computed and frozen, and the state is visible so a
// forgotten payout looks obviously wrong instead of silently doing nothing.
//
// WHY THE SNAPSHOT IS FROZEN. XP keeps moving after a season ends — players
// carry it across seasons (§9: level, XP and kills are cumulative and do not
// reset). Reading "the top 3" at payout time would therefore give a different
// answer than at closing time, and the later it is read the more wrong it is.
// The snapshot is written once, first-writer-wins, and never rewritten.

import { getCurrentSeasonId } from '@/lib/web3-client'

type AdminDb = NonNullable<ReturnType<typeof import('@/firebase-config').getAdminDb>>
type AdminFs = NonNullable<ReturnType<typeof import('@/firebase-config').getAdminFirestore>>

/** What the top 3 are paid, in whole dollars. Mirrors the on-chain rank rewards. */
export const RANK_REWARDS_USD = [20, 5, 3] as const

/**
 * Which token funds the season pool.
 *
 * USDT, per OWNER-RUNBOOK.md's monthly commands and rewards-system.md ("all
 * game rewards pay out in USDT"). GAME-DESIGN.md §3 said USDm, which was stale
 * and is corrected — two of the three docs agreed and the runbook is the one
 * that actually gets executed.
 */
export const SEASON_PAYOUT_TOKEN = 'USDT'

export interface SeasonWinner {
  rank: 1 | 2 | 3
  wallet: string
  username: string
  xp: number
  rewardUsd: number
}

export interface SeasonSnapshot {
  seasonId: number
  winners: SeasonWinner[]
  /** When the ranking was frozen. */
  preparedAt: number
  /** Set by the owner once the on-chain publish + deposit is done. */
  paidAt: number | null
  /** Free-text note the owner can attach when marking it paid (a tx hash). */
  paidNote?: string
}

export interface SeasonStatus {
  /** The season currently being played. */
  currentSeasonId: number
  /** The most recent season that has ENDED — the one that can be paid. */
  lastClosedSeasonId: number
  snapshot: SeasonSnapshot | null
  /** True when the closed season has been frozen but not yet paid out. */
  awaitingPayout: boolean
}

/** The season before `seasonId`, in the same YYYYMM shape. */
export function previousSeasonId(seasonId: number): number {
  const year = Math.floor(seasonId / 100)
  const month = seasonId % 100
  return month <= 1 ? (year - 1) * 100 + 12 : year * 100 + (month - 1)
}

function snapshotRef(db: AdminDb, seasonId: number) {
  return db.ref(`seasonSnapshots/${seasonId}`)
}

/**
 * Read the top players by XP straight out of the collection the player-facing
 * leaderboard is built from, so the two can never disagree.
 *
 * `limit` overshoots the three that are paid, so a malformed or missing wallet
 * address in the top rows cannot leave the snapshot with two winners.
 */
export async function readTopByXp(fs: AdminFs, limit = 10): Promise<Array<{ wallet: string; username: string; xp: number }>> {
  const snap = await fs.collection('leaderboard').orderBy('xp', 'desc').limit(limit).get()
  return snap.docs.map((d) => {
    const v = d.data() as Record<string, unknown>
    return {
      wallet: String(v.walletAddress || d.id || '').toLowerCase(),
      username: String(v.username || ''),
      xp: typeof v.xp === 'number' && Number.isFinite(v.xp) ? Math.max(0, Math.floor(v.xp)) : 0,
    }
  }).filter((e) => /^0x[a-f0-9]{40}$/.test(e.wallet))
}

export function toWinners(rows: Array<{ wallet: string; username: string; xp: number }>): SeasonWinner[] {
  return rows.slice(0, 3).map((r, i) => ({
    rank: (i + 1) as 1 | 2 | 3,
    wallet: r.wallet,
    username: r.username,
    xp: r.xp,
    rewardUsd: RANK_REWARDS_USD[i] ?? 0,
  }))
}

/** Read-only status. Never writes, so any screen can poll it. */
export async function readSeasonStatus(db: AdminDb, now = Date.now()): Promise<SeasonStatus> {
  const currentSeasonId = getCurrentSeasonId(new Date(now))
  const lastClosedSeasonId = previousSeasonId(currentSeasonId)
  const snap = await snapshotRef(db, lastClosedSeasonId).get()
  const snapshot = snap.exists() ? (snap.val() as SeasonSnapshot) : null
  return {
    currentSeasonId,
    lastClosedSeasonId,
    snapshot,
    awaitingPayout: !!snapshot && !snapshot.paidAt,
  }
}

/**
 * Freeze the ranking for a season that has ended.
 *
 * Idempotent and safe to call repeatedly, which matters because the cron may
 * fire more than once and because the owner may hit it by hand: the write is a
 * transaction that ABORTS if a snapshot already exists, so the first one ever
 * taken is the one that stands. A cron re-run therefore cannot quietly
 * re-rank the winners after the owner has already read them.
 */
export async function prepareSeason(
  db: AdminDb,
  fs: AdminFs,
  seasonId: number,
): Promise<{ snapshot: SeasonSnapshot; created: boolean }> {
  const existing = await snapshotRef(db, seasonId).get()
  if (existing.exists()) return { snapshot: existing.val() as SeasonSnapshot, created: false }

  // No wallet is filtered out here, deliberately. The owner reviews this list
  // before signing anything — that review IS the safeguard, and it is the whole
  // reason the payout stayed manual. A server-side exclusion list would be a
  // second, invisible policy that nobody reads until it pays the wrong person.
  const rows = await readTopByXp(fs, 10)
  const snapshot: SeasonSnapshot = {
    seasonId,
    winners: toWinners(rows),
    preparedAt: Date.now(),
    paidAt: null,
  }

  const tx = await snapshotRef(db, seasonId).transaction((cur: unknown) => {
    if (cur !== null) return undefined      // someone got here first — keep theirs
    return snapshot
  })
  if (!tx.committed) {
    const again = await snapshotRef(db, seasonId).get()
    return { snapshot: again.val() as SeasonSnapshot, created: false }
  }
  return { snapshot, created: true }
}

/**
 * The owner marking a season paid, after signing the on-chain publish and
 * deposit themselves. Only ever sets the flag — it cannot move money and it
 * cannot change who won.
 */
export async function markSeasonPaid(db: AdminDb, seasonId: number, note?: string): Promise<SeasonSnapshot | null> {
  const ref = snapshotRef(db, seasonId)
  const snap = await ref.get()
  if (!snap.exists()) return null
  const cur = snap.val() as SeasonSnapshot
  if (cur.paidAt) return cur                 // already marked — keep the first time
  const paidAt = Date.now()
  await ref.update(note ? { paidAt, paidNote: note } : { paidAt })
  return { ...cur, paidAt, ...(note ? { paidNote: note } : {}) }
}

/**
 * The exact commands the owner runs next, built from the frozen snapshot.
 *
 * The whole point of preparing automatically is that paying should not require
 * a judgement call at 1am on the first of the month — so this hands over lines
 * to paste rather than a table to interpret.
 *
 * The flags mirror `scripts/deposit-reward.js` exactly (`--p1..--p3` for the
 * addresses, `--s1..--s3` for the scores). A command that does not run is worse
 * than no command, so if that CLI ever changes its flags this must change with
 * it — `npm run test:season` compares these strings against the script's own
 * argument parsing.
 */
export function payoutCommands(snapshot: SeasonSnapshot): string[] {
  const w = snapshot.winners
  if (w.length < 3) return []
  const total = w.reduce((s, x) => s + x.rewardUsd, 0)
  return [
    `node scripts/deposit-reward.js update-leaderboard --season ${snapshot.seasonId}`
      + ` --p1 ${w[0].wallet} --p2 ${w[1].wallet} --p3 ${w[2].wallet}`
      + ` --s1 ${w[0].xp} --s2 ${w[1].xp} --s3 ${w[2].xp}`,
    // --token is NOT optional: resolveToken() in that script dies with
    // "missing --token" when it is absent, so the first version of this line
    // handed the owner a command that failed on paste — the exact thing the
    // comment above swears this must never do. USDT because that is what
    // OWNER-RUNBOOK.md and rewards-system.md both specify for season bonuses.
    `node scripts/deposit-reward.js season-deposit --season ${snapshot.seasonId}`
      + ` --token ${SEASON_PAYOUT_TOKEN} --amount ${total}`,
  ]
}
