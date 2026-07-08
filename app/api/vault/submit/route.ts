import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'

// =============================================
// VAULT SUBMIT
// POST /api/vault/submit
//
// Body: { walletAddress: string, weekId: number, code: string }
//
// Response:
//   { success: true,  isCorrect: true,  message: string, attempts: number }
//   { success: false, isCorrect: false, message: string, attemptsRemaining: number }
// =============================================

const MAX_ATTEMPTS = 3

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { walletAddress, weekId, code } = body as {
      walletAddress?: string
      weekId?: number
      code?: string
    }

    if (!walletAddress || !weekId || !code) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, weekId, code' },
        { status: 400 }
      )
    }

    if (!/^\d{4}$/.test(code)) {
      return NextResponse.json(
        { error: 'Code must be exactly 4 digits' },
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

    // Fetch correct vault code for the week
    const codeSnap = await db.ref(`vaultCodes/${weekId}`).get()
    if (!codeSnap.exists()) {
      return NextResponse.json(
        { error: 'Vault code not found for this week' },
        { status: 404 }
      )
    }
    const correctCode: string = codeSnap.val().code

    // Read existing attempts
    const attemptsRef = db.ref(`vaultAttempts/${weekId}/${walletAddress}`)
    const attemptsSnap = await attemptsRef.get()
    const prevAttempts: number = attemptsSnap.val() ?? 0

    if (prevAttempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        {
          success: false,
          isCorrect: false,
          message: 'All attempts used. Try again next week.',
          attemptsRemaining: 0,
        },
        { status: 200 }
      )
    }

    const attempts = prevAttempts + 1
    await attemptsRef.set(attempts)

    const isCorrect = code === correctCode

    if (isCorrect) {
      await db.ref(`vaultCompleted/${weekId}/${walletAddress}`).set({
        completedAt: Date.now(),
        attempts,
      })

      return NextResponse.json(
        {
          success: true,
          isCorrect: true,
          message: 'Correct code! Vault unlocked.',
          attempts,
        },
        { status: 200 }
      )
    }

    const attemptsRemaining = MAX_ATTEMPTS - attempts
    return NextResponse.json(
      {
        success: false,
        isCorrect: false,
        message:
          attemptsRemaining > 0
            ? `Wrong code! ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`
            : 'Wrong code! All attempts used.',
        attemptsRemaining,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[vault/submit] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
