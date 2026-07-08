import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'

// =============================================
// VAULT STATUS
// GET /api/vault/status?weekId=&walletAddress=
//
// Response:
//   {
//     weekId: number,
//     isActive: boolean,
//     attempts: number,
//     maxAttempts: number,
//     attemptsRemaining: number,
//     completed: boolean,
//     completedAt?: number,
//   }
// =============================================

const MAX_ATTEMPTS = 3

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const weekId = searchParams.get('weekId')
    const walletAddress = searchParams.get('walletAddress')

    if (!weekId || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required query params: weekId, walletAddress' },
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

    const [attemptsSnap, completedSnap, codeSnap] = await Promise.all([
      db.ref(`vaultAttempts/${weekId}/${walletAddress}`).get(),
      db.ref(`vaultCompleted/${weekId}/${walletAddress}`).get(),
      db.ref(`vaultCodes/${weekId}`).get(),
    ])

    const attempts: number = attemptsSnap.val() ?? 0
    const completedData = completedSnap.val() as {
      completedAt: number
      attempts: number
    } | null
    const isActive = codeSnap.exists()

    return NextResponse.json(
      {
        weekId: Number(weekId),
        isActive,
        attempts,
        maxAttempts: MAX_ATTEMPTS,
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - attempts),
        completed: !!completedData,
        ...(completedData ? { completedAt: completedData.completedAt } : {}),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[vault/status] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
