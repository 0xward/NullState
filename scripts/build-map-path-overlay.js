#!/usr/bin/env node
/**
 * build-map-path-overlay.js — pull the glowing trail (and the bunker door
 * lights) out of the world-map art into a separate transparent layer.
 *
 * WHY: the owner wanted the path on the map to breathe — "jalan nya berkedip,
 * redup terang hijau". The trail is painted INTO map-bg.webp, so there is
 * nothing to animate: you cannot pulse part of a flat image.
 *
 * Rather than hand-drawing a path in SVG and hoping it lines up, this extracts
 * the trail's own pixels by colour. The result is perfectly registered with the
 * map by construction — it IS the map's pixels — so the overlay can be stacked
 * on top at the same size and its opacity animated. Nothing can drift out of
 * alignment because there is only one source of geometry.
 *
 * The same colour test also catches the green lamps beside each bunker door,
 * which is a bonus rather than an accident: those pulsing too is what makes the
 * doors read as powered rather than painted.
 *
 * COLOUR TEST: the trail sits around rgb(85-131, 124-183, 100-156) — green
 * clearly above red, and above blue. Measured off the art, not guessed:
 *   g > 115        bright enough to be lit rather than terrain
 *   g - b > 14     warmer than the map's blue-grey snow
 *   g - r > 30     genuinely green rather than pale
 *
 * THE MISSING SPUR: four of the five bunkers have a trail running to their
 * door. Hollow Market does not — the main trail passes well to its left and
 * nothing connects, so on the map that bunker looked unreachable. A spur is
 * DRAWN here in the same style, sampled off the Sunken Field spur the artist
 * did draw: a broken line of small bright dots with a soft halo, leaving the
 * main trail and curving up to the doorway from in front.
 *
 * It is drawn INTO THE MAP ITSELF, not just into the overlay. The first attempt
 * put it only in the overlay and it was nearly invisible — the painted trail
 * shows up because the overlay REINFORCES art that is already there, while the
 * spur had bare snow underneath and a half-opacity `screen` blend over bare
 * snow is almost nothing. Drawing it into the base first means the extraction
 * below picks it up automatically, so the spur ends up in both layers and
 * behaves exactly like the trail the artist painted.
 *
 * The pristine art lives at assets-src/worldmap/map-bg-source.webp and is never
 * written to, so re-running always re-derives from clean pixels rather than
 * stacking a second spur on top of the first. assets-src/ is outside public/,
 * so the source copy is in the repo but never deployed.
 *
 * Outputs: public/worldmap/map-bg.webp    (art + spur)
 *          public/worldmap/map-path.webp  (the lit pixels, transparent)
 * Run: node scripts/build-map-path-overlay.js
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'assets-src/worldmap/map-bg-source.webp')
const MAP_OUT = path.join(ROOT, 'public/worldmap/map-bg.webp')
const OUT = path.join(ROOT, 'public/worldmap/map-path.webp')

;(async () => {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height, ch = info.channels
  const base = Buffer.from(data)          // the map, which the spur is painted into

  // ── Draw the spur to Hollow Market ────────────────────────────────────────
  // Percentages of the map, matching the NODES table in WorldMapHub. The curve
  // leaves the main trail at (51.5, 38.4) and arrives at the doorway threshold,
  // bending south first so it reads as a track around the rubble rather than a
  // straight line drawn on top of the art.
  const spur = {
    from: [51.5, 38.4],
    c1:   [55.2, 40.7],
    c2:   [59.8, 39.2],
    to:   [62.2, 35.9],
  }
  const pt = (p) => [W * p[0] / 100, H * p[1] / 100]
  const bez = (t, a, b, c, d) => {
    const u = 1 - t
    return u*u*u*a + 3*u*u*t*b + 3*u*t*t*c + t*t*t*d
  }
  const [ax, ay] = pt(spur.from), [bx, by] = pt(spur.c1)
  const [cx, cy] = pt(spur.c2),   [dx, dy] = pt(spur.to)

  // The trail's own colour, measured off the painted one.
  const INK = [96, 214, 120]

  // Soft round stamp alpha-blended into the map, brightest at the centre — the
  // painted trail's dots have a lit core and a halo, not a hard edge.
  function stamp(x0, y0, radius, strength) {
    const r = Math.ceil(radius)
    for (let y = Math.round(y0) - r; y <= Math.round(y0) + r; y++) {
      if (y < 0 || y >= H) continue
      for (let x = Math.round(x0) - r; x <= Math.round(x0) + r; x++) {
        if (x < 0 || x >= W) continue
        const d = Math.hypot(x - x0, y - y0)
        if (d > radius) continue
        const a = Math.pow(1 - d / radius, 1.6) * strength
        if (a <= 0.004) continue
        const i = (y * W + x) * ch
        for (let k = 0; k < 3; k++) base[i + k] = Math.round(base[i + k] * (1 - a) + INK[k] * a)
      }
    }
  }

  // Dashes rather than a stroke. A continuous curve reads as a line drawn ON
  // the map; the painted trail is a broken run of dots of uneven size, so this
  // matches that — long gaps, varying radius, and a little wobble off the exact
  // curve. Deterministic wobble (fixed sines, never Math.random) so re-running
  // the script produces the same file byte for byte.
  const STEPS = 520
  const ON = 4, PERIOD = 13          // ~30% duty: clearly separated dots
  let drawn = 0
  for (let i = 0; i <= STEPS; i++) {
    if (i % PERIOD >= ON) continue
    const t = i / STEPS
    const x = bez(t, ax, bx, cx, dx) + Math.sin(t * 37.0) * 1.5 + Math.sin(t * 11.3) * 1.1
    const y = bez(t, ay, by, cy, dy) + Math.cos(t * 29.0) * 1.2
    const rad = (3.2 - 1.0 * t) * (0.78 + 0.30 * Math.abs(Math.sin(t * 19.0)))
    stamp(x, y, rad, 0.92)
    stamp(x, y, rad * 2.4, 0.22)                     // halo
    drawn++
  }
  console.log(`  drew ${drawn} dashes for the Hollow Market spur`)

  // q86 lands the re-encode slightly UNDER the original file (190KB vs 212KB)
  // rather than inflating it, and pixel art at this quality shows no visible
  // ringing — the palette is flat and the edges are already hard.
  await sharp(base, { raw: { width: W, height: H, channels: ch } })
    .webp({ quality: 86 })
    .toFile(MAP_OUT)

  // ── Extract the lit pixels from the RESULT, so the spur is in both layers ──
  const out = Buffer.alloc(W * H * 4, 0)
  let kept = 0
  for (let i = 0; i < W * H; i++) {
    const o = i * ch
    const r = base[o], g = base[o + 1], b = base[o + 2]
    if (g > 115 && g - b > 14 && g - r > 30) {
      out[i * 4]     = Math.round(r * 0.7)
      out[i * 4 + 1] = Math.min(255, Math.round(g * 1.2))
      out[i * 4 + 2] = Math.round(b * 0.78)
      out[i * 4 + 3] = Math.max(0, Math.min(255, Math.round((g - 90) * 3)))
      kept++
    }
  }

  await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .webp({ quality: 88, alphaQuality: 100 })
    .toFile(OUT)

  const kb = (f) => Math.round(fs.statSync(f).size / 1024) + 'KB'
  console.log(`✓ ${path.relative(ROOT, MAP_OUT)} — ${W}x${H}, ${kb(MAP_OUT)}`)
  console.log(`✓ ${path.relative(ROOT, OUT)} — ${W}x${H}, ${kb(OUT)}`)
  console.log(`  ${kept.toLocaleString()} lit pixels (${(100 * kept / (W * H)).toFixed(2)}% of the map)`)
})().catch(e => { console.error(e); process.exit(1) })
