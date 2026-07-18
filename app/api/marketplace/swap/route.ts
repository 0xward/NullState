import { NextRequest, NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { getAdminDb } from '@/firebase-config'
import { getMarketplaceItem } from '@/lib/constants/marketplace'

// =============================================
// MARKETPLACE TOKEN SWAP (Phase 5.5 #8)
// POST /api/marketplace/swap
//
// Body: { wallet, itemId }
//
// Off-chain equivalent of /api/marketplace/verify — instead of verifying a
// real USDm/USDC/USDT on-chain transfer, this deducts NullState Point from
// the player's balance (playerProfiles/{wallet}/nullstateTokenBalance) and
// grants marketplace ownership the same way a real purchase would. Only
// items with a `tokenPrice` set (Marketplace items $0.5–$2 — see
// lib/constants/marketplace.ts) are swap-eligible; anything above that
// must be bought with real currency via /api/marketplace/verify. The price
// check is re-validated here server-side — the client's "Swap" button
// being hidden for pricier items is a UX nicety, not the actual guard.
//
// Response: { success: true, owned: string[], newBalance: number }
// =============================================

function normalize(addr: string): string {
  try { return getAddress(addr).toLowerCase() } catch { return (addr || '').toLowerCase() }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = String(body?.wallet || '')
    const itemId = String(body?.itemId || '')

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    const item = getMarketplaceItem(itemId)
    if (!item) return NextResponse.json({ error: 'Unknown item' }, { status: 400 })
    if (!item.tokenPrice) {
      return NextResponse.json(
        { error: 'This item cannot be swapped for NullState Point — buy with USDm/USDC/USDT instead' },
        { status: 400 }
      )
    }

    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })

    const normalizedWallet = normalize(wallet)

    // Already owned? Nothing to swap for.
    const alreadyOwnedSnap = await db.ref(`marketplaceOwned/${normalizedWallet}/${itemId}`).get()
    if (alreadyOwnedSnap.exists()) {
      const ownedSnap = await db.ref(`marketplaceOwned/${normalizedWallet}`).get()
      const owned = ownedSnap.exists() ? Object.keys(ownedSnap.val()) : [itemId]
      return NextResponse.json({ error: 'You already own this item', owned }, { status: 409 })
    }

    // Atomic deduct — only commits if the balance is sufficient, so two
    // concurrent swap requests can't both succeed off the same balance.
    const balanceRef = db.ref(`playerProfiles/${normalizedWallet}/nullstateTokenBalance`)
    const requiredTokens = item.tokenPrice
    const txResult = await balanceRef.transaction((current: number | null) => {
      const balance = current ?? 0
      if (balance < requiredTokens) return current // abort, unchanged
      return balance - requiredTokens
    })

    if (!txResult.committed) {
      const currentBalance = (txResult.snapshot?.val() as number) ?? 0
      return NextResponse.json(
        { error: `Not enough NullState Point (need ${requiredTokens}, have ${currentBalance})` },
        { status: 400 }
      )
    }

    const newBalance = (txResult.snapshot?.val() as number) ?? 0

    const updates: Record<string, unknown> = {}
    updates[`marketplaceOwned/${normalizedWallet}/${itemId}`] = {
      at: Date.now(),
      method: 'token_swap',
      tokensSpent: requiredTokens,
    }
    await db.ref().update(updates)

    const ownedSnap = await db.ref(`marketplaceOwned/${normalizedWallet}`).get()
    const owned = ownedSnap.exists() ? Object.keys(ownedSnap.val()) : [itemId]

    return NextResponse.json({ success: true, owned, newBalance })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Swap failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
