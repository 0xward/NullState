import { NextRequest, NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { getAdminDb } from '@/firebase-config'
import { getMarketplaceItem } from '@/lib/constants/marketplace'

// =============================================
// MARKETPLACE EQUIPPED-SLOT SAVE
// POST /api/marketplace/equip
//
// Body: { wallet, mainhand, body }  (mainhand/body are item ids or null)
//
// Persists WHICH owned item is currently worn in each slot, in Firebase,
// keyed by wallet — same durability guarantee as marketplaceOwned. Before
// this endpoint existed, the equipped choice only ever lived in the HP's
// localStorage (see window.NS_saveEquipment in game.js), which meant
// uninstalling/reinstalling MiniPay (or switching devices) reset it back
// to "nothing equipped" even though the owned item itself was never lost.
//
// Response: { success: true, equipped: { mainhand, body } }
// =============================================

function normalize(addr: string): string {
  try { return getAddress(addr).toLowerCase() } catch { return (addr || '').toLowerCase() }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = String(body?.wallet || '')
    const mainhandRaw = body?.mainhand ?? null
    const bodyRaw = body?.body ?? null

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    const buyer = normalize(wallet)

    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })

    // Only ever persist ids that (a) are real marketplace items in the
    // right slot, and (b) this wallet actually owns — never trust the
    // client's word for either, since this is a server-side save.
    const ownedSnap = await db.ref(`marketplaceOwned/${buyer}`).get()
    const owned: string[] = ownedSnap.exists() ? Object.keys(ownedSnap.val()) : []

    function sanitize(id: unknown, slot: 'mainhand' | 'body'): string | null {
      if (typeof id !== 'string' || !id) return null
      if (!owned.includes(id)) return null
      const item = getMarketplaceItem(id)
      if (!item || item.slot !== slot) return null
      return id
    }

    const equipped = {
      mainhand: sanitize(mainhandRaw, 'mainhand'),
      body: sanitize(bodyRaw, 'body'),
    }

    await db.ref(`marketplaceEquipped/${buyer}`).set({ ...equipped, at: Date.now() })

    return NextResponse.json({ success: true, equipped })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to save equipped gear'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
