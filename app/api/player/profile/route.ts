import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSeasonId } from '@/lib/web3-client'
import { getAdminDb } from '@/firebase-config'
import { normalizeWalletAddress } from '@/lib/vault-utils'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const walletAddress = String(searchParams.get('walletAddress') ?? '').trim()

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 })
    }

    const seasonId = Number(searchParams.get('seasonId') ?? getCurrentSeasonId())
    const normalizedWallet = normalizeWalletAddress(walletAddress)

    const db = getAdminDb()
    if (!db) {
      return NextResponse.json({ error: 'Firebase Admin is not configured on the server' }, { status: 503 })
    }

    const [profileSnap, rewardSnap, burnSnap] = await Promise.all([
      db.ref(`playerProfiles/${normalizedWallet}`).get(),
      db.ref(`rewards/${normalizedWallet}`).get(),
      db.ref(`burnRecords/${seasonId}/${normalizedWallet}`).get(),
    ])

    const profile = profileSnap.val() ?? {
      walletAddress: normalizedWallet,
      nickname: 'Unknown Player',
      inventory: { health: 100, mana: 50, items: {} },
      stats: { totalBurns: 0, totalRewards: 0, vaultAttempts: 0 },
      joinedAt: null,
      currentSeasonId: seasonId,
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
        totalBurnedValue: Math.round(totalBurnedValue * 1000) / 1000,
      },
      // Full burn history for this season, most recent first — powers the
      // "mining history" list on the Rewards screen (components/game/
      // RewardsScreen.tsx). Each entry mirrors the shape written by
      // POST /api/burn/record.
      burns: (burns as any[]).sort((a, b) => (b?.recordedAt ?? 0) - (a?.recordedAt ?? 0)),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
