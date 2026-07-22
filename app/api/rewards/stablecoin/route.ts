import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { walletAddressSchema } from '@/lib/validation'
import { normalizeWalletAddress } from '@/lib/vault-utils'

// =============================================
// STABLECOIN REWARD HISTORY (Rewards screen — left tab)
// GET /api/rewards/stablecoin?walletAddress=0x...
//
// The "reward points" (NullState Point) side already has a history via
// /api/player/profile (burnRecords). This is its stablecoin counterpart:
// the real on-chain payouts a wallet has RECEIVED, aggregated from the
// Firebase records the game already writes. Firebase-only on purpose (no
// RPC) so the Rewards screen stays fast and can't fail on a flaky node.
//
// Two stablecoin sources produce history entries:
//   1. Treasure Vault wins  — vaultCompleted/{weekId}/{wallet}
//      (written by /api/vault/submit on a correct code; the reward is paid
//      on-chain in the same request). We surface { weekId, txHash, at }.
//   2. Season leaderboard bonus / weekly reward — rewards/{wallet}/... if a
//      backend/cron has logged them there (same node /api/player/profile
//      already reads). Surfaced defensively — absent nodes just yield an
//      empty list, never an error.
//
// The CLAIMABLE side (a top-3 season bonus you can still claim right now) is
// read live on the client via hooks/useReward.ts against NullStateRewardV2,
// not here — this route is the "already received" ledger only.
//
// Response: { history: StablecoinEntry[], totalEntries: number }
//   StablecoinEntry =
//     { kind: 'vault',  weekId, txHash: string|null, at: number }
//   | { kind: 'season', seasonId, amount?: number, token?: string, txHash?: string|null, at: number }
//   | { kind: 'weekly', weekId,  amount?: number, token?: string, txHash?: string|null, at: number }
// =============================================

interface StablecoinEntry {
  kind: 'vault' | 'season' | 'weekly'
  weekId?: number
  seasonId?: number
  amount?: number
  token?: string
  txHash?: string | null
  at: number
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

export async function GET(req: NextRequest) {
  try {
    const walletResult = walletAddressSchema.safeParse(req.nextUrl.searchParams.get('walletAddress') ?? '')
    if (!walletResult.success) {
      return NextResponse.json(
        { error: walletResult.error.issues[0]?.message ?? 'Invalid wallet address' },
        { status: 400 },
      )
    }
    const wallet = normalizeWalletAddress(walletResult.data)

    const db = getAdminDb()
    if (!db) {
      return NextResponse.json({ error: 'Firebase Admin is not configured on the server' }, { status: 503 })
    }

    const [vaultAllSnap, rewardsSnap] = await Promise.all([
      // Keyed vaultCompleted/{weekId}/{wallet}; read the tree once and pick
      // out this wallet's wins. The game has few active weeks, so this stays
      // small — revisit with a per-wallet index if it ever grows.
      db.ref('vaultCompleted').get(),
      db.ref(`rewards/${wallet}`).get(),
    ])

    const history: StablecoinEntry[] = []

    // ---- Treasure Vault wins ----
    if (vaultAllSnap.exists()) {
      const byWeek = (vaultAllSnap.val() ?? {}) as Record<string, Record<string, any>>
      for (const [weekIdStr, wallets] of Object.entries(byWeek)) {
        const rec = wallets?.[wallet]
        if (!rec) continue
        history.push({
          kind: 'vault',
          weekId: Number(weekIdStr),
          txHash: typeof rec.txHash === 'string' ? rec.txHash : null,
          at: num(rec.completedAt) ?? 0,
        })
      }
    }

    // ---- Season bonus / weekly reward ledger (if a backend logged it) ----
    const rewardsVal = (rewardsSnap.val() ?? {}) as {
      seasonBonus?: Record<string, any>
      weeklyRewards?: Record<string, any>
    }
    for (const [seasonIdStr, rec] of Object.entries(rewardsVal.seasonBonus ?? {})) {
      history.push({
        kind: 'season',
        seasonId: Number(seasonIdStr),
        amount: num((rec as any)?.amount),
        token: typeof (rec as any)?.token === 'string' ? (rec as any).token : undefined,
        txHash: typeof (rec as any)?.txHash === 'string' ? (rec as any).txHash : null,
        at: num((rec as any)?.claimedAt) ?? num((rec as any)?.at) ?? 0,
      })
    }
    for (const [weekIdStr, rec] of Object.entries(rewardsVal.weeklyRewards ?? {})) {
      history.push({
        kind: 'weekly',
        weekId: Number(weekIdStr),
        amount: num((rec as any)?.amount),
        token: typeof (rec as any)?.token === 'string' ? (rec as any).token : undefined,
        txHash: typeof (rec as any)?.txHash === 'string' ? (rec as any).txHash : null,
        at: num((rec as any)?.claimedAt) ?? num((rec as any)?.at) ?? 0,
      })
    }

    history.sort((a, b) => b.at - a.at)

    return NextResponse.json({ history, totalEntries: history.length })
  } catch (error) {
    console.error('[rewards/stablecoin] Error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
