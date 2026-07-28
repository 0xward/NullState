import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'

// ─── Register a player the moment they open the game ─────────────────────────
// Owner: "anyone who clicks Play Game should get an id and count as a total
// player straight away."
//
// They already got an id — the wallet, or a random guest id in localStorage —
// but nothing recorded it. /api/stats counts a player by finding their id
// somewhere in the Realtime Database, and the earliest thing that wrote there
// was the energy record created by STARTING A RUN. So everyone who opened the
// game, looked at the map, and left was invisible: they existed on their own
// device and nowhere else.
//
// (/api/player/identity does fire on boot and does write — but to FIRESTORE,
// a different database from the one the stats route reads. That is why it
// never closed this gap.)
//
// This route writes one small node per player and nothing else:
//
//   players/{id} = { firstSeen, lastSeen, guest }
//
// `firstSeen` is written once and never overwritten, so the acquisition date
// survives every later visit. `lastSeen` moves every session, which finally
// gives DAU/WAU/MAU a real "opened the game" signal instead of inferring
// activity from whatever gameplay side effect happened to leave a timestamp.
//
// `guest` is the field that makes the player count mean something. A guest id
// is 20 random bytes formatted as an address — indistinguishable from a real
// wallet by shape alone — so until now "24 players" could not be split into
// people and duplicate browsers. It cannot classify ids recorded before today,
// but from here the distinction is kept.
//
// No authentication, on purpose, and it is safe not to have any: the route
// writes only three fields under a caller-supplied id, moves no value, grants
// nothing, and reads nothing back. The worst a spammer achieves is inflating a
// number on a public dashboard — which is why `guest` is recorded rather than
// trusted, and why the stats page reports the paying count separately as the
// figure that cannot be faked.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const id = String(body?.wallet || '').toLowerCase()
    // Guest ids are generated with the same 20-byte shape as a wallet, so one
    // pattern covers both. Anything else is not something we minted.
    if (!/^0x[a-f0-9]{40}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const guest = body?.guest === true

    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })

    const now = Date.now()
    const ref = db.ref(`players/${id}`)
    // A transaction rather than a read-then-write: two tabs opening at once
    // must not race each other into overwriting firstSeen.
    const res = await ref.transaction((cur: { firstSeen?: number } | null) => ({
      firstSeen: cur?.firstSeen || now,
      lastSeen: now,
      guest,
    }))

    const val = res.snapshot?.val() as { firstSeen?: number } | null
    return NextResponse.json({ ok: true, isNew: (val?.firstSeen ?? now) === now })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to record player'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
