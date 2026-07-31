#!/usr/bin/env node
/**
 * test-season-close.js — freezing a season, against stubbed Firebase.
 *
 * GAME-DESIGN.md §9. The season bonus was entirely manual: the owner had to
 * remember to run deposit-reward.js twice, every month, from memory. Miss it
 * and the claim button is dead for every player with no error anywhere.
 *
 * Owner decision: prepare automatically, the owner still signs. So what this
 * covers is everything up to the signature — and the properties that make an
 * automated preparation safe rather than merely convenient:
 *
 *   - the snapshot is FROZEN once and never re-ranked, because XP keeps moving
 *     after a season ends (it is cumulative and does not reset);
 *   - a cron that fires twice, or a manual re-run, changes nothing;
 *   - marking a season paid is one-way;
 *   - the commands handed to the owner MATCH the CLI's real flags. A pasted
 *     command that errors at 1am is worse than no command, so the flags are
 *     checked against deposit-reward.js's own argument validation rather than
 *     against my memory of it.
 *
 *   node scripts/test-season-close.js
 */
const { execFileSync } = require('child_process')
const fs = require('fs'), path = require('path'), os = require('os')

const out = path.join(os.tmpdir(), 'ns-season-' + process.pid + '.cjs')
execFileSync('npx', ['esbuild', 'lib/server/seasonClose.ts', '--bundle', '--platform=node',
  '--format=cjs', '--log-level=error', '--alias:@=' + path.resolve('.'), '--outfile=' + out],
  { stdio: ['ignore', 'ignore', 'inherit'] })
const S = require(out)

const results = []
const ok = (name, cond, detail) => results.push({ name, ok: !!cond, detail })

// ── stubs: the RTDB tree and the Firestore query the module actually uses ───
function makeDb(tree = {}) {
  const read = (p) => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), tree)
  const write = (p, v) => {
    const parts = p.split('/'); let o = tree
    for (const k of parts.slice(0, -1)) { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k] }
    o[parts[parts.length - 1]] = v
  }
  return {
    tree,
    ref(p) {
      return {
        async get() { const v = read(p); return { val: () => (v === undefined ? null : v), exists: () => v !== undefined } },
        async update(patch) { write(p, Object.assign({}, read(p) || {}, patch)) },
        async remove() {
          const parts = p.split('/')
          const parent = parts.slice(0, -1).reduce((o, k) => (o == null ? undefined : o[k]), tree)
          if (parent) delete parent[parts[parts.length - 1]]
        },
        async transaction(fn) {
          const cur = read(p)
          const next = fn(cur === undefined ? null : cur)
          if (next === undefined) return { committed: false, snapshot: { val: () => (cur === undefined ? null : cur) } }
          write(p, next)
          return { committed: true, snapshot: { val: () => next } }
        },
      }
    },
  }
}
function makeFs(rows) {
  return {
    collection() {
      const state = { rows: rows.slice() }
      const api = {
        orderBy(field, dir) {
          state.rows.sort((a, b) => (dir === 'desc' ? b[field] - a[field] : a[field] - b[field]))
          return api
        },
        limit(n) { state.rows = state.rows.slice(0, n); return api },
        async get() { return { docs: state.rows.map((r) => ({ id: r.walletAddress, data: () => r })) } },
      }
      return api
    },
  }
}

const W = (n) => '0x' + String(n).repeat(40).slice(0, 40)

;(async () => {
  // ── the season arithmetic ─────────────────────────────────────────────
  ok('previous season inside a year', S.previousSeasonId(202607) === 202606)
  ok('previous season across the year boundary', S.previousSeasonId(202601) === 202512,
    String(S.previousSeasonId(202601)))

  // ── freezing ──────────────────────────────────────────────────────────
  const rows = [
    { walletAddress: W(1), username: 'alpha', xp: 9000 },
    { walletAddress: W(2), username: 'bravo', xp: 7000 },
    { walletAddress: W(3), username: 'charlie', xp: 5000 },
    { walletAddress: W(4), username: 'delta', xp: 3000 },
  ]
  const db = makeDb()
  const first = await S.prepareSeason(db, makeFs(rows), 202607)
  ok('the first run freezes the season', first.created === true)
  ok('three winners, in XP order',
    first.snapshot.winners.map((w) => w.username).join(',') === 'alpha,bravo,charlie',
    first.snapshot.winners.map((w) => w.username).join(','))
  ok('ranks are 1,2,3', first.snapshot.winners.map((w) => w.rank).join(',') === '1,2,3')
  ok('rewards are $20/$5/$3', first.snapshot.winners.map((w) => w.rewardUsd).join(',') === '20,5,3')
  ok('it is not marked paid', first.snapshot.paidAt === null)

  // ── the property that matters most ────────────────────────────────────
  // XP does not reset between seasons, so re-reading later gives a different
  // answer. The frozen snapshot must win.
  const movedOn = [
    { walletAddress: W(4), username: 'delta', xp: 99000 },   // played on after the season
    { walletAddress: W(1), username: 'alpha', xp: 9000 },
    { walletAddress: W(2), username: 'bravo', xp: 7000 },
    { walletAddress: W(3), username: 'charlie', xp: 5000 },
  ]
  const second = await S.prepareSeason(db, makeFs(movedOn), 202607)
  ok('a second run changes nothing', second.created === false)
  ok('and the winners are still the ones frozen at closing time',
    second.snapshot.winners.map((w) => w.username).join(',') === 'alpha,bravo,charlie',
    second.snapshot.winners.map((w) => w.username).join(','))

  // ── status ────────────────────────────────────────────────────────────
  const julyNoon = Date.parse('2026-08-15T12:00:00Z')   // season 202608, so 202607 has closed
  const status = await S.readSeasonStatus(db, julyNoon)
  ok('status names the season being played', status.currentSeasonId === 202608, String(status.currentSeasonId))
  ok('and the one that can be paid', status.lastClosedSeasonId === 202607, String(status.lastClosedSeasonId))
  ok('a frozen, unpaid season reads as awaiting payout', status.awaitingPayout === true)

  // ── marking paid ──────────────────────────────────────────────────────
  const paid = await S.markSeasonPaid(db, 202607, '0xdeadbeef')
  ok('marking paid records the time', typeof paid.paidAt === 'number' && paid.paidAt > 0)
  ok('and the note', paid.paidNote === '0xdeadbeef')
  const paidAgain = await S.markSeasonPaid(db, 202607, 'second attempt')
  ok('marking it twice keeps the FIRST record', paidAgain.paidNote === '0xdeadbeef')
  const after = await S.readSeasonStatus(db, julyNoon)
  ok('and it no longer awaits payout', after.awaitingPayout === false)
  ok('marking a season that never closed reports nothing to mark',
    (await S.markSeasonPaid(db, 209912)) === null)

  // ── the handover: the commands must actually run ──────────────────────
  const cmds = S.payoutCommands(first.snapshot)
  ok('two commands: publish, then fund', cmds.length === 2)
  const cli = fs.readFileSync(path.join(__dirname, 'deposit-reward.js'), 'utf8')
  // deposit-reward.js validates args.p1..p3 and args.s1..s3 for
  // update-leaderboard, and args.season/args.amount for season-deposit. If it
  // ever renames those, the pasted command breaks silently — so assert against
  // the script's own source rather than against memory.
  const publish = cmds[0]
  ok('publish command names the right subcommand', /update-leaderboard/.test(publish))
  for (const flag of ['p1', 'p2', 'p3', 's1', 's2', 's3']) {
    ok(`deposit-reward.js still reads --${flag}`, cli.includes('args.' + flag))
    ok(`and the generated command passes --${flag}`, publish.includes('--' + flag + ' '))
  }
  ok('publish carries the winners in order',
    publish.indexOf(W(1)) < publish.indexOf(W(2)) && publish.indexOf(W(2)) < publish.indexOf(W(3)))
  ok('publish carries their scores', /--s1 9000/.test(publish) && /--s3 5000/.test(publish))
  // The fund command got the same treatment as the publish one only after an
  // audit found it BROKEN: it omitted --token, and resolveToken() in that
  // script dies with "missing --token" rather than defaulting — so the second
  // line handed to the owner failed the moment it was pasted. Checking one
  // command's flags and not the other is how that survived being "tested".
  const fund = cmds[1]
  ok('fund command names the right subcommand', /season-deposit/.test(fund))
  ok('fund command totals the three prizes ($28)', /--amount 28/.test(fund))
  ok('deposit-reward.js REQUIRES --token (it dies without one)',
    /function resolveToken/.test(cli) && /missing --token/.test(cli))
  ok('so the fund command passes --token', /--token \w+/.test(fund), fund.match(/--token \w+/)?.[0])
  ok('and --season', /--season \d{6}/.test(fund))
  // Every flag season-deposit validates must be present. Same source-of-truth
  // check as the publish command: read the script, do not trust memory.
  for (const flag of ['season', 'token', 'amount']) {
    ok(`season-deposit still reads args.${flag}`, cli.includes('args.' + flag))
  }

  // ── a thin leaderboard must not produce a half payout ─────────────────
  const thin = makeDb()
  const small = await S.prepareSeason(thin, makeFs(rows.slice(0, 2)), 202605)
  ok('two players yield two winners, not three padded ones', small.snapshot.winners.length === 2)
  ok('and no commands are offered for an incomplete top 3', S.payoutCommands(small.snapshot).length === 0)

  // ── malformed rows are dropped, not paid ──────────────────────────────
  const dirty = makeDb()
  const withJunk = await S.prepareSeason(dirty, makeFs([
    { walletAddress: 'not-a-wallet', username: 'junk', xp: 99999 },
    ...rows,
  ]), 202604)
  ok('a malformed wallet never becomes a winner',
    withJunk.snapshot.winners.every((w) => /^0x[a-f0-9]{40}$/.test(w.wallet)),
    JSON.stringify(withJunk.snapshot.winners.map((w) => w.wallet)))
  ok('and the top 3 is still full', withJunk.snapshot.winners.length === 3)

  // ── pruning finished buckets ──────────────────────────────────────────
  // Added after the audit noted nothing ever deleted the daily/weekly rows.
  // The dangerous mistake here is not leaving data behind, it is deleting the
  // wrong data — /api/stats counts LIFETIME totals out of paperClaims,
  // goldenKeyClaims and vaultCompleted, and pruning those would make the public
  // page show players leaving when really rows were removed.
  const NOW = Date.parse('2026-07-31T12:00:00Z')
  ok('a bucket from today is never stale', S.isStaleDayKey('2026-07-31', NOW) === false)
  ok('nor one from yesterday', S.isStaleDayKey('2026-07-30', NOW) === false)
  ok('nor one just inside the keep window', S.isStaleDayKey('2026-07-02', NOW) === false)
  ok('but one well past it is', S.isStaleDayKey('2026-05-01', NOW) === true)
  ok('a key of an unrecognised shape is NEVER stale', S.isStaleDayKey('garbage', NOW) === false)
  ok('and neither is an empty one', S.isStaleDayKey('', NOW) === false)
  ok('this week is never stale', S.isStaleWeekKey('202631', '202631') === false)
  ok('nor eight weeks back', S.isStaleWeekKey('202623', '202631') === false)
  ok('but twenty weeks back is', S.isStaleWeekKey('202611', '202631') === true)
  ok('a malformed week key is never stale', S.isStaleWeekKey('20263', '202631') === false)

  {
    const db = makeDb({
      dailyContracts: { '2026-05-01': { [W]: { k: 1 } }, '2026-07-31': { [W]: { k: 2 } } },
      dailyContractClaims: { '2026-05-01': { [W]: true } },
      passPerkClaims: { '2026-05-01': { [W]: true } },
      vaultFragments: { '202611': { [W]: 9 }, '202631': { [W]: 4 } },
      // Everything below is read by /api/stats for lifetime totals.
      paperClaims: { '202611': { [W]: { claimedAt: 1 } } },
      goldenKeyClaims: { '202611': { [W]: { claimedAt: 1 } } },
      vaultCompleted: { '202611': { [W]: { at: 1 } } },
      playerProfiles: { [W]: { nullstateTokenBalance: 500 } },
    })
    const { removed } = await S.prune(db, NOW, '202631')
    ok('finished daily buckets are removed', !db.tree.dailyContracts['2026-05-01'])
    ok('today\'s bucket is untouched', !!db.tree.dailyContracts['2026-07-31'])
    ok('finished weekly fragments are removed', !db.tree.vaultFragments['202611'])
    ok('this week\'s fragments are untouched', db.tree.vaultFragments['202631'][W] === 4)
    ok('claim gates and perk claims are pruned too',
      !db.tree.dailyContractClaims['2026-05-01'] && !db.tree.passPerkClaims['2026-05-01'])
    // The assertions that matter most.
    ok('paperClaims are NEVER pruned — /api/stats counts them forever',
      !!db.tree.paperClaims['202611'])
    ok('nor goldenKeyClaims', !!db.tree.goldenKeyClaims['202611'])
    ok('nor vaultCompleted', !!db.tree.vaultCompleted['202611'])
    ok('nor anything that is not a dated bucket at all', !!db.tree.playerProfiles[W])
    ok('and it reports what it removed', removed.length === 4, removed.join(', '))
  }
  {
    const db = makeDb({})
    const { removed } = await S.prune(db, NOW, '202631')
    ok('pruning an empty database is harmless', removed.length === 0)
  }

  let failed = 0
  for (const t of results) {
    if (t.ok) console.log('  ✓ ' + t.name)
    else { failed++; console.log('  ✗ ' + t.name + (t.detail ? ' — ' + t.detail : '')) }
  }
  console.log(`  ${results.length - failed}/${results.length} lolos`)
  try { fs.unlinkSync(out) } catch {}
  process.exit(failed ? 1 : 0)
})().catch((e) => { try { fs.unlinkSync(out) } catch {}; console.error('ERROR', e); process.exit(2) })
