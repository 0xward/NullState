import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'

// =============================================
// PLAYER PROFILE
// GET  /api/player/profile?walletAddress=
// POST /api/player/profile
//      Body: { walletAddress: string, username?: string, avatarId?: number }
//
// GET Response:
//   {
//     walletAddress: string,
//     username: string,
//     avatarId: number,
//     totalXp: number,
//     level: number,
//     wins: number,
//     losses: number,
//     createdAt: number,
//     updatedAt: number,
//   }
// =============================================

const ALLOWED_UPDATE_FIELDS = ['username', 'avatarId'] as const
type AllowedField = (typeof ALLOWED_UPDATE_FIELDS)[number]

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const walletAddress = searchParams.get('walletAddress')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing required query param: walletAddress' },
        { status: 400 }
      )
    }

    const db = getAdminDb()
    if (!db) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 503 }
      )
    }

    const snap = await db.ref(`players/${walletAddress}`).get()

    if (!snap.exists()) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(snap.val(), { status: 200 })
  } catch (error) {
    console.error('[player/profile] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { walletAddress, ...updates } = body as {
      walletAddress?: string
      username?: string
      avatarId?: number
      [key: string]: unknown
    }

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing required field: walletAddress' },
        { status: 400 }
      )
    }

    const db = getAdminDb()
    if (!db) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 503 }
      )
    }

    const playerRef = db.ref(`players/${walletAddress}`)
    const snap = await playerRef.get()
    const now = Date.now()

    if (!snap.exists()) {
      // Create new profile
      const newProfile = {
        walletAddress,
        username: (updates.username as string) ?? `NOMAD_${walletAddress.slice(-4).toUpperCase()}`,
        avatarId: (updates.avatarId as number) ?? 0,
        totalXp: 0,
        level: 1,
        wins: 0,
        losses: 0,
        createdAt: now,
        updatedAt: now,
      }
      await playerRef.set(newProfile)
      return NextResponse.json(newProfile, { status: 201 })
    }

    // Update only allowed fields
    const safeUpdates: Partial<Record<AllowedField, unknown>> & {
      updatedAt: number
    } = { updatedAt: now }

    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (field in updates && updates[field] !== undefined) {
        safeUpdates[field] = updates[field]
      }
    }

    await playerRef.update(safeUpdates)

    const updatedSnap = await playerRef.get()
    return NextResponse.json(updatedSnap.val(), { status: 200 })
  } catch (error) {
    console.error('[player/profile] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
