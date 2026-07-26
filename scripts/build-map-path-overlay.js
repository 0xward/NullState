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
 * Output: public/worldmap/map-path.webp (transparent, ~0.3% of pixels set)
 * Run: node scripts/build-map-path-overlay.js
 * Re-run if map-bg.webp is ever replaced.
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'public/worldmap/map-bg.webp')
const OUT = path.join(ROOT, 'public/worldmap/map-path.webp')

;(async () => {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height, ch = info.channels
  const out = Buffer.alloc(W * H * 4, 0)

  let kept = 0
  for (let i = 0; i < W * H; i++) {
    const o = i * ch
    const r = data[o], g = data[o + 1], b = data[o + 2]
    if (g > 115 && g - b > 14 && g - r > 30) {
      // Pushed toward the trail's own green so the layer reads as LIGHT sitting
      // on the map rather than as a second, brighter copy of the terrain.
      out[i * 4]     = Math.round(r * 0.7)
      out[i * 4 + 1] = Math.min(255, Math.round(g * 1.2))
      out[i * 4 + 2] = Math.round(b * 0.78)
      // Alpha ramps with brightness, so the faint edges of the trail fade out
      // instead of ending on a hard cut.
      out[i * 4 + 3] = Math.max(0, Math.min(255, Math.round((g - 90) * 3)))
      kept++
    }
  }

  await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .webp({ quality: 88, alphaQuality: 100 })
    .toFile(OUT)

  const kb = Math.round(fs.statSync(OUT).size / 1024)
  console.log(`✓ ${path.relative(ROOT, OUT)} — ${W}x${H}, ${kb}KB`)
  console.log(`  ${kept.toLocaleString()} lit pixels (${(100 * kept / (W * H)).toFixed(2)}% of the map)`)
})().catch(e => { console.error(e); process.exit(1) })
