import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { getISOWeekId } from '@/lib/web3-client'
import { getAttemptsRemaining, parseWeekId, normalizeWalletAddress } from '@/lib/vault-utils'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const walletAddress = String(searchParams.get('walletAddress') ?? '').trim()
    const weekIdInput = searchParams.get('weekId') ?? String(getISOWeekId())

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 })
    }

    const weekId = parseWeekId(weekIdInput)
    const normalizedWallet = normalizeWalletAddress(walletAddress)

    const db = getAdminDb()
    if (!db) {
      return NextResponse.json({ error: 'Firebase Admin is not configured on the server' }, { status: 503 })
    }

    const [attemptsSnap, solvedSnap] = await Promise.all([
      db.ref(`vaultAttempts/${weekId}/${normalizedWallet}`).get(),
      db.ref(`vaultCompleted/${weekId}/${normalizedWallet}`).get(),
    ])

    const attemptsUsed = Number(attemptsSnap.val() ?? 0)
    const isUnlocked = solvedSnap.exists()

    return NextResponse.json({
      weekId,
      attemptsUsed,
      attemptsRemaining: isUnlocked ? 0 : getAttemptsRemaining(attemptsUsed),
      isUnlocked,
      isLocked: !isUnlocked && attemptsUsed >= 3,
      unlockedAt: isUnlocked ? solvedSnap.val()?.completedAt ?? null : null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Invalid weekId' ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
