import { NextRequest, NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { getAdminDb } from '@/firebase-config'

// GET /api/marketplace/owned?wallet=0x...
// Returns the list of marketplace equipment ids the wallet owns (offchain).
// Response: { owned: string[] }
export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet') || ''
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    let normalized = wallet.toLowerCase()
    try { normalized = getAddress(wallet).toLowerCase() } catch { /* keep lowercased */ }

    const db = getAdminDb()
    if (!db) return NextResponse.json({ owned: [] })

    const snap = await db.ref(`marketplaceOwned/${normalized}`).get()
    const owned = snap.exists() ? Object.keys(snap.val()) : []
    return NextResponse.json({ owned })
  } catch {
    return NextResponse.json({ owned: [] })
  }
}
