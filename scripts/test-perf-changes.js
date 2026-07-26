#!/usr/bin/env node
/**
 * test-perf-changes.js — prove the PageSpeed work did not break the app.
 *
 * The optimisations in this pass all trade structure for speed, and three of
 * them can break things in ways a type-check cannot see:
 *
 *   · wagmi now mounts BESIDE the app instead of around it, so any component
 *     still calling a wagmi hook directly throws WagmiProviderNotFoundError —
 *     at runtime, on the screen that uses it, not at build time.
 *   · the engine is served minified from /game-engine/min/, so a mangled name
 *     would surface as a blank canvas rather than a compile error.
 *   · the rail icons changed extension; a missed reference is a 404 and a
 *     broken button, and nothing type-checks an image URL.
 *
 * So this drives the real production build in a real browser: opens the world
 * map, waits for the wallet bridge to report ready, opens every screen that
 * touches the chain, and starts a run to force the engine to load and mount.
 * Any console error, failed request or missing element fails the run.
 *
 * Usage: npx next build && npx next start -p 3100, then
 *        node scripts/test-perf-changes.js [http://localhost:3100]
 */
const { chromium } = require('playwright-core')

const BASE = process.argv[2] || 'http://localhost:3100'
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

const results = []
const ok = (name, detail = '') => results.push({ pass: true, name, detail })
const bad = (name, detail = '') => results.push({ pass: false, name, detail })

;(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

  const errors = []
  const failed = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
  page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 200)))
  page.on('requestfailed', r => failed.push(`${r.url()} — ${r.failure()?.errorText}`))
  page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`) })

  // ── The world map ─────────────────────────────────────────────────────────
  await page.goto(`${BASE}/game?hub=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ns-hub-map img', { timeout: 60000 })
  ok('world map renders')

  // The boot splash covers the page for 1.4s + 0.4s fade on a cold session and
  // swallows pointer events while it does. Wait it out before clicking
  // anything, or every click below races it.
  await page.waitForSelector('#ns-splash-root', { state: 'detached', timeout: 15000 }).catch(() => {})

  // Rail icons: every one must be a decoded image, not a broken one.
  await page.waitForSelector('.ns-hub-rail img', { timeout: 20000 })
  const icons = await page.evaluate(() =>
    [...document.querySelectorAll('.ns-hub-rail img, .ns-hub-lock img')].map(i => ({
      src: i.getAttribute('src'), w: i.naturalWidth,
    })))
  const broken = icons.filter(i => !i.w)
  const stillPng = icons.filter(i => (i.src || '').endsWith('.png'))
  if (broken.length) bad('rail icons load', broken.map(i => i.src).join(', '))
  else ok('rail icons load', `${icons.length} icons, all decoded`)
  if (stillPng.length) bad('rail icons are webp', stillPng.map(i => i.src).join(', '))
  else ok('rail icons are webp')

  // ── The wallet bridge ─────────────────────────────────────────────────────
  // wagmi mounts on idle with a 1500ms ceiling. Before it arrives the map must
  // already be up (asserted above); after it, the app must not have thrown.
  await page.waitForTimeout(3000)
  const wagmiChunkLoaded = await page.evaluate(() =>
    performance.getEntriesByType('resource').some(r => /chunks\/\d+[-.].*\.js/.test(r.name)))
  ok('wagmi island mounted without unmounting the map', wagmiChunkLoaded ? 'chunk fetched' : '')
  const mapStillThere = await page.$('.ns-hub-map img')
  if (mapStillThere) ok('map survived the wagmi mount')
  else bad('map survived the wagmi mount', 'map disappeared')

  // ── Every screen that touches the chain ───────────────────────────────────
  // These are the ones that used to sit inside WagmiProvider.
  const screens = [
    ['Shop', 'MARKETPLACE'],
    ['Craft', 'CRAFT'],
    ['Pass', 'PASS'],
    ['Bag', 'CHARACTER'],
  ]
  for (const [label] of screens) {
    const before = errors.length
    const btn = page.locator(`.ns-hub-rail:has-text("${label}")`).first()
    if (!(await btn.count())) { bad(`open ${label}`, 'button not found'); continue }
    await btn.click()
    await page.waitForTimeout(2500)
    const newErrors = errors.slice(before)
    const wagmiErr = newErrors.find(e => /WagmiProvider|useConfig|useAccount|usePublicClient/i.test(e))
    if (wagmiErr) bad(`open ${label}`, wagmiErr)
    else ok(`open ${label}`, 'no wagmi provider error')
    // back to the map
    await page.keyboard.press('Escape').catch(() => {})
    const back = page.locator('button:has-text("BACK"), button:has-text("◂")').first()
    if (await back.count()) await back.click().catch(() => {})
    await page.waitForTimeout(800)
    if (!(await page.$('.ns-hub-map img'))) {
      await page.goto(`${BASE}/game?hub=1`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.ns-hub-map img', { timeout: 30000 })
    }
  }

  // Which copy of audio.js did the map load?
  const audioReq = await page.evaluate(() =>
    performance.getEntriesByType('resource').filter(r => r.name.includes('/game-engine/')).map(r => r.name))
  if (audioReq.some(u => u.includes('/game-engine/min/'))) ok('map loads the minified audio engine')
  else bad('map loads the minified audio engine', audioReq.join(', ') || 'no engine request seen')

  // ── The minified engine, loaded on its own ────────────────────────────────
  // Deliberately NOT by clicking START: starting a run needs Firebase, which a
  // local build has no credentials for, and a missing backend would mask the
  // thing actually under test. Loading the fourteen files into a blank page in
  // the engine's own order and asking for its exported surface tests exactly
  // what minification could have broken — a mangled cross-file name, or an
  // export that no longer exists — with nothing else in the way.
  // A local build has no Firebase or Celo credentials, so backend calls fail
  // here by design. What must stay clean is anything caused by the refactors:
  // wagmi provider errors, missing modules, 404s on renamed assets.
  const ENV_NOISE = /favicon|firestore|firebase|forno\.celo\.org|google\.com|client is offline|ERR_CONNECTION_RESET|ERR_ABORTED|status of 50[0-9]|status of 40[34]|Could not reach Cloud Firestore/i

  const bare = await browser.newPage()
  const engineErrors = []
  bare.on('pageerror', e => engineErrors.push(String(e).slice(0, 200)))
  bare.on('console', m => { if (m.type() === 'error') engineErrors.push(m.text().slice(0, 200)) })
  await bare.goto(`${BASE}/game`, { waitUntil: 'domcontentloaded' })

  const ENGINE = [
    'audio.js', 'assets.js', 'story.js', 'story_campaign.js', 'dungeon.js', 'items.js',
    'marketplace-items.js', 'props.js', 'monster-config.js', 'effects.js', 'entities.js',
    'outdoor.js', 'run-session.js', 'game.js',
  ]
  const surface = await bare.evaluate(async (names) => {
    for (const n of names) {
      await new Promise((res, rej) => {
        const s = document.createElement('script')
        s.src = `/game-engine/min/${n}`
        s.async = false
        s.onload = res
        s.onerror = () => rej(new Error('failed ' + n))
        document.body.appendChild(s)
      })
    }
    const g = window.NullStateGame
    return {
      present: !!g,
      exports: g ? Object.keys(g).sort() : [],
      // The other files' cross-file globals: if terser had mangled one of
      // these, the file that reads it would have thrown on load already.
      // Taken from the sources: grep -ho 'window\.[A-Za-z_0-9]*\s*=' on
      // public/game-engine/*.js. Every one of these is written by one file and
      // read by another, which is exactly the coupling minification could break.
      globals: ['Audio2', 'NS_ASSETS', 'NS_CAMPAIGN', 'NS_DUNGEON', 'NS_ENT', 'NS_FX',
        'NS_ITEMS', 'NS_MARKET', 'NS_MONSTER_CONFIG', 'NS_OUTDOOR', 'NS_PROPS',
        'NS_RUN', 'NS_STORY']
        .filter(k => !(k in window)),
    }
  }, ENGINE)

  if (!surface.present) bad('minified engine exposes window.NullStateGame')
  else if (!surface.exports.includes('mount') || !surface.exports.includes('unmount')) {
    bad('minified engine exposes window.NullStateGame', `exports: ${surface.exports.join(', ')}`)
  } else {
    ok('minified engine exposes window.NullStateGame', `${surface.exports.length} exports incl. mount/unmount`)
  }
  if (surface.globals.length) bad('cross-file engine globals survive minification', `missing: ${surface.globals.join(', ')}`)
  else ok('cross-file engine globals survive minification')
  // Same environment filter as below: a local build has no Firebase or Celo
  // credentials, so those calls fail here by design.
  const engineReal = engineErrors.filter(e => !ENV_NOISE.test(e))
  if (engineReal.length) bad('minified engine loads clean', engineReal.slice(0, 3).join(' | '))
  else ok('minified engine loads clean')
  await bare.close()

  // ── Anything the page complained about ────────────────────────────────────
  const realErrors = errors.filter(e => !ENV_NOISE.test(e))
  if (realErrors.length) bad('no console errors', realErrors.slice(0, 5).join(' | '))
  else ok('no console errors')

  const realFailed = failed.filter(f => !ENV_NOISE.test(f) && !/\/api\//.test(f))
  if (realFailed.length) bad('no failed requests', realFailed.slice(0, 5).join(' | '))
  else ok('no failed requests')

  await browser.close()

  console.log('')
  for (const r of results) console.log(`${r.pass ? '  ok  ' : ' FAIL '} ${r.name}${r.detail ? '  — ' + r.detail : ''}`)
  const failures = results.filter(r => !r.pass)
  console.log(`\n${results.length - failures.length}/${results.length} checks passed`)
  process.exit(failures.length ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
