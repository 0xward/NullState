import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'

// =============================================
// BURN RECORD
// POST /api/burn/record
//
// Body:
//   {
//     walletAddress: string,
//     txHash: string,
//     itemId: number,
//     itemName: string,
//     xpReward: number,
//     seasonId: number,
//   }
//
// Response:
//   {
//     success: true,
//     burnId: string,
//     totalXp: number,
//     level: number,
//   }
// =============================================

function xpToLevel(xp: number): number {
  // Simple level curve: level = floor(sqrt(xp / 100)) + 1
  return Math.floor(Math.sqrt(xp / 100)) + 1
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { walletAddress, txHash, itemId, itemName, xpReward, seasonId } =
      body as {
        walletAddress?: string
        txHash?: string
        itemId?: number
        itemName?: string
        xpReward?: number
        seasonId?: number
      }

    if (!walletAddress || !txHash || itemId === undefined || !seasonId) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: walletAddress, txHash, itemId, seasonId',
        },
        { status: 400 }
      )
    }

    const xp = typeof xpReward === 'number' && xpReward > 0 ? xpReward : 0

    const db = getAdminDb()
    if (!db) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 503 }
      )
    }

    // Prevent duplicate burn records for the same tx
    const existingSnap = await db.ref(`burns/tx/${txHash}`).get()
    if (existingSnap.exists()) {
      return NextResponse.json(
        { error: 'Transaction already recorded' },
        { status: 409 }
      )
    }

    const now = Date.now()

    // Generate a new burn record ID
    const burnRef = db.ref(`burns/records`).push()
    const burnId: string = burnRef.key ?? `burn_${now}`

    const burnRecord = {
      burnId,
      walletAddress,
      txHash,
      itemId,
      itemName: itemName ?? `Item #${itemId}`,
      xpReward: xp,
      seasonId,
      timestamp: now,
    }

    // Write burn record + dedup index atomically
    await db.ref().update({
      [`burns/records/${burnId}`]: burnRecord,
      [`burns/tx/${txHash}`]: burnId,
      [`burns/byPlayer/${walletAddress}/${burnId}`]: true,
    })

    // Update player XP and leaderboard
    const playerRef = db.ref(`players/${walletAddress}`)
    const playerSnap = await playerRef.get()

    let totalXp = xp
    let level = xpToLevel(totalXp)

    if (playerSnap.exists()) {
      const prev = playerSnap.val() as { totalXp?: number }
      totalXp = (prev.totalXp ?? 0) + xp
      level = xpToLevel(totalXp)
      await playerRef.update({ totalXp, level, updatedAt: now })
    } else {
      await playerRef.set({
        walletAddress,
        username: `NOMAD_${walletAddress.slice(-4).toUpperCase()}`,
        avatarId: 0,
        totalXp,
        level,
        wins: 0,
        losses: 0,
        createdAt: now,
        updatedAt: now,
      })
    }

    // Update season leaderboard entry
    await db.ref(`leaderboard/${seasonId}/${walletAddress}`).update({
      walletAddress,
      totalXp,
      level,
      updatedAt: now,
    })

    return NextResponse.json(
      { success: true, burnId, totalXp, level },
      { status: 201 }
    )
  } catch (error) {
    console.error('[burn/record] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
