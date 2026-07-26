#!/usr/bin/env node
/**
 * build-hero-portrait.js — bake a still portrait of the REAL player character.
 *
 * The hero is not a single sprite. entities.js drawLPCComposite() stacks an LPC
 * body with an armour layer set and tints the armour, so the character only
 * exists as a composite at runtime. Anything outside the canvas — a menu
 * avatar, a landing page — has no sprite to point at.
 *
 * public/sprites/player/knight_*.png is NOT that character. assets.js keeps it
 * only as "the in-dungeon decode-race fallback sprite set"; it is a leftover
 * from an earlier design and is not what a player sees.
 *
 * This mirrors drawLPCComposite exactly for the default look (no armour, no
 * skin bought):
 *   1. BODY_male.png, row 2 (facing camera), frame 0
 *   2. LPC_OUTFIT.default_skin layers in the engine's order: legs, torso, arms,
 *      feet, head — default_skin has no head, deliberately (bare-headed)
 *   3. the armour stack tinted #6f8f9c at 0.20 via source-atop, so the tint
 *      lands on the armour silhouette only and never on the face
 *   4. the tinted armour composited over the bare body
 *
 * Run: node scripts/build-hero-portrait.js
 * Re-run whenever LPC_OUTFIT.default_skin changes in assets.js.
 */
const sharp = require('sharp')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const LPC = path.join(ROOT, 'public/sprites/lpc_source/base/walkcycle')
const OUT = path.join(ROOT, 'public/sprites/player/hero-portrait.png')

const FW = 64, FH = 64
const ROW_DOWN = 2          // LPC_DIRS = ['up','left','down','right']
const FRAME = 0

// LPC_OUTFIT.default_skin, assets.js. Order matters — it is the engine's.
const LAYERS = [
  'LEGS_plate_armor_pants.png',       // legs
  'TORSO_leather_armor_torso.png',    // torso
  'TORSO_leather_armor_shoulders.png',// arms
  'FEET_plate_armor_shoes.png',       // feet
  // head: none — the default skin is deliberately bare-headed
]
const TINT = { r: 0x6f, g: 0x8f, b: 0x9c }
const TINT_ALPHA = 0.20

const frame = (file) =>
  sharp(path.join(LPC, file))
    .extract({ left: FRAME * FW, top: ROW_DOWN * FH, width: FW, height: FH })
    .png()
    .toBuffer()

;(async () => {
  const body = await frame('BODY_male.png')

  // Armour stack on its own transparent canvas, so the tint can be confined to
  // it. Tinting the whole composite would recolour the face.
  const armourLayers = []
  for (const f of LAYERS) armourLayers.push({ input: await frame(f), blend: 'over' })

  let armour = await sharp({
    create: { width: FW, height: FH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(armourLayers).png().toBuffer()

  // source-atop: paint the tint only where the armour is already opaque.
  // libvips 'atop' is the same operator as the canvas one the engine uses.
  const tintLayer = await sharp({
    create: { width: FW, height: FH, channels: 4, background: { ...TINT, alpha: TINT_ALPHA } },
  }).png().toBuffer()

  armour = await sharp(armour)
    .composite([{ input: tintLayer, blend: 'atop' }])
    .png()
    .toBuffer()

  await sharp(body)
    .composite([{ input: armour, blend: 'over' }])
    .png({ compressionLevel: 9 })
    .toFile(OUT)

  const meta = await sharp(OUT).metadata()
  const kb = Math.round(require('fs').statSync(OUT).size / 1024)
  console.log(`✓ ${path.relative(ROOT, OUT)} — ${meta.width}x${meta.height}, ${kb}KB`)
})().catch(e => { console.error(e); process.exit(1) })
