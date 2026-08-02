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
import { getCurrentWeekIdString } from '@/lib/vault-utils'

type AdminDb = NonNullable<ReturnType<typeof import('@/firebase-config').getAdminDb>>
type AdminFs = NonNullable<ReturnType<typeof import('@/firebase-config').getAdminFirestore>>

// The prize table lives in `lib/constants/seasonRewards.ts` and is re-exported
// here so every existing importer of this module keeps working.
//
// It moved out because the LEADERBOARD needs it too — the owner asked for the
// prize to be shown on the board players are competing on — and a client
// component cannot import this file without dragging firebase-admin along.
// Copying the numbers across would have made a second source of truth for a
// figure that is a promise of real money.
//
// ── THIS NUMBER IS A PROMISE, AND IT HAD ALREADY DRIFTED ────────────────────
//
// `docs/TREASURY-OPS.md` records rank rewards actually set on-chain to $1 /
// $0.60 / $0.40 on 2026-07-22, while this file said $20/$5/$3 — and
// `setRankRewards` is what `claimSeasonBonus` pays from. So `/stats` and the
// frozen snapshot were promising a first-place finisher twenty dollars the
// contract would have paid one for. Nothing caught it because nothing could: a
// mirror of on-chain state that is never compared to the chain is just a
// second, quieter source of truth — rule 2 in GAME-DESIGN.md §10, one layer out.
//
// `payoutCommands()` now emits the `season-rewards` line that sets these exact
// figures on-chain as the FIRST command of the payout, so running the commands
// in order makes the chain agree with this file by construction.
export {
  RANK_REWARDS_USD, PAID_RANKS, ONCHAIN_RANKS, SEASON_PAYOUT_TOKEN, SEASON_POOL_USD,
} from '@/lib/constants/seasonRewards'
import {
  RANK_REWARDS_USD, PAID_RANKS, ONCHAIN_RANKS, SEASON_PAYOUT_TOKEN,
} from '@/lib/constants/seasonRewards'

export interface SeasonWinner {
  /** 1-based position. 1..PAID_RANKS. */
  rank: number
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
 * `limit` OVERSHOOTS the number of places actually paid, so a malformed or
 * missing wallet address in the top rows cannot leave the snapshot one winner
 * short. The default is double PAID_RANKS: every row that fails the address
 * check below is a paid place that would otherwise go unfilled, and reading
 * twenty documents costs nothing.
 */
export async function readTopByXp(fs: AdminFs, limit = PAID_RANKS * 2): Promise<Array<{ wallet: string; username: string; xp: number }>> {
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
  return rows.slice(0, PAID_RANKS).map((r, i) => ({
    rank: i + 1,
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
  const rows = await readTopByXp(fs)
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
/**
 * Delete finished daily/weekly buckets.
 *
 * These are keyed by day or week, so the reset works precisely BECAUSE the key
 * changes — yesterday's bucket is already inert. Nothing read it, and nothing
 * deleted it either: at a thousand daily players that is roughly 36 MB a year
 * of rows that exist only to be scrolled past in the Firebase console.
 *
 * WHAT IS NOT PRUNED, AND WHY IT WOULD BE A BUG TO ADD IT. `/api/stats` counts
 * LIFETIME totals out of `paperClaims`, `goldenKeyClaims` and `vaultCompleted`
 * — every week, not just this one. Pruning those would silently shrink the
 * public stats page, and the drop would look like players leaving rather than
 * like rows being deleted. Only paths that nobody reads historically are listed
 * below, and each was checked against every reader in the repo.
 *
 * KEEP is generous on purpose: this exists to stop unbounded growth, not to
 * reclaim the last megabyte, and a too-eager prune during a timezone edge or a
 * clock skew would delete a bucket somebody is still writing to.
 */
export const PRUNE_KEEP_DAYS = 30
export const PRUNE_KEEP_WEEKS = 8

/**
 * How much burn history a player is shown, and how much is kept.
 *
 * OWNER: "masalah history burn yang menumpuk, lebih baik tunjukan burn 7 hari
 * terakhir, lalu hilangkan sisanya, dan jelaskan di bawahnya."
 *
 * He is right about both halves. A wallet that plays a season leaves hundreds of
 * burn rows behind, every one of them carrying its full item list — and the
 * Rewards screen rendered ALL of them, so the useful part (what did I burn
 * today?) sat above an unbounded wall of receipts, and `/api/player/profile`
 * shipped the whole pile over the wire to draw it.
 *
 * These rows are a LOG, not a ledger. The Point they paid was credited to
 * `playerProfiles/{wallet}/nullstateTokenBalance` at the moment of the burn and
 * has never been recomputed from here. So deleting an old row costs the player
 * nothing they can spend.
 *
 * What it WOULD cost, if this were done naively, is the two season totals the
 * Rewards screen shows above the list — both of which are derived by summing
 * this exact array. That is the same class of bug the note above warns about
 * for `paperClaims`: the number quietly shrinks, and it looks like the player
 * lost something rather than like rows being deleted. So nothing is simply
 * dropped — every pruned row is folded into `burnRollup/{seasonId}/{wallet}`
 * first, and the profile route adds that back before it reports a total.
 */
export const BURN_HISTORY_DAYS = 7

/** Paths keyed by `YYYY-MM-DD`, safe to drop once the day is long past. */
const DAILY_PRUNE = ['dailyContracts', 'dailyContractClaims', 'passPerkClaims']
/** Paths keyed by ISO `YYYYWW`. */
const WEEKLY_PRUNE = ['vaultFragments']

/** Is `key` a bucket old enough to delete? Exported for the test. */
export function isStaleDayKey(key: string, now: number, keepDays = PRUNE_KEEP_DAYS): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false      // never touch a shape we do not recognise
  const t = Date.parse(key + 'T00:00:00.000Z')
  if (!Number.isFinite(t)) return false
  return now - t > keepDays * 86400000
}

export function isStaleWeekKey(key: string, currentWeekId: string, keepWeeks = PRUNE_KEEP_WEEKS): boolean {
  if (!/^\d{6}$/.test(key) || !/^\d{6}$/.test(currentWeekId)) return false
  const year = Number(key.slice(0, 4)), week = Number(key.slice(4))
  const cy = Number(currentWeekId.slice(0, 4)), cw = Number(currentWeekId.slice(4))
  if (week < 1 || week > 53) return false
  // Weeks elapsed, treating a year as 52 — off by one at a year boundary in the
  // conservative direction (it keeps a week longer), which is the right way to
  // be wrong when the alternative is deleting live data.
  return (cy - year) * 52 + (cw - week) > keepWeeks
}

/** One burn row as `/api/burn/record` writes it — only the fields prune reads. */
interface BurnRow { recordedAt?: number; timestamp?: number; totalValue?: number; itemCount?: number }

/** When did this row happen? `recordedAt` is server-stamped; `timestamp` is not. */
function burnAt(row: BurnRow | null | undefined): number {
  const r = row?.recordedAt
  if (typeof r === 'number' && Number.isFinite(r)) return r
  const t = row?.timestamp
  return typeof t === 'number' && Number.isFinite(t) ? t : 0
}

/**
 * Is this burn row old enough to fold into the rollup and delete?
 *
 * A row with no usable timestamp returns FALSE and is kept. That direction is
 * deliberate: a row we cannot date is a row we cannot prove is stale, and the
 * cost of keeping one is a line on a screen, while the cost of deleting one is
 * a receipt the player can never get back.
 */
export function isStaleBurn(row: unknown, now: number, keepDays = BURN_HISTORY_DAYS): boolean {
  const at = burnAt(row as BurnRow)
  if (at <= 0) return false
  return now - at > keepDays * 86400000
}

/**
 * Fold every burn row older than BURN_HISTORY_DAYS into a per-wallet aggregate,
 * then delete it.
 *
 * The aggregate is additive and is the ONLY thing that must survive: the profile
 * route reads it and adds the live rows on top, so `totalBurnEvents` and
 * `totalBurnedValue` are exactly what they were before the prune ran. Written
 * with a transaction because this is a running total and a lost update here is
 * a permanently wrong number, not a retryable one.
 *
 * Rows are deleted only AFTER the rollup commits. Crashing between the two
 * double-counts nothing — the rollup moved, the rows are still there, and the
 * next run finds them again and folds a second time. That IS a real risk, so
 * `prunedThrough` records the newest timestamp already folded and rows at or
 * below it are skipped on a later pass.
 */
async function pruneBurnRecords(db: AdminDb, now: number, removed: string[]): Promise<void> {
  const root = await db.ref('burnRecords').get()
  if (!root.exists()) return
  const seasons = (root.val() || {}) as Record<string, Record<string, Record<string, BurnRow>>>

  for (const seasonId of Object.keys(seasons)) {
    for (const wallet of Object.keys(seasons[seasonId] || {})) {
      const rows = seasons[seasonId][wallet] || {}
      const rollupRef = db.ref(`burnRollup/${seasonId}/${wallet}`)
      const already = ((await rollupRef.get()).val() || {}) as { prunedThrough?: number }
      const floor = typeof already.prunedThrough === 'number' ? already.prunedThrough : 0

      const doomed = Object.keys(rows).filter((id) => isStaleBurn(rows[id], now) && burnAt(rows[id]) > floor)
      if (!doomed.length) continue

      let events = 0, value = 0, items = 0, newest = floor
      for (const id of doomed) {
        const row = rows[id]
        events += 1
        value += typeof row?.totalValue === 'number' && Number.isFinite(row.totalValue) ? row.totalValue : 0
        items += typeof row?.itemCount === 'number' && Number.isFinite(row.itemCount) ? row.itemCount : 0
        newest = Math.max(newest, burnAt(row))
      }

      await rollupRef.transaction((cur: unknown) => {
        const c = (cur || {}) as { events?: number; value?: number; items?: number; prunedThrough?: number }
        const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
        return {
          events: n(c.events) + events,
          value: n(c.value) + value,
          items: n(c.items) + items,
          prunedThrough: Math.max(n(c.prunedThrough), newest),
        }
      })

      for (const id of doomed) await db.ref(`burnRecords/${seasonId}/${wallet}/${id}`).remove()
      removed.push(`burnRecords/${seasonId}/${wallet} (${doomed.length})`)
    }
  }
}

export async function prune(
  db: AdminDb,
  now = Date.now(),
  currentWeekId = getCurrentWeekIdString(),
): Promise<{ removed: string[] }> {
  const removed: string[] = []
  for (const root of DAILY_PRUNE) {
    const snap = await db.ref(root).get()
    if (!snap.exists()) continue
    for (const key of Object.keys(snap.val() || {})) {
      if (!isStaleDayKey(key, now)) continue
      await db.ref(`${root}/${key}`).remove()
      removed.push(`${root}/${key}`)
    }
  }
  for (const root of WEEKLY_PRUNE) {
    const snap = await db.ref(root).get()
    if (!snap.exists()) continue
    for (const key of Object.keys(snap.val() || {})) {
      if (!isStaleWeekKey(key, currentWeekId)) continue
      await db.ref(`${root}/${key}`).remove()
      removed.push(`${root}/${key}`)
    }
  }
  await pruneBurnRecords(db, now, removed)
  return { removed }
}

/**
 * The exact lines the owner runs, split the way the contract forces them to be.
 *
 * RANKS 1-3 go through `NullStateRewardV3`: publish the podium, fund the pool,
 * and the winners claim in-app. RANKS 4-10 **cannot** — `updateLeaderboard`
 * takes `address[3]` and there is no fourth slot to put anyone in. They are
 * paid by direct ERC-20 transfer, one line each, through the `pay` subcommand.
 *
 * Emitting the podium commands alone would have been the dangerous version:
 * they look complete, they succeed, and seven people are silently paid nothing.
 * So the direct sends are part of the same list, and the fund amount covers
 * only the three the pool actually pays.
 */
export function payoutCommands(snapshot: SeasonSnapshot): string[] {
  const w = snapshot.winners
  // The contract needs exactly three addresses. Fewer than three ranked players
  // is not a payout that can be prepared, on-chain or off.
  if (w.length < ONCHAIN_RANKS) return []
  const onchain = w.slice(0, ONCHAIN_RANKS)
  const direct = w.slice(ONCHAIN_RANKS)
  // Only what the POOL pays. Funding it with the whole $35 would leave the
  // seven tail prizes sitting in a contract that has no way to release them.
  const total = onchain.reduce((s, x) => s + x.rewardUsd, 0)
  return [
    // FIRST, and the reason it exists: this is what makes the contract agree
    // with RANK_REWARDS_USD. `setRankRewards` is global rather than per-season,
    // so re-sending unchanged figures is a cheap no-op — and the one time it is
    // NOT a no-op is the time it would otherwise have paid the wrong amount.
    // See the note on RANK_REWARDS_USD for the drift this closes.
    `node scripts/deposit-reward.js season-rewards --token ${SEASON_PAYOUT_TOKEN}`
      + ` --r1 ${RANK_REWARDS_USD[0]} --r2 ${RANK_REWARDS_USD[1]} --r3 ${RANK_REWARDS_USD[2]}`,
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
    // Ranks 4-10. One transfer each, because the contract has nowhere to put
    // them. Ordered by rank so the list reads like the leaderboard it came from.
    ...direct.map((x) =>
      `node scripts/deposit-reward.js pay --token ${SEASON_PAYOUT_TOKEN}`
      + ` --to ${x.wallet} --amount ${x.rewardUsd}   # rank ${x.rank}`),
  ]
}
