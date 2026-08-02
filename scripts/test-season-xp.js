#!/usr/bin/env node
/**
 * test-season-xp.js — the arithmetic that decides who gets paid.
 *
 * OWNER: *"pertimbangan rank skrg sudah bagus belum? mengingat hanya dari xp?"*
 *
 * It was not. XP is cumulative and never resets, so the season prize was being
 * paid off an all-time board: July's winner opened August already 5,926 XP
 * ahead of second place on work that was already finished, and a player joining
 * in September could never have won at all — they start at zero against months
 * of accumulation.
 *
 * A season score is a DELTA, and this covers the three ways that delta can be
 * got wrong, each of which silently pays the wrong person:
 *
 *   - re-deriving the baseline on every write (score resets to 0 constantly),
 *   - baselining on the INCOMING figure at rollover (the first session of the
 *     month vanishes),
 *   - letting it go negative (a player sorts to the bottom of a board they may
 *     be winning).
 *
 *   node scripts/test-season-xp.js
 */
const { execFileSync } = require('child_process')
const fs = require('fs'), path = require('path'), os = require('os')

const out = path.join(os.tmpdir(), 'ns-sxp-' + process.pid + '.cjs')
execFileSync('npx', ['esbuild', 'lib/seasonXp.ts', '--bundle', '--platform=node',
  '--format=cjs', '--log-level=error', '--alias:@=' + path.resolve('.'), '--outfile=' + out],
  { stdio: ['ignore', 'ignore', 'inherit'] })
const S = require(out)

let fails = 0
const ok = (l, c, d) => { console.log((c ? '  ✓ ' : '  ✗ FAIL: ') + l + (d !== undefined ? ' (' + d + ')' : '')); if (!c) fails++ }

const AUG = '202608', JUL = '202607'

// ── a brand-new player ────────────────────────────────────────────────────
ok('a wallet with no row starts the season at zero',
  S.seasonXpFrom(null, 0, AUG) === 0)
ok('and one with no row but existing career XP is baselined where it stands — '
  + 'joining mid-season must not hand you the whole career as a season score',
  S.seasonXpFrom(undefined, 5000, AUG) === 0)

// ── the rollover, which is the entire point ───────────────────────────────
// Rondo's real July figure. On 1 August he must be on zero like everyone else.
const julyVeteran = { xp: 8581, seasonId: JUL, seasonBaseXp: 0 }
ok('July\'s winner starts August on ZERO, not on 8,581',
  S.seasonXpFrom(julyVeteran, 8581, AUG) === 0, String(S.seasonXpFrom(julyVeteran, 8581, AUG)))
ok('and after one August run, only that run counts',
  S.seasonXpFrom(julyVeteran, 8581 + 2000, AUG) === 2000)

// The migration case: every doc that exists today has NO seasonId at all.
const legacy = { xp: 2655 }
ok('a pre-existing doc with no seasonId is baselined at its career total',
  S.seasonBaseline(legacy, 2655, AUG) === 2655)
ok('so nobody carries a head start into the first season under the new rule',
  S.seasonXpFrom(legacy, 2655, AUG) === 0)

// ── the baseline must be STICKY within a season ───────────────────────────
// Re-deriving it on each write is the obvious bug: every sync would reset the
// player's season score to zero and the board would never move.
const midSeason = { xp: 9000, seasonId: AUG, seasonBaseXp: 8581 }
ok('a baseline already taken this season is kept, not re-derived',
  S.seasonBaseline(midSeason, 9000, AUG) === 8581)
ok('so the score keeps climbing across writes', S.seasonXpFrom(midSeason, 9000, AUG) === 419)
ok('and a later write with more XP climbs further',
  S.seasonXpFrom(midSeason, 12000, AUG) === 3419)

// ── the baseline is last season's END, not this write's value ─────────────
// If a player's first sync of the month happens AFTER they have already played,
// baselining on the incoming figure would throw that session away.
const playedBeforeSync = { xp: 8581, seasonId: JUL, seasonBaseXp: 0 }
ok('a first sync that arrives after some play still counts that play',
  S.seasonXpFrom(playedBeforeSync, 8581 + 1500, AUG) === 1500,
  String(S.seasonXpFrom(playedBeforeSync, 8581 + 1500, AUG)))

// ── never negative ────────────────────────────────────────────────────────
// "New Game" restarts a run at 0 XP. Career XP is kept as a high-water mark,
// but a doc written before that rule could hold a baseline above the total.
const stale = { xp: 9000, seasonId: AUG, seasonBaseXp: 9000 }
ok('a career total below the baseline scores 0, never a negative',
  S.seasonXpFrom(stale, 100, AUG) === 0, String(S.seasonXpFrom(stale, 100, AUG)))
ok('which matters because a negative would sort a leader to the very bottom',
  S.seasonXpFrom(stale, 0, AUG) >= 0)

// ── a season id is a string, and must be compared as one ──────────────────
ok('a numeric-looking seasonId from an old doc does not falsely match',
  S.seasonBaseline({ xp: 500, seasonId: 202608, seasonBaseXp: 0 }, 700, AUG) === 500)

// ── two seasons on, the baseline still rolls ──────────────────────────────
const augVeteran = { xp: 20000, seasonId: AUG, seasonBaseXp: 8581 }
ok('September rebaselines off August\'s final career total',
  S.seasonBaseline(augVeteran, 20000, '202609') === 20000)
ok('so each month genuinely starts level', S.seasonXpFrom(augVeteran, 20000, '202609') === 0)

console.log(fails ? `  ${fails} GAGAL` : '  semua lolos')
try { fs.unlinkSync(out) } catch {}
process.exit(fails ? 1 : 0)
