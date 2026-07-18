import { NextRequest, NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { getAdminDb } from '@/firebase-config'

// GET /api/marketplace/owned?wallet=0x...
// Returns the list of marketplace equipment ids the wallet owns (offchain),
// plus which of those (if any) is currently equipped in each slot.
// Response: { owned: string[], equipped: { mainhand: string|null, body: string|null } }
export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet') || ''
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    let normalized = wallet.toLowerCase()
    try { normalized = getAddress(wallet).toLowerCase() } catch { /* keep lowercased */ }

    const db = getAdminDb()
    if (!db) return NextResponse.json({ owned: [], equipped: { mainhand: null, body: null } })

    const [ownedSnap, equippedSnap] = await Promise.all([
      db.ref(`marketplaceOwned/${normalized}`).get(),
      db.ref(`marketplaceEquipped/${normalized}`).get(),
    ])
    const owned = ownedSnap.exists() ? Object.keys(ownedSnap.val()) : []
    const equippedVal = equippedSnap.exists() ? equippedSnap.val() : {}
    // Never trust a stored equipped id that isn't in the current owned
    // list (e.g. leftover from before a refund/removal).
    const equipped = {
      mainhand: equippedVal.mainhand && owned.includes(equippedVal.mainhand) ? equippedVal.mainhand : null,
      body: equippedVal.body && owned.includes(equippedVal.body) ? equippedVal.body : null,
    }
    return NextResponse.json({ owned, equipped })
  } catch {
    return NextResponse.json({ owned: [], equipped: { mainhand: null, body: null } })
  }
}
