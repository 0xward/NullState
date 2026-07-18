import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSeasonId } from '@/lib/web3-client'
import { getAdminDb } from '@/firebase-config'
import { seasonIdInputSchema, walletAddressSchema } from '@/lib/validation'
import { normalizeWalletAddress } from '@/lib/vault-utils'

// Fails fast with a normal, catchable error instead of letting a hung
// Firebase call (e.g. FIREBASE_DATABASE_URL pointing at the wrong region)
// run until Vercel's own function-timeout kicks in. A platform timeout
// returns its own HTML/plaintext error page instead of this route's JSON,
// which is why the Rewards screen was showing a raw parse error rather
// than a real message — see components/game/RewardsScreen.tsx.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms — check FIREBASE_DATABASE_URL/FIREBASE_SERVICE_ACCOUNT`)), ms)
    ),
  ])
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const walletAddressResult = walletAddressSchema.safeParse(searchParams.get('walletAddress') ?? '')
    if (!walletAddressResult.success) {
      return NextResponse.json(
        { error: walletAddressResult.error.issues[0]?.message ?? 'Invalid wallet address' },
        { status: 400 },
      )
    }

    const seasonIdInput = searchParams.get('seasonId')
    const seasonIdResult =
      seasonIdInput == null
        ? { success: true as const, data: String(getCurrentSeasonId()) }
        : seasonIdInputSchema.safeParse(seasonIdInput)
    if (!seasonIdResult.success) {
      return NextResponse.json(
        { error: seasonIdResult.error.issues[0]?.message ?? 'Invalid seasonId' },
        { status: 400 },
      )
    }

    const seasonId = Number(seasonIdResult.data)
    const normalizedWallet = normalizeWalletAddress(walletAddressResult.data)

    const db = getAdminDb()
    if (!db) {
      return NextResponse.json({ error: 'Firebase Admin is not configured on the server' }, { status: 503 })
    }

    const [profileSnap, rewardSnap, burnSnap] = await withTimeout(
      Promise.all([
        db.ref(`playerProfiles/${normalizedWallet}`).get(),
        db.ref(`rewards/${normalizedWallet}`).get(),
        db.ref(`burnRecords/${seasonId}/${normalizedWallet}`).get(),
      ]),
      8000,
      'Firebase read'
    )

    const profile = profileSnap.val() ?? {
      walletAddress: normalizedWallet,
      nickname: 'Unknown Player',
      inventory: { health: 100, mana: 50, items: {} },
      stats: { totalBurns: 0, totalRewards: 0, vaultAttempts: 0 },
      joinedAt: null,
      currentSeasonId: seasonId,
      nullstateTokenBalance: 0,
    }

    const burns = burnSnap.exists() ? Object.values(burnSnap.val() ?? {}) : []
    const weeklyRewards = rewardSnap.val()?.weeklyRewards ?? {}
    const seasonBonus = rewardSnap.val()?.seasonBonus ?? {}

    // Total USDm value across every burn this season — used by the in-game
    // Rewards screen to show "total mined value burned" at a glance instead
    // of making the client sum the (potentially large) burns array itself.
    const totalBurnedValue = (burns as any[]).reduce(
      (sum, b) => sum + (typeof b?.totalValue === 'number' ? b.totalValue : 0),
      0
    )

    return NextResponse.json({
      profile,
      summary: {
        totalBurnEvents: burns.length,
        weeklyRewardEntries: Object.keys(weeklyRewards).length,
        seasonBonusEntries: Object.keys(seasonBonus).length,
        totalBurnedValue: Math.round(totalBurnedValue),
        nullstateTokenBalance:
          typeof profile?.nullstateTokenBalance === 'number' ? profile.nullstateTokenBalance : 0,
      },
      // Full burn history for this season, most recent first — powers the
      // "mining history" list on the Rewards screen (components/game/
      // RewardsScreen.tsx). Each entry mirrors the shape written by
      // POST /api/burn/record.
      burns: (burns as any[]).sort((a, b) => (b?.recordedAt ?? 0) - (a?.recordedAt ?? 0)),
    })
  } catch (error) {
    console.error('[player/profile] Error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
