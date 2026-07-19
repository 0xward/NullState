import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { getMarketplaceItem, resolveItemId, maxWeaponTier } from '@/lib/constants/marketplace'

// =============================================
// WEAPON EVOLUTION UPGRADE (Phase 4, blueprint §3)
// POST /api/weapons/upgrade   Body: { wallet, itemId }
// Spends Glitch Shards for the NEXT tier and bumps the weapon's tier by 1.
// Response: { success, itemId, tier, materials: {t1,t2,t3} }
//
// No payment here — shards are the currency (earned free in-run or bought via
// /api/materials/buy). Guards: must OWN the weapon, must have enough matching
// shards, must not already be at max tier.
//
// Ordering note: shards are deducted with an ATOMIC Realtime DB transaction
// (aborts if the balance is short, so it can never go negative), THEN the tier
// is written. The only failure window — a network drop between the two writes
// — costs the player shards without a tier, never grants a free tier. The
// crafting UI disables its button during the request so a single wallet won't
// fire two concurrent upgrades. (Phase 5 replaces the instant tier-up with a
// timed craft queue.)
// =============================================

type MatBal = { t1: number; t2: number; t3: number }
const TIER_KEYS = ['t1', 't2', 't3'] as const

function readBalance(v: unknown): MatBal {
  const o = (v || {}) as Record<string, unknown>
  const n = (x: unknown) => (typeof x === 'number' && isFinite(x) ? Math.max(0, Math.floor(x)) : 0)
  return { t1: n(o.t1), t2: n(o.t2), t3: n(o.t3) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = String(body?.wallet || '').toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    const item = getMarketplaceItem(String(body?.itemId || ''))
    const evoTiers = item?.evolutionTiers || []
    if (!item || item.type !== 'weapon' || evoTiers.length === 0) {
      return NextResponse.json({ error: 'Not an upgradeable weapon' }, { status: 400 })
    }
    const canonId = item.id // getMarketplaceItem already resolved legacy ids
    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })

    // 1) must own the weapon (any owned key that resolves to this canonical id)
    const ownedSnap = await db.ref(`marketplaceOwned/${wallet}`).get()
    const ownedKeys = ownedSnap.exists() ? Object.keys(ownedSnap.val()) : []
    if (!ownedKeys.some(k => resolveItemId(k) === canonId)) {
      return NextResponse.json({ error: 'You do not own this weapon' }, { status: 403 })
    }

    // 2) current tier + cap check
    const tierSnap = await db.ref(`weaponTiers/${wallet}/${canonId}`).get()
    const curTier = tierSnap.exists() && typeof tierSnap.val() === 'number'
      ? Math.max(1, Math.floor(tierSnap.val() as number)) : 1
    const cap = maxWeaponTier(item)
    if (curTier >= cap) {
      return NextResponse.json({ error: 'Weapon is already at max tier', tier: curTier }, { status: 409 })
    }
    const step = evoTiers[curTier - 1] // step INTO curTier+1
    const req_ = step.materialsRequired || {}

    // 3) atomic shard deduction — aborts (returns undefined) if short
    const result = await db.ref(`materials/${wallet}`).transaction((cur: unknown) => {
      const bal = readBalance(cur)
      for (const k of TIER_KEYS) {
        const need = (req_ as Record<string, number | undefined>)[k] || 0
        if (bal[k] < need) return // abort: not enough shards
      }
      return {
        t1: bal.t1 - (req_.t1 || 0),
        t2: bal.t2 - (req_.t2 || 0),
        t3: bal.t3 - (req_.t3 || 0),
      }
    })
    if (!result.committed) {
      const have = readBalance(result.snapshot.val())
      return NextResponse.json({ error: 'Not enough Glitch Shards', required: req_, have }, { status: 402 })
    }

    // 4) bump the tier
    const newTier = curTier + 1
    await db.ref(`weaponTiers/${wallet}/${canonId}`).set(newTier)
    const materials = readBalance(result.snapshot.val())
    return NextResponse.json({ success: true, itemId: canonId, tier: newTier, materials })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Weapon upgrade failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
