#!/usr/bin/env node
/**
 * test-streak-ui.js — the login streak on the map, driven in a real browser.
 *
 * GAME-DESIGN.md §5.3. The day-boundary logic is covered without a browser by
 * `npm run test:streak`; this covers the WIRING that a unit test cannot:
 *
 *   - the map POSTs the streak on mount (opening the app IS the event — there
 *     is no claim button, matching the decision Daily Contracts already made),
 *   - the chip renders FIRST, because it is the one number on the bar the
 *     player can lose and loss aversion needs it in front of them,
 *   - the reward is announced once, on the visit that earned it, and can be
 *     dismissed,
 *   - a streak of 0 (a wallet that has never visited, or Firebase not
 *     configured) renders no chip at all rather than a "0" nobody can read.
 *
 *   npm run build && npx next start -p 3178 &
 *   node scripts/test-streak-ui.js
 *
 * Requires playwright-core and a Chromium at CHROME_PATH.
 */
const { chromium } = require('playwright-core')
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3178'
const W = '0x5555555555555555555555555555555555555555'
let fails = 0
const ok = (l, c) => { console.log((c ? '  ✓ ' : '  ✗ FAIL: ') + l); if (!c) fails++ }

// The sandbox has no Firebase admin, so every status route degrades to empty.
// Fixture them so the bar has something true to render.
function baseRoutes(page) {
  page.route('**/api/energy?**', r => r.fulfill({ json: { freeRemaining: 4, bonus: 0, total: 4, resetAt: Date.now() + 3.6e6 } }))
  page.route('**/api/vault/fragments?**', r => r.fulfill({ json: { fragments: 5, nextGoal: { key: 'paper', threshold: 8, label: 'Old Paper' } } }))
  page.route('**/api/weapons/craft?**', r => r.fulfill({ json: { craft: null, serverNow: Date.now() } }))
  page.route('**/api/contracts?**', r => r.fulfill({ json: { dayId: '2026-07-31', nextResetAt: Date.now() + 7.2e6, completed: 0, contracts: [] } }))
}

async function openMap(page) {
  await page.addInitScript(w => {
    localStorage.setItem('nullstate-guest-id', w)
    localStorage.setItem('ns-howto-seen', '1')
    localStorage.setItem('nullstate-signin-skipped', '1')
  }, W)
  await page.goto(BASE + '/game', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ns-hub-map', { timeout: 60000 })
  await page.waitForTimeout(2500)
}

;(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })

  // ── case 1: day 3, freshly granted ────────────────────────────────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    baseRoutes(page)
    let posted = null
    await page.route('**/api/streak', async (r) => {
      posted = r.request().postDataJSON()
      await r.fulfill({ json: {
        dayId: '2026-07-31', nextResetAt: Date.now() + 7.2e6,
        streak: 3, best: 8, day: 3, claimedToday: true,
        today: { kind: 'energy', amount: 1 },
        tomorrow: { kind: 'shard', tier: 't1', amount: 3 },
        granted: { kind: 'energy', amount: 1 },
        grantedLabel: '+1 energy',
      } })
    })
    await openMap(page)

    ok('the map registers the visit with a POST', !!posted)
    ok('and sends the player id', posted && String(posted.wallet || '').toLowerCase() === W)

    const chips = await page.$$eval('.ns-hub-chip', e => e.map(x => x.textContent.trim()))
    ok('the streak chip renders (' + chips.join(' ') + ')', chips.some(c => c.includes('3')))
    ok('and renders FIRST — it is the one thing that can be lost', /3$/.test(chips[0] || ''))

    const note = await page.$('.ns-hub-streak-note')
    ok('the reward is announced', !!note)
    const noteText = note ? (await note.textContent()).trim() : ''
    ok('naming the day and what it paid (' + noteText + ')', /Day 3/.test(noteText) && /\+1 energy/.test(noteText))

    // Granted energy is added to the chip in the same breath, or the bar would
    // show yesterday's number until the next mount.
    const energyChip = chips.find(c => c.includes('⚡')) || ''
    ok('the energy chip already includes the granted run (' + energyChip + ')', energyChip.includes('5'))

    await page.click('.ns-hub-streak-note')
    await page.waitForTimeout(250)
    ok('and it can be dismissed', !(await page.$('.ns-hub-streak-note')))
    await page.context().close()
  }

  // ── case 2: already counted today — chip yes, announcement no ─────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    baseRoutes(page)
    await page.route('**/api/streak', r => r.fulfill({ json: {
      streak: 6, best: 9, day: 6, claimedToday: true,
      today: { kind: 'shard', tier: 't1', amount: 4 },
      tomorrow: { kind: 'shard', tier: 't1', amount: 8 },
      granted: null, grantedLabel: null,
    } }))
    await openMap(page)
    const chips = await page.$$eval('.ns-hub-chip', e => e.map(x => x.textContent.trim()))
    ok('a second visit the same day still shows the chip', chips.some(c => c.includes('6')))
    ok('but announces nothing', !(await page.$('.ns-hub-streak-note')))
    const title = await page.$eval('.ns-hub-chip', e => e.getAttribute('title'))
    ok('the chip says what tomorrow is worth (' + (title || '').slice(0, 60) + '…)', /tomorrow/i.test(title || ''))
    ok('and what is at stake', /back to 1/i.test(title || ''))
    await page.context().close()
  }

  // ── case 3: day 7 reads differently ───────────────────────────────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    baseRoutes(page)
    await page.route('**/api/streak', r => r.fulfill({ json: {
      streak: 7, best: 7, day: 7, claimedToday: true,
      today: { kind: 'shard', tier: 't1', amount: 8 },
      tomorrow: { kind: 'point', amount: 80 },
      granted: { kind: 'shard', tier: 't1', amount: 8 }, grantedLabel: '+8 Glitch Shard T1',
    } }))
    await openMap(page)
    const first = await page.$eval('.ns-hub-chip', e => ({ text: e.textContent.trim(), cls: e.className }))
    ok('day 7 is marked as the payoff (' + first.text + ')', first.cls.includes('is-ready'))
    const note = await page.textContent('.ns-hub-streak-note').catch(() => '')
    ok('and announces the 8 shards (' + (note || '').trim() + ')', /\+8 Glitch Shard T1/.test(note || ''))
    await page.context().close()
  }

  // ── case 4: no streak yet — nothing at all ────────────────────────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    baseRoutes(page)
    await page.route('**/api/streak', r => r.fulfill({ json: {
      streak: 0, best: 0, day: 1, claimedToday: false,
      today: { kind: 'point', amount: 80 }, tomorrow: { kind: 'shard', tier: 't1', amount: 2 },
      granted: null, grantedLabel: null,
    } }))
    await openMap(page)
    const chips = await page.$$eval('.ns-hub-chip', e => e.map(x => x.textContent.trim()))
    ok('a streak of 0 renders no chip — never a "0" nobody can read',
      !chips.some(c => /🔥|★/.test(c)))
    ok('the other chips are unaffected (' + chips.join(' ') + ')', chips.length === 2)
    await page.context().close()
  }

  await b.close()
  console.log(fails ? `  ${fails} GAGAL` : '  semua lolos')
  process.exit(fails ? 1 : 0)
})().catch(e => { console.error('ERROR', e.message); process.exit(2) })
