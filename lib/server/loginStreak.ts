// Login streak — the reason to open the app on a day you have no time to play.
//
// GAME-DESIGN.md §5.3, the last empty slot in layer 2. Daily Contracts answer
// "why play today"; they do not answer "why open this at all today", and those
// are different questions. A player with ten spare minutes plays. A player with
// one spare minute opens the app or does not — and if they do not, the habit is
// what breaks, not the session.
//
// Loss aversion is the strongest retention force available and it costs the
// operator nothing: seven escalating days, and breaking it drops you to day 1.
// Half of this already existed as the Season Pass daily claim (+1 energy, +3 t1
// shards per UTC day) — a login reward that was never framed as one, and only
// for pass holders. This is the version everyone gets.
//
// ── ON TRUST ────────────────────────────────────────────────────────────────
// Nothing here takes the client's word for anything. The day is the server's
// UTC day, the streak is derived from the stored last day rather than sent, and
// the grant is gated by a first-writer-wins transaction on the day itself — so
// a wallet hammering the endpoint gets exactly one grant per UTC day. Every
// currency it pays is off-chain and already exists. Nothing touches USDT.

import { getCurrentDayIdString, getNextUtcMidnightMs } from '@/lib/vault-utils'
import { normalizeRecord, toState, type EnergyRecord } from '@/lib/server/energy'

type AdminDb = NonNullable<ReturnType<typeof import('@/firebase-config').getAdminDb>>

export type StreakReward =
  | { kind: 'point'; amount: number }
  | { kind: 'shard'; tier: 't1' | 't2' | 't3'; amount: number }
  | { kind: 'energy'; amount: number }

// THE LADDER, AND WHY IT IS SHAPED LIKE THIS.
//
// Everything here is t1 shards, energy and NullState Point, on purpose.
// Shard TIER is gated by act — `_shardTierForAct()` in game.js drops t1 on acts
// 1-2, t2 on 3-4, t3 on act 5 — so paying a t2 shard would hand a new player a
// currency they cannot spend and did not earn. t1 is useful to everyone from
// the first bunker.
//
// Day 7 is 8 t1 shards because `EVOLUTION_SHARD_COSTS[0]` is 8: a full week is
// worth exactly ONE weapon evolution. That is the ratchet §4 asks for in so
// many words — "the weapon is tier 3, so next week is faster" — and it is a
// prize a player can name, which a scattering of shards is not.
//
// Sized against Daily Contracts (200-400 Point or 2-4 t1 for real work): a
// whole week of merely opening the app is worth roughly one day of playing it.
// That ordering is deliberate. Showing up should be rewarded; it should never
// out-earn showing up and playing.
export const STREAK_LADDER: StreakReward[] = [
  { kind: 'point', amount: 80 },              // day 1
  { kind: 'shard', tier: 't1', amount: 2 },   // day 2
  { kind: 'energy', amount: 1 },              // day 3
  { kind: 'shard', tier: 't1', amount: 3 },   // day 4
  { kind: 'point', amount: 150 },             // day 5
  { kind: 'shard', tier: 't1', amount: 4 },   // day 6
  { kind: 'shard', tier: 't1', amount: 8 },   // day 7 — one full evolution
]

export const STREAK_LENGTH = STREAK_LADDER.length

/** Where in the ladder a streak of `n` days sits (1-indexed day 1..7). */
export function ladderDay(streak: number): number {
  if (streak < 1) return 1
  return ((streak - 1) % STREAK_LENGTH) + 1
}

export function rewardFor(streak: number): StreakReward {
  return STREAK_LADDER[ladderDay(streak) - 1]
}

export interface StreakState {
  dayId: string
  nextResetAt: number
  /** Consecutive UTC days, 1 on the first. */
  streak: number
  /** Longest run this wallet has managed. Never resets — it is the trophy. */
  best: number
  /** Where in the seven-day ladder today sits. */
  day: number
  /** True once today's reward has been granted. */
  claimedToday: boolean
  /** What today pays (or paid). */
  today: StreakReward
  /** What tomorrow pays, so the bar can say what is at stake. */
  tomorrow: StreakReward
}

interface StreakRecord {
  streak: number
  best: number
  lastDayId: string
}

function streakRef(db: AdminDb, wallet: string) {
  return db.ref(`loginStreak/${wallet}`)
}

function yesterdayId(now: number): string {
  return getCurrentDayIdString(now - 86400000)
}

function normalize(raw: unknown): StreakRecord {
  const v = (raw || {}) as Partial<StreakRecord>
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0)
  return { streak: n(v.streak), best: n(v.best), lastDayId: typeof v.lastDayId === 'string' ? v.lastDayId : '' }
}

function build(rec: StreakRecord, now: number): StreakState {
  const dayId = getCurrentDayIdString(now)
  const live = rec.lastDayId === dayId
  // A streak whose last tick was neither today nor yesterday is already broken;
  // report it as such rather than showing a number the next tick will erase.
  const streak = live ? rec.streak : rec.lastDayId === yesterdayId(now) ? rec.streak : 0
  const shown = Math.max(1, live ? streak : streak + 1)
  return {
    dayId,
    nextResetAt: getNextUtcMidnightMs(now),
    streak: live ? rec.streak : streak,
    best: rec.best,
    day: ladderDay(shown),
    claimedToday: live,
    today: rewardFor(shown),
    tomorrow: rewardFor(shown + 1),
  }
}

/** Read-only: what the bar shows without touching anything. */
export async function readStreak(db: AdminDb, wallet: string, now = Date.now()): Promise<StreakState> {
  const snap = await streakRef(db, wallet).get()
  return build(normalize(snap.val()), now)
}

/**
 * Register today's visit and pay for it — at most once per UTC day.
 *
 * The whole decision (is this a continuation, a restart, or a repeat?) happens
 * INSIDE one transaction, so two tabs opening at the same second cannot both
 * advance the streak or both be handed the reward. The transaction is also what
 * decides whether a grant is owed: only the writer that actually moved
 * `lastDayId` forward proceeds to credit.
 */
export async function touchStreak(
  db: AdminDb,
  wallet: string,
  now = Date.now(),
): Promise<StreakState & { granted: StreakReward | null }> {
  const dayId = getCurrentDayIdString(now)
  const yday = yesterdayId(now)

  let owed: StreakReward | null = null
  const tx = await streakRef(db, wallet).transaction((cur: unknown) => {
    const rec = normalize(cur)
    if (rec.lastDayId === dayId) { owed = null; return rec }   // already counted today
    const streak = rec.lastDayId === yday ? rec.streak + 1 : 1
    owed = rewardFor(streak)
    return { streak, best: Math.max(rec.best, streak), lastDayId: dayId }
  })

  const rec = normalize(tx.snapshot?.val())
  // `committed` is false when the transaction aborted; it is also false on a
  // no-op in some SDK versions, so the grant is gated on `owed` — which is only
  // set on the path that actually advanced the day.
  if (!tx.committed || !owed) return { ...build(rec, now), granted: null }

  try {
    await grant(db, wallet, owed, now)
  } catch (err) {
    // The day is spent either way — rolling `lastDayId` back would let the
    // streak be re-claimed, which is worse than one missed grant. Logged loudly
    // because it is the only outcome here that loses the player something.
    console.error('[loginStreak] grant failed for', wallet, err)
    return { ...build(rec, now), granted: null }
  }
  return { ...build(rec, now), granted: owed }
}

async function grant(db: AdminDb, wallet: string, reward: StreakReward, now: number): Promise<void> {
  if (reward.kind === 'point') {
    // Same path /api/burn/record credits, so the balance has one owner.
    await db.ref(`playerProfiles/${wallet}/nullstateTokenBalance`)
      .transaction((cur: unknown) => (typeof cur === 'number' ? cur : 0) + reward.amount)
    return
  }
  if (reward.kind === 'shard') {
    await db.ref(`materials/${wallet}/${reward.tier}`)
      .transaction((cur: unknown) => (typeof cur === 'number' ? cur : 0) + reward.amount)
    return
  }
  // Energy is a record, not a counter — credited exactly as the Season Pass
  // daily perk does it, through normalizeRecord so a first-ever grant creates a
  // well-formed row instead of a bare number.
  await db.ref(`energy/${wallet}`).transaction((cur: unknown) => {
    const rec = normalizeRecord(cur as Partial<EnergyRecord> | null, now)
    rec.bonus += reward.amount
    return rec
  })
}

/** Human-readable, for the log line and the chip's tooltip. */
export function describeReward(r: StreakReward): string {
  if (r.kind === 'point') return `+${r.amount} NullState Point`
  if (r.kind === 'shard') return `+${r.amount} Glitch Shard ${r.tier.toUpperCase()}`
  return `+${r.amount} energy`
}

export { toState as energyToState }
