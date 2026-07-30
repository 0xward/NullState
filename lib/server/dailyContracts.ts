// Daily Contracts — the reason to open the app on a Tuesday.
//
// GAME-DESIGN.md §5.2, layer 2 of the four time layers. Vault Fragments answer
// "why play this week"; the weekly payout answers "why care at all". Nothing
// answered "why today", and a daily energy allowance is a limiter, not a
// reason — you cap what people want more of.
//
// Three objectives, reset 00:00 UTC, paying Glitch Shards and NullState Point.
// Deliberately NOT paying USDT: money stays weekly (owner decision, and the
// same call already recorded against the cancelled daily drip in
// GROWTH-BLUEPRINT.md §1A). Every currency here is off-chain and already
// exists, so the whole feature costs the operator nothing.
//
// ── ON TRUST ────────────────────────────────────────────────────────────────
// Container progress is credited server-side, off the same call that awards a
// vault fragment, so it cannot be inflated from the client.
//
// Kills, floors and burns cannot be: the server has no view of combat, so the
// client reports them. That is a real limitation and worth naming rather than
// dressing up. It is bounded three ways — a hard cap on the amount any single
// request may claim, a per-day ceiling that is the contract's own target, and
// the fact that the rewards are Glitch Shards and NullState Point, both of
// which are off-chain, non-withdrawable, and already client-authoritative
// everywhere else in this game (the burn route takes the client's word for
// which items were destroyed). Nothing here touches USDT.

import { getAdminDb } from '@/firebase-config'
import { getCurrentDayIdString, getNextUtcMidnightMs } from '@/lib/vault-utils'

type AdminDb = NonNullable<ReturnType<typeof getAdminDb>>

/** What a contract pays. Only currencies that already exist and are free. */
export type ContractReward =
  | { kind: 'point'; amount: number }
  | { kind: 'shard'; tier: 't1' | 't2' | 't3'; amount: number }

export interface ContractDef {
  id: string
  /** The engine event that advances it. */
  metric: 'kills' | 'floors' | 'containers' | 'burns'
  target: number
  label: string
  reward: ContractReward
}

// The pool. Targets are sized against the measured run — a bunker holds about
// seven lockable containers (npm run measure:containers), so "open 5" is most
// of one bunker and "clear 3 floors" is most of one too. One session should
// finish two of the three; the third is the nudge to come back.
export const CONTRACT_POOL: ContractDef[] = [
  { id: 'kills40', metric: 'kills', target: 40, label: 'Put down 40 of them', reward: { kind: 'point', amount: 250 } },
  { id: 'floors3', metric: 'floors', target: 3, label: 'Secure 3 floors', reward: { kind: 'shard', tier: 't1', amount: 3 } },
  { id: 'cont5', metric: 'containers', target: 5, label: 'Crack 5 lockable containers', reward: { kind: 'point', amount: 200 } },
  { id: 'burn8', metric: 'burns', target: 8, label: 'Burn 8 items', reward: { kind: 'shard', tier: 't1', amount: 2 } },
  { id: 'kills80', metric: 'kills', target: 80, label: 'Put down 80 of them', reward: { kind: 'shard', tier: 't1', amount: 4 } },
  { id: 'cont10', metric: 'containers', target: 10, label: 'Crack 10 lockable containers', reward: { kind: 'point', amount: 400 } },
]

export const CONTRACTS_PER_DAY = 3

/** Largest step one request may claim. A generous run of kills still fits. */
const MAX_STEP: Record<ContractDef['metric'], number> = {
  kills: 20, floors: 1, containers: 1, burns: 20,
}

// Everyone gets the same three on the same day. Deterministic from the day id
// so no state is needed to remember what was rolled, and two players can
// compare notes — which is worth more than per-player variety at this size.
function hashDay(dayId: string): number {
  let h = 2166136261
  for (let i = 0; i < dayId.length; i++) {
    h ^= dayId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function contractsForDay(dayId: string): ContractDef[] {
  const pool = [...CONTRACT_POOL]
  const picked: ContractDef[] = []
  let h = hashDay(dayId)
  const usedMetrics = new Set<string>()
  // Prefer three DIFFERENT metrics, so a day never asks for kills twice and
  // leaves the player with one thing to do wearing three hats.
  while (picked.length < CONTRACTS_PER_DAY && pool.length) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    const i = h % pool.length
    const cand = pool.splice(i, 1)[0]
    if (usedMetrics.has(cand.metric) && picked.length + pool.length >= CONTRACTS_PER_DAY) continue
    usedMetrics.add(cand.metric)
    picked.push(cand)
  }
  return picked
}

export interface ContractState {
  id: string
  metric: ContractDef['metric']
  label: string
  target: number
  progress: number
  done: boolean
  reward: ContractReward
}

export interface DayState {
  dayId: string
  nextResetAt: number
  contracts: ContractState[]
  /** How many of today's three are finished — what the map's chip shows. */
  completed: number
}

function progressRef(db: AdminDb, dayId: string, wallet: string) {
  return db.ref(`dailyContracts/${dayId}/${wallet}`)
}

function build(dayId: string, raw: Record<string, unknown> | null): DayState {
  const defs = contractsForDay(dayId)
  const contracts = defs.map((d) => {
    const v = raw?.[d.id]
    const progress = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(d.target, Math.floor(v))) : 0
    return { id: d.id, metric: d.metric, label: d.label, target: d.target, progress, done: progress >= d.target, reward: d.reward }
  })
  return {
    dayId,
    nextResetAt: getNextUtcMidnightMs(),
    contracts,
    completed: contracts.filter((c) => c.done).length,
  }
}

export async function readDayState(db: AdminDb, wallet: string, dayId = getCurrentDayIdString()): Promise<DayState> {
  const snap = await progressRef(db, dayId, wallet).get()
  return build(dayId, snap.exists() ? (snap.val() as Record<string, unknown>) : null)
}

/**
 * Advance every contract watching this metric, and pay for any that finish.
 *
 * The reward is granted the moment the bar fills — no claim step, matching how
 * burning already credits Point instantly. A claim button is one more tap
 * between the player and the thing they earned, on a screen they opened to
 * play a game.
 */
export async function reportMetric(
  db: AdminDb,
  wallet: string,
  metric: ContractDef['metric'],
  amount: number,
  dayId = getCurrentDayIdString(),
): Promise<DayState & { granted: string[] }> {
  const step = Math.max(1, Math.min(MAX_STEP[metric] ?? 1, Math.floor(amount)))
  const defs = contractsForDay(dayId).filter((d) => d.metric === metric)

  const granted: string[] = []

  for (const def of defs) {
    // Clamp inside the transaction so concurrent reports cannot overshoot the
    // target and hand out a second reward on the way past it.
    let crossed = false
    await progressRef(db, dayId, wallet).child(def.id).transaction((cur: unknown) => {
      const n = typeof cur === 'number' && Number.isFinite(cur) ? Math.max(0, Math.floor(cur)) : 0
      if (n >= def.target) return n
      const next = Math.min(def.target, n + step)
      if (next >= def.target) crossed = true
      return next
    })
    if (!crossed) continue

    // First-writer-wins gate, same shape as the Golden Key claim and the pass
    // daily perks: only the request that commits it pays out.
    const gate = await db.ref(`dailyContractClaims/${dayId}/${wallet}/${def.id}`).transaction((cur: unknown) => {
      if (cur !== null) return undefined
      return { claimedAt: Date.now() }
    })
    if (!gate.committed) continue

    try {
      await grantReward(db, wallet, def.reward)
      granted.push(def.id)
    } catch (err) {
      // Roll the gate back so the contract is not silently burned without its
      // reward — the next report re-attempts it. Same rollback the pass perks
      // claim does for the same reason.
      await db.ref(`dailyContractClaims/${dayId}/${wallet}/${def.id}`).remove().catch(() => {})
      throw err
    }
  }

  const state = await readDayState(db, wallet, dayId)
  return { ...state, granted }
}

async function grantReward(db: AdminDb, wallet: string, reward: ContractReward): Promise<void> {
  if (reward.kind === 'point') {
    // Same path /api/burn/record credits, so the balance has one owner.
    await db.ref(`playerProfiles/${wallet}/nullstateTokenBalance`)
      .transaction((cur: unknown) => (typeof cur === 'number' ? cur : 0) + reward.amount)
    return
  }
  await db.ref(`materials/${wallet}/${reward.tier}`)
    .transaction((cur: unknown) => (typeof cur === 'number' ? cur : 0) + reward.amount)
}
