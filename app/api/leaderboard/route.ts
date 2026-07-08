import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'

// =============================================
// LEADERBOARD
// GET /api/leaderboard?seasonId=&limit=
//
// Response:
//   {
//     seasonId: number,
//     updatedAt: number,
//     entries: Array<{
//       rank: number,
//       walletAddress: string,
//       username: string,
//       totalXp: number,
//       level: number,
//       wins: number,
//     }>
//   }
// =============================================

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const seasonId = searchParams.get('seasonId')
    const limitParam = searchParams.get('limit')

    if (!seasonId) {
      return NextResponse.json(
        { error: 'Missing required query param: seasonId' },
        { status: 400 }
      )
    }

    const limit = Math.min(
      parseInt(limitParam ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      MAX_LIMIT
    )

    const db = getAdminDb()
    if (!db) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 503 }
      )
    }

    // Fetch top players by XP for the season
    const snap = await db
      .ref(`leaderboard/${seasonId}`)
      .orderByChild('totalXp')
      .limitToLast(limit)
      .get()

    if (!snap.exists()) {
      return NextResponse.json(
        {
          seasonId: Number(seasonId),
          updatedAt: Date.now(),
          entries: [],
        },
        { status: 200 }
      )
    }

    // Firebase returns ascending order — reverse for descending rank
    const entries: Array<{
      rank: number
      walletAddress: string
      username: string
      totalXp: number
      level: number
      wins: number
    }> = []

    snap.forEach((child: { key: string | null; val: () => Record<string, unknown> }) => {
      const data = child.val()
      entries.push({
        rank: 0, // assigned below after sort
        walletAddress: child.key ?? '',
        username: (data.username as string) ?? 'NOMAD',
        totalXp: (data.totalXp as number) ?? 0,
        level: (data.level as number) ?? 1,
        wins: (data.wins as number) ?? 0,
      })
    })

    // Sort descending by totalXp and assign rank
    entries.sort((a, b) => b.totalXp - a.totalXp)
    entries.forEach((entry, i) => {
      entry.rank = i + 1
    })

    return NextResponse.json(
      {
        seasonId: Number(seasonId),
        updatedAt: Date.now(),
        entries,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[leaderboard] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
