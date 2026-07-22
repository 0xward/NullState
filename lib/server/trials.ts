import { getMarketplaceItem } from '@/lib/constants/marketplace'

// =============================================
// ARMORY TRIAL — shared server helpers (growth blueprint 1B)
//
// One-time grant: after clearing Act 1 the player picks TRIAL_COUNT premium
// weapons to try free. Each trial's 48h clock starts ONLY when that weapon
// is first equipped (activatedAt), not when granted — "in inventory until
// used". Storage (Firebase RTDB):
//
//   trials/{wallet} = {
//     grantedAt: number,
//     durationH: 48,
//     items: { [itemId]: { activatedAt: number | null } },
//   }
//
// Active trial = not yet activated, OR now < activatedAt + durationH.
// Active trials are merged into /api/marketplace/owned's `owned` list so
// the engine equips them with ZERO engine changes; expired ones simply
// drop out of the list on the next load (and the equipped-slot sanitizer
// unequips them). Crafting is unaffected: the craft routes validate
// against marketplaceOwned directly, so trials can never be evolved.
// =============================================

export const TRIAL_DURATION_H = 48
export const TRIAL_COUNT = 2

export interface TrialInfo {
  itemId: string
  activatedAt: number | null
  expiresAt: number | null // null until activated
}

// A trial can be taken on any visible premium weapon (not the hidden
// starter, not pass-only items, not armor/outfits).
export function isTrialableWeapon(id: string): boolean {
  const item = getMarketplaceItem(id) as
    | { type?: string; hidden?: boolean; passOnly?: boolean }
    | undefined
  return !!item && item.type === 'weapon' && !item.hidden && !item.passOnly
}

export interface TrialRecord {
  grantedAt?: number
  durationH?: number
  items?: Record<string, { activatedAt?: number | null }>
}

export function activeTrialInfos(rec: TrialRecord | null, now = Date.now()): TrialInfo[] {
  if (!rec || !rec.items) return []
  const durMs = (rec.durationH ?? TRIAL_DURATION_H) * 3600_000
  const out: TrialInfo[] = []
  for (const [itemId, v] of Object.entries(rec.items)) {
    const activatedAt = typeof v?.activatedAt === 'number' ? v.activatedAt : null
    const expiresAt = activatedAt == null ? null : activatedAt + durMs
    if (expiresAt != null && now >= expiresAt) continue // expired — gone
    out.push({ itemId, activatedAt, expiresAt })
  }
  return out
}
