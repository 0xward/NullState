import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { getMarketplaceItem, resolveItemId, maxWeaponTier } from '@/lib/constants/marketplace'
import { craftDurationMs, firstCraftInstant, normalizeCraft, type CraftRecord } from '@/lib/server/weaponCraft'

// =============================================
// START A WEAPON CRAFT (Phase 5)
// POST /api/weapons/craft/start   Body: { wallet, itemId }
//
// Locks the weapon + spends the next tier's Glitch Shards up front, then either
//   - completes INSTANTLY (the wallet's first-ever craft, if firstCraftInstant)
//     so the player feels one evolution payoff with no wait, or
//   - queues a timed craft (craftQueue/{wallet}) the player later claims (when
//     the timer elapses) or skips via Finish Now.
// Only ONE active craft per wallet. Shards are the currency; no payment here.
// Response:
//   instant -> { success, completed:true, instant:true, tier, materials }
//   timed   -> { success, completed:false, craft, materials }
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
    const canonId = item.id
    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })

    // 1) one active craft per wallet
    const existingSnap = await db.ref(`craftQueue/${wallet}`).get()
    if (normalizeCraft(existingSnap.exists() ? existingSnap.val() : null)) {
      return NextResponse.json({ error: 'A craft is already in progress' }, { status: 409 })
    }

    // 2) must own the weapon
    const ownedSnap = await db.ref(`marketplaceOwned/${wallet}`).get()
    const ownedKeys = ownedSnap.exists() ? Object.keys(ownedSnap.val()) : []
    if (!ownedKeys.some(k => resolveItemId(k) === canonId)) {
      return NextResponse.json({ error: 'You do not own this weapon' }, { status: 403 })
    }

    // 3) current tier + cap
    const tierSnap = await db.ref(`weaponTiers/${wallet}/${canonId}`).get()
    const curTier = tierSnap.exists() && typeof tierSnap.val() === 'number'
      ? Math.max(1, Math.floor(tierSnap.val() as number)) : 1
    const cap = maxWeaponTier(item)
    if (curTier >= cap) {
      return NextResponse.json({ error: 'Weapon is already at max tier', tier: curTier }, { status: 409 })
    }
    const targetTier = curTier + 1
    const step = evoTiers[curTier - 1]
    const need = step.materialsRequired || {}

    // 4) atomic shard deduction — aborts if short
    const result = await db.ref(`materials/${wallet}`).transaction((cur: unknown) => {
      const bal = readBalance(cur)
      for (const k of TIER_KEYS) {
        const req_ = (need as Record<string, number | undefined>)[k] || 0
        if (bal[k] < req_) return
      }
      return { t1: bal.t1 - (need.t1 || 0), t2: bal.t2 - (need.t2 || 0), t3: bal.t3 - (need.t3 || 0) }
    })
    if (!result.committed) {
      return NextResponse.json({ error: 'Not enough Glitch Shards', required: need, have: readBalance(result.snapshot.val()) }, { status: 402 })
    }
    const materials = readBalance(result.snapshot.val())

    // 5) first-ever craft completes instantly (still cost shards, just no timer)
    const metaSnap = await db.ref(`weaponCraftMeta/${wallet}/firstDone`).get()
    const firstDone = metaSnap.exists() && metaSnap.val() === true
    if (firstCraftInstant() && !firstDone) {
      await db.ref().update({
        [`weaponTiers/${wallet}/${canonId}`]: targetTier,
        [`weaponCraftMeta/${wallet}/firstDone`]: true,
      })
      return NextResponse.json({ success: true, completed: true, instant: true, itemId: canonId, tier: targetTier, materials })
    }

    // 6) queue a timed craft
    const now = Date.now()
    const craft: CraftRecord = { itemId: canonId, targetTier, startedAt: now, completesAt: now + craftDurationMs(targetTier) }
    await db.ref(`craftQueue/${wallet}`).set(craft)
    return NextResponse.json({ success: true, completed: false, craft, materials })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Craft start failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
