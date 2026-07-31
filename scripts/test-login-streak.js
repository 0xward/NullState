#!/usr/bin/env node
/**
 * test-login-streak.js — the day-boundary logic, against a stubbed RTDB.
 *
 * GAME-DESIGN.md §5.3. A streak is entirely about what happens BETWEEN days,
 * which is the one thing a browser test cannot exercise: it would have to wait
 * for midnight UTC. So this drives the real module with an injected clock and a
 * fake database that models the RTDB tree, and checks the three transitions
 * that matter — continue, repeat, break — plus the grants they owe.
 *
 * The module takes its `db` as a parameter, so nothing is monkeypatched here;
 * the code under test is exactly the code that runs in production.
 *
 *   node scripts/test-login-streak.js
 *
 * Requires esbuild (already a dependency of the toolchain).
 */
const { execFileSync } = require('child_process')
const fs = require('fs'), path = require('path'), os = require('os')

const out = path.join(os.tmpdir(), 'ns-streak-' + process.pid + '.cjs')
execFileSync('npx', ['esbuild', 'lib/server/loginStreak.ts',
  '--bundle', '--platform=node', '--format=cjs', '--log-level=error',
  '--external:@/firebase-config',
  '--alias:@=' + path.resolve('.'),
  '--outfile=' + out], { stdio: ['ignore', 'ignore', 'inherit'] })
const S = require(out)

// ── a fake RTDB: paths, transactions, and the same value semantics ──────────
function makeDb() {
  const tree = {}
  const read = (p) => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), tree)
  const write = (p, v) => {
    const parts = p.split('/')
    let o = tree
    for (const k of parts.slice(0, -1)) { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k] }
    o[parts[parts.length - 1]] = v
  }
  return {
    tree,
    ref(p) {
      return {
        async get() { const v = read(p); return { val: () => (v === undefined ? null : v), exists: () => v !== undefined } },
        async transaction(fn) {
          const cur = read(p)
          const next = fn(cur === undefined ? null : cur)
          // RTDB semantics: returning undefined ABORTS the transaction.
          if (next === undefined) return { committed: false, snapshot: { val: () => (cur === undefined ? null : cur) } }
          write(p, next)
          return { committed: true, snapshot: { val: () => next } }
        },
      }
    },
  }
}

const results = []
const ok = (name, cond, detail) => results.push({ name, ok: !!cond, detail })

const W = '0x1111111111111111111111111111111111111111'
const DAY = 86400000
// A fixed noon-UTC anchor so no assertion here can straddle a real midnight.
const d = (n) => Date.parse('2026-07-01T12:00:00Z') + n * DAY

;(async () => {
  // ── the ladder itself ─────────────────────────────────────────────────
  ok('ladder is seven days', S.STREAK_LENGTH === 7)
  ok('day 7 pays exactly one weapon evolution (8 t1)',
    S.STREAK_LADDER[6].kind === 'shard' && S.STREAK_LADDER[6].tier === 't1' && S.STREAK_LADDER[6].amount === 8)
  ok('no reward is a tier the early game cannot earn (t2/t3 are act-gated)',
    S.STREAK_LADDER.every((r) => r.kind !== 'shard' || r.tier === 't1'))
  ok('the ladder wraps: day 8 pays what day 1 pays', S.ladderDay(8) === 1 && S.ladderDay(15) === 1)
  ok('and day 14 is another day 7', S.ladderDay(14) === 7)

  // ── day 1 ─────────────────────────────────────────────────────────────
  const db = makeDb()
  let s = await S.touchStreak(db, W, d(0))
  ok('first visit starts the streak at 1', s.streak === 1, 'streak=' + s.streak)
  ok('and pays day 1', s.granted && s.granted.kind === 'point' && s.granted.amount === 80)
  ok('the Point actually landed', db.tree.playerProfiles[W].nullstateTokenBalance === 80)

  // ── same day again ────────────────────────────────────────────────────
  s = await S.touchStreak(db, W, d(0) + 3600000)
  ok('a second visit the same day does NOT advance it', s.streak === 1, 'streak=' + s.streak)
  ok('and pays nothing', s.granted === null)
  ok('the balance did not move', db.tree.playerProfiles[W].nullstateTokenBalance === 80)

  // ── consecutive days ──────────────────────────────────────────────────
  s = await S.touchStreak(db, W, d(1))
  ok('the next day continues to 2', s.streak === 2)
  ok('and pays day 2 (2 t1 shards)', s.granted.kind === 'shard' && s.granted.amount === 2)
  ok('the shards actually landed', db.tree.materials[W].t1 === 2)

  s = await S.touchStreak(db, W, d(2))
  ok('day 3 pays energy', s.granted.kind === 'energy' && s.granted.amount === 1)
  ok('energy is credited as a RECORD, not a bare number',
    db.tree.energy[W] && typeof db.tree.energy[W] === 'object' && db.tree.energy[W].bonus === 1,
    JSON.stringify(db.tree.energy[W]))

  for (let i = 3; i <= 5; i++) await S.touchStreak(db, W, d(i))
  s = await S.touchStreak(db, W, d(6))
  ok('seven consecutive days reaches 7', s.streak === 7)
  ok('day 7 pays the 8 t1 shards', s.granted.kind === 'shard' && s.granted.amount === 8)
  ok('total t1 for a perfect week is 17', db.tree.materials[W].t1 === 17, 't1=' + db.tree.materials[W].t1)

  // ── the wrap ──────────────────────────────────────────────────────────
  s = await S.touchStreak(db, W, d(7))
  ok('day 8 keeps counting up', s.streak === 8)
  ok('but pays the day-1 rung again', s.granted.kind === 'point' && s.granted.amount === 80)

  // ── the break, which is the whole point ───────────────────────────────
  s = await S.touchStreak(db, W, d(10))          // skipped d(8) and d(9)
  ok('missing a day resets to 1', s.streak === 1, 'streak=' + s.streak)
  ok('and pays day 1 again', s.granted.kind === 'point' && s.granted.amount === 80)
  ok('but the best is remembered', s.best === 8, 'best=' + s.best)

  // ── a read must never advance anything ────────────────────────────────
  const before = JSON.stringify(db.tree.loginStreak[W])
  const r = await S.readStreak(db, W, d(10))
  ok('reading does not touch the record', JSON.stringify(db.tree.loginStreak[W]) === before)
  ok('and reports today as already claimed', r.claimedToday === true)

  // ── a streak read the day AFTER, before visiting ──────────────────────
  const r2 = await S.readStreak(db, W, d(11))
  ok('the day after, the bar shows what today WOULD pay', r2.claimedToday === false && r2.day === 2,
    'day=' + r2.day)
  const r3 = await S.readStreak(db, W, d(13))
  ok('two days later the streak reads as broken', r3.streak === 0 && r3.day === 1,
    'streak=' + r3.streak + ' day=' + r3.day)

  // ── wallets are independent ───────────────────────────────────────────
  const W2 = '0x2222222222222222222222222222222222222222'
  const s2 = await S.touchStreak(db, W2, d(10))
  ok('another wallet starts at its own day 1', s2.streak === 1)
  ok('and did not disturb the first', db.tree.loginStreak[W].streak === 1)

  // ── a failed grant must not hand out a free retry ─────────────────────
  const brittle = makeDb()
  const realRef = brittle.ref.bind(brittle)
  brittle.ref = (p) => (p.startsWith('playerProfiles/')
    ? { async transaction() { throw new Error('credit exploded') }, async get() { return { val: () => null, exists: () => false } } }
    : realRef(p))
  const bad = await S.touchStreak(brittle, W, d(0))
  ok('a grant that throws still counts the day (no re-claim loop)',
    brittle.tree.loginStreak[W].lastDayId === '2026-07-01' && bad.granted === null)

  let failed = 0
  for (const t of results) {
    if (t.ok) console.log('  ✓ ' + t.name + (t.detail ? ' (' + t.detail + ')' : ''))
    else { failed++; console.log('  ✗ ' + t.name + (t.detail ? ' — ' + t.detail : '')) }
  }
  console.log(`  ${results.length - failed}/${results.length} lolos`)
  try { fs.unlinkSync(out) } catch {}
  process.exit(failed ? 1 : 0)
})().catch((e) => { try { fs.unlinkSync(out) } catch {}; console.error('ERROR', e); process.exit(2) })
