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

    return NextResponse.json({
      profile,
      summary: {
        totalBurnEvents: burns.length,
        weeklyRewardEntries: Object.keys(weeklyRewards).length,
        seasonBonusEntries: Object.keys(seasonBonus).length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
