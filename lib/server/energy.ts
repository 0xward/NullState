// Server-side Energy/Action accounting (Genius blueprint Phase 1).
//
// One energy = one fresh bunker entry. Stored in the same Firebase Realtime
// DB the marketplace ownership records use (getAdminDb), keyed by wallet:
//
//   energy/{wallet} = { windowStart: number, usedFree: number, bonus: number }
//
// The free allowance lives in a rolling 24h window: the window starts on the
// first spend after it lapses, and usedFree resets implicitly when the
// window is stale (lazy reset — no cron needed). Purchased bonus runs are
// NOT windowed: they were paid for, so they persist until spent.
//
// All mutation goes through Realtime DB transactions so two concurrent
// spend calls can never double-consume the same run.

import { GAME_CONFIG } from '@/lib/constants/game-config'

export interface EnergyRecord {
  windowStart: number
  usedFree: number
  bonus: number
}

export interface EnergyState {
  freeRemaining: number
  bonus: number
  total: number
  resetAt: number // when the free window replenishes (ms epoch)
}

const CFG = GAME_CONFIG.energy

export function windowMs(): number {
  return CFG.windowHours * 60 * 60 * 1000
}

/** Normalize a raw DB record (possibly null) against the current time. */
export function normalizeRecord(raw: Partial<EnergyRecord> | null, now: number): EnergyRecord {
  const rec: EnergyRecord = {
    windowStart: typeof raw?.windowStart === 'number' ? raw.windowStart : 0,
    usedFree: typeof raw?.usedFree === 'number' ? raw.usedFree : 0,
    bonus: typeof raw?.bonus === 'number' ? raw.bonus : 0,
  }
  if (now - rec.windowStart >= windowMs()) {
    // stale window — free allowance replenished
    rec.windowStart = 0
    rec.usedFree = 0
  }
  return rec
}

export function toState(rec: EnergyRecord, now: number): EnergyState {
  const freeRemaining = Math.max(0, CFG.freeRunsPerDay - rec.usedFree)
  return {
    freeRemaining,
    bonus: rec.bonus,
    total: freeRemaining + rec.bonus,
    // if the window hasn't started (nothing used), it would start on the
    // next spend — report now+window so countdown UIs always have a value
    resetAt: (rec.windowStart || now) + windowMs(),
  }
}

/**
 * Attempt to consume one run inside a Realtime DB transaction.
 * Returns the post-spend state plus ok=false when no energy was available.
 */
export async function spendOne(
  db: { ref: (path: string) => { transaction: (fn: (cur: unknown) => unknown) => Promise<{ committed: boolean; snapshot: { val: () => unknown } }> } },
  wallet: string,
  now: number,
): Promise<{ ok: boolean; state: EnergyState }> {
  let ok = false
  const result = await db.ref(`energy/${wallet}`).transaction((cur: unknown) => {
    const rec = normalizeRecord(cur as Partial<EnergyRecord> | null, now)
    ok = false
    if (rec.usedFree < CFG.freeRunsPerDay) {
      if (rec.windowStart === 0) rec.windowStart = now // window starts on first spend
      rec.usedFree += 1
      ok = true
    } else if (rec.bonus > 0) {
      rec.bonus -= 1
      ok = true
    }
    return rec // always write the (possibly just lazily-reset) record back
  })
  const rec = normalizeRecord(result.snapshot.val() as Partial<EnergyRecord> | null, now)
  return { ok, state: toState(rec, now) }
}
