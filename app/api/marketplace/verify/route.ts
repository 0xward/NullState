import { NextRequest, NextResponse } from 'next/server'
import { decodeEventLog, parseAbi, getAddress } from 'viem'
import { publicClient } from '@/lib/web3-client'
import { getAdminDb } from '@/firebase-config'
import { getMarketplaceItem, MARKETPLACE_TOKENS, TREASURY_WALLET, type MarketplaceTokenSymbol } from '@/lib/constants/marketplace'
import { parseTokenAmount } from '@/lib/constants/tokens'

// =============================================
// MARKETPLACE PURCHASE VERIFY
// POST /api/marketplace/verify
//
// Body: { wallet, txHash, itemId, token }
//   - wallet: buyer address
//   - txHash: the ERC20 transfer() tx to the treasury
//   - itemId: which marketplace item was bought
//   - token : 'USDm' | 'USDC' | 'USDT'
//
// Verifies ON-CHAIN that the tx really transferred >= item price of the
// chosen stablecoin to the treasury wallet, is confirmed, and hasn't been
// used before — then records offchain ownership in Firebase (Realtime DB).
//
// Response: { success: true, owned: string[] }
// =============================================

const TRANSFER_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

function normalize(addr: string): string {
  try { return getAddress(addr).toLowerCase() } catch { return (addr || '').toLowerCase() }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = String(body?.wallet || '')
    const txHash = String(body?.txHash || '')
    const itemId = String(body?.itemId || '')
    const token  = String(body?.token || '') as MarketplaceTokenSymbol

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet))  return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash))  return NextResponse.json({ error: 'Invalid txHash' }, { status: 400 })
    const item = getMarketplaceItem(itemId)
    if (!item) return NextResponse.json({ error: 'Unknown item' }, { status: 400 })
    const tokenCfg = MARKETPLACE_TOKENS[token]
    if (!tokenCfg) return NextResponse.json({ error: 'Unsupported token' }, { status: 400 })

    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })

    // 1) replay protection — a tx hash can only ever unlock one purchase
    const dedupSnap = await db.ref(`marketplaceTxHashes/${txHash}`).get()
    if (dedupSnap.exists()) {
      return NextResponse.json({ error: 'This transaction was already used' }, { status: 409 })
    }

    // 2) confirm the tx on-chain
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` })
    if (!receipt || receipt.status !== 'success') {
      return NextResponse.json({ error: 'Transaction not confirmed' }, { status: 400 })
    }

    // 3) find a matching ERC20 Transfer(from=buyer, to=treasury, value>=price)
    //    emitted by the chosen token contract
    const priceWei = parseTokenAmount(String(item.price), token)
    const tokenAddr = normalize(tokenCfg.address)
    const treasury  = normalize(TREASURY_WALLET)
    const buyer     = normalize(wallet)
    let matched = false

    for (const lg of receipt.logs) {
      if (normalize(lg.address) !== tokenAddr) continue
      try {
        const dec = decodeEventLog({ abi: TRANSFER_ABI, data: lg.data, topics: lg.topics })
        if (dec.eventName !== 'Transfer') continue
        const to   = normalize(dec.args.to as string)
        const from = normalize(dec.args.from as string)
        const value = dec.args.value as bigint
        if (to === treasury && from === buyer && value >= priceWei) { matched = true; break }
      } catch { /* not a Transfer log, skip */ }
    }
    if (!matched) {
      return NextResponse.json({ error: 'No matching payment to treasury found in this tx' }, { status: 400 })
    }

    // 4) record ownership (offchain) + mark tx used
    const updates: Record<string, unknown> = {}
    updates[`marketplaceTxHashes/${txHash}`] = { wallet: buyer, itemId, token, at: Date.now() }
    updates[`marketplaceOwned/${buyer}/${itemId}`] = { at: Date.now(), txHash }
    await db.ref().update(updates)

    const ownedSnap = await db.ref(`marketplaceOwned/${buyer}`).get()
    const owned = ownedSnap.exists() ? Object.keys(ownedSnap.val()) : [itemId]

    return NextResponse.json({ success: true, owned })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Verification failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
