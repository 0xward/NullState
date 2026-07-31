import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminFirestore } from '@/firebase-config'
import { prepareSeason, previousSeasonId, payoutCommands } from '@/lib/server/seasonClose'
import { getCurrentSeasonId } from '@/lib/web3-client'

export const dynamic = 'force-dynamic'

// =============================================
// SEASON CLOSE — the cron half of GAME-DESIGN.md §9
//
// GET /api/cron/season   (Vercel Cron, 01:00 UTC on the 1st of each month)
//
// Freezes the ranking for the season that just ended, so the owner can pay it
// without deciding anything. Writes ONE record — seasonSnapshots/{seasonId} —
// and moves no money.
//
// WHY A GET. Vercel Cron issues GET requests and nothing else, and authenticates
// them by sending `Authorization: Bearer $CRON_SECRET`. So the verb is not a
// design choice; what makes it safe is that the work is idempotent by
// construction: prepareSeason() aborts its write if a snapshot already exists,
// so a re-run — a retry, a manual curl, a duplicate schedule — can never
// re-rank winners the owner has already read.
//
// It fails CLOSED when CRON_SECRET is unset: an unauthenticated caller must not
// be able to freeze a ranking early. Running it by hand is
//
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/season
//
// which is also the recovery path if a scheduled run is ever missed — the
// snapshot is taken from live XP, so a late run still produces the right answer
// as long as it is the first one.
// =============================================

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
    }
    if (req.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getAdminDb()
    const fs = getAdminFirestore()
    if (!db || !fs) {
      return NextResponse.json({ error: 'Season service unavailable' }, { status: 503 })
    }

    // The season that just ended, not the one being played.
    const seasonId = previousSeasonId(getCurrentSeasonId())
    const { snapshot, created } = await prepareSeason(db, fs, seasonId)

    if (created) {
      // The one line an operator reads in the log. Named winners, because a
      // payout that goes to the wrong wallet is the failure that matters and
      // this is the last cheap chance to notice it.
      console.log('[cron/season] froze season ' + seasonId + ': '
        + snapshot.winners.map((w) => `#${w.rank} ${w.wallet} (${w.xp} xp, $${w.rewardUsd})`).join(' · '))
    }

    return NextResponse.json({
      seasonId,
      created,
      snapshot,
      commands: payoutCommands(snapshot),
      note: created
        ? 'Season frozen. Run the commands above, then POST /api/season/status to mark it paid.'
        : 'Already frozen — nothing changed.',
    }, { status: 200 })
  } catch (error) {
    console.error('[cron/season] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
