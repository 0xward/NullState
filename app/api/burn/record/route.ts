import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, createWalletClient, http, parseUnits, isAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'
import { REWARD_ABI, REWARD_CONTRACT_ADDRESS, USDM_ADDRESS } from '@/lib/contract-abi'
import { getAdminDb } from '@/firebase-config'
import { normalizeWalletAddress } from '@/lib/vault-utils'
import { getCurrentSeasonId } from '@/lib/web3-client'

// =============================================
// BURN RECORD
// POST /api/burn/record
//
// Body (sent by game.js's confirmBurn() -> nullstate-items-burned event,
// forwarded verbatim by DungeonGameWrapper.tsx):
//   {
//     wallet: string,
//     items: Array<{ id: string|number, name: string, rarity?: string, qty: number, burnValue: number }>,
//     totalValue: number,
//     timestamp: number,
//   }
//
// Response:
//   { success: true, burnId: string, totalValue: number, txHash: string|null }
// =============================================

const MAX_ITEMS_PER_BURN = 20
const MIN_ITEM_VALUE = 0.001
const MAX_ITEM_VALUE = 1

interface RawBurnItem {
  id?: string | number
  name?: string
  rarity?: string
  qty?: number
  burnValue?: number
  icon?: string
  color?: string
}

function clampItemValue(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0
  return Math.min(MAX_ITEM_VALUE, Math.max(MIN_ITEM_VALUE, n))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const wallet = String(body?.wallet ?? '')
    const rawItems = Array.isArray(body?.items) ? (body.items as RawBurnItem[]) : []
    const timestamp =
      typeof body?.timestamp === 'number' && Number.isFinite(body.timestamp)
        ? body.timestamp
        : Date.now()

    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json({ error: 'Missing or invalid wallet address' }, { status: 400 })
    }

    if (rawItems.length === 0) {
      return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 })
    }

    // Reject oversized batches outright — a legit burn only ever queues a
    // handful of stash items at once; anything bigger is almost certainly
    // spam/exploit hitting this endpoint directly.
    if (rawItems.length > MAX_ITEMS_PER_BURN) {
      return NextResponse.json(
        { error: `Too many items in one burn (max ${MAX_ITEMS_PER_BURN})` },
        { status: 400 }
      )
    }

    // Never trust burnValue/totalValue from the client verbatim — clamp
    // every item to the sane 0.001–1 USDm range and recompute the total
    // server-side from the clamped values. game.js normally sends correct
    // numbers already, but this endpoint can be hit directly without going
    // through the game at all.
    const validatedItems = rawItems.map(it => {
      const qty = typeof it.qty === 'number' && it.qty > 0 ? Math.floor(it.qty) : 1
      const unitValue = clampItemValue(it.burnValue)
      // icon/color are display-only decoration for the Rewards screen's burn
      // history (components/game/RewardsScreen.tsx) — only accept values
      // that already match how game.js generates them (a same-origin sprite
      // path, a short CSS color token), never an arbitrary attacker-supplied
      // URL/string, even though React itself already escapes both safely.
      const icon =
        typeof it.icon === 'string' && /^\/sprites\/items\/[\w./-]+\.png$/.test(it.icon)
          ? it.icon
          : undefined
      const color =
        typeof it.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(it.color) ? it.color : undefined
      return {
        id: it.id !== undefined ? String(it.id) : 'unknown',
        name: typeof it.name === 'string' && it.name ? it.name : 'Unknown Item',
        rarity: typeof it.rarity === 'string' ? it.rarity : undefined,
        qty,
        burnValue: unitValue,
        icon,
        color,
      }
    })

    const totalValue = validatedItems.reduce((sum, it) => sum + it.burnValue * it.qty, 0)
    const itemCount = validatedItems.reduce((sum, it) => sum + it.qty, 0)

    const normalizedWallet = normalizeWalletAddress(wallet)
    const seasonId = getCurrentSeasonId()

    const db = getAdminDb()
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }

    // ── On-chain: recordBurn() via the backend signer ──────────────────────
    // recordBurn() will REVERT unless NullStateReward.sol's owner has
    // already called setBackendAddress(BACKEND_WALLET_ADDRESS) on-chain.
    // If that hasn't been confirmed yet, this write is expected to fail —
    // the Firestore record below still gets saved as a fallback/log so no
    // burn data is lost, but the player won't actually be credited toward
    // the weekly pool until the backend address is configured on-chain.
    let txHash: string | null = null
    let onChainError: string | null = null
    const backendPrivateKey = process.env.BACKEND_PRIVATE_KEY as `0x${string}` | undefined

    if (backendPrivateKey && REWARD_CONTRACT_ADDRESS && REWARD_CONTRACT_ADDRESS !== '0x') {
      try {
        const account = privateKeyToAccount(backendPrivateKey)
        const transport = http(
          process.env.CELO_RPC_URL ?? process.env.NEXT_PUBLIC_CELO_RPC ?? 'https://forno.celo.org'
        )
        const publicClient = createPublicClient({ chain: celo, transport })
        const walletClient = createWalletClient({ chain: celo, transport, account })

        const burnValueWei = parseUnits(totalValue.toFixed(18), 18)

        const hash = await walletClient.writeContract({
          address: REWARD_CONTRACT_ADDRESS,
          abi: REWARD_ABI,
          functionName: 'recordBurn',
          args: [normalizedWallet as `0x${string}`, BigInt(itemCount), burnValueWei, USDM_ADDRESS],
          account,
        })
        await publicClient.waitForTransactionReceipt({ hash })
        txHash = hash
      } catch (err) {
        onChainError = err instanceof Error ? err.message : 'recordBurn on-chain call failed'
        console.error('[burn/record] on-chain recordBurn failed:', err)
      }
    }

    // Dedup index: if this exact tx hash was already recorded, don't
    // double-write the burn (covers client-side retries).
    if (txHash) {
      const dedupSnap = await db.ref(`burnTxHashes/${txHash}`).get()
      if (dedupSnap.exists()) {
        return NextResponse.json(
          { success: true, burnId: dedupSnap.val(), totalValue, txHash },
          { status: 200 }
        )
      }
    }

    const now = Date.now()
    const burnRef = db.ref(`burnRecords/${seasonId}/${normalizedWallet}`).push()
    const burnId: string = burnRef.key ?? `burn_${now}`

    const burnRecord = {
      burnId,
      wallet: normalizedWallet,
      items: validatedItems,
      itemCount,
      totalValue,
      txHash,
      onChainError,
      timestamp,
      recordedAt: now,
    }

    const updates: Record<string, unknown> = {
      [`burnRecords/${seasonId}/${normalizedWallet}/${burnId}`]: burnRecord,
    }
    if (txHash) updates[`burnTxHashes/${txHash}`] = burnId
    await db.ref().update(updates)

    // Bump lightweight player profile stats (mirrors app/api/player/profile
    // route's expectations of playerProfiles/{wallet}.stats.totalBurns).
    const profileRef = db.ref(`playerProfiles/${normalizedWallet}/stats`)
    const statsSnap = await profileRef.get()
    const prevStats = statsSnap.val() ?? { totalBurns: 0, totalRewards: 0, vaultAttempts: 0 }
    await profileRef.update({
      totalBurns: (prevStats.totalBurns ?? 0) + 1,
      totalRewards: (prevStats.totalRewards ?? 0) + totalValue,
    })

    return NextResponse.json(
      { success: true, burnId, totalValue, txHash, onChainError },
      { status: 201 }
    )
  } catch (error) {
    console.error('[burn/record] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
