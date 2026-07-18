/* ============================================================
   NULL_STATE :: ASSETS  (sprite sheets + loader + archetypes)
   Frame layouts verified from source sheets (Pixel Crawler -
   Free Pack: Npc's for player classes, Mobs for enemies).
   ------------------------------------------------------------
   All player classes and all monster variants share the same
   idle (4f@32px) and run (6f@64px) sheet geometry — only death
   geometry varies per-entity (frame count/width differ), so it's
   specified individually below. None of these entities have a
   dedicated "attack" sheet (the source pack only ships
   Idle/Run/Death for Npc's and Mobs) — attacking is conveyed by
   holding the idle pose with a flash + particle burst instead
   (see Player/Enemy attack handling in entities.js).
   `scale` is calibrated so on-screen height is ~56px regardless
   of each sprite's native content size; `foot` is the fraction
   of frame height where the character's feet sit (used to anchor
   shadows/ground position).
   ============================================================ */
const HERO = {
  knight: {
    idle:  { src:'/sprites/player/knight_idle.png',  fw:32, fh:32, frames:4, fps:6 },
    walk:  { src:'/sprites/player/knight_run.png',   fw:64, fh:64, frames:6, fps:12 },
    death: { src:'/sprites/player/knight_death.png', fw:48, fh:32, frames:6, fps:10 },
    scale:1.93, foot:1.0,
  },
  rogue: {
    idle:  { src:'/sprites/player/rogue_idle.png',  fw:32, fh:32, frames:4, fps:6 },
    walk:  { src:'/sprites/player/rogue_run.png',   fw:64, fh:64, frames:6, fps:12 },
    death: { src:'/sprites/player/rogue_death.png', fw:64, fh:32, frames:6, fps:10 },
    scale:1.87, foot:1.0,
  },
  wizzard: {
    idle:  { src:'/sprites/player/wizzard_idle.png',  fw:32, fh:32, frames:4, fps:6 },
    walk:  { src:'/sprites/player/wizzard_run.png',   fw:64, fh:64, frames:6, fps:12 },
    death: { src:'/sprites/player/wizzard_death.png', fw:64, fh:32, frames:6, fps:10 },
    scale:1.75, foot:1.0,
  },
};

// ============================================================
// LPC hero (Phase 5.3 Task 5). Single body, gear-layered.
// Direction row order confirmed by visual inspection this session
// (base/walkcycle/BODY_male.png, frame 0 of each row):
//   row 0 = up (facing away)   row 1 = left
//   row 2 = down (facing cam)  row 3 = right
// Armor pieces (TORSO/LEGS/FEET/HEAD) are pre-aligned to the SAME grid
// as the body in every animation folder — confirmed this session via a
// direct-stack composite test (zero anchor math needed, see
// README_LPC_INTEGRATION.md). Weapons work the same way: the `slash`
// animation folder already has the swing PRE-BAKED per direction, so a
// weapon overlay is just another direct-stack layer during the attack
// window — NOT continuous anchor+rotation as originally planned (that
// assumption is now corrected; see NEXT-SESSION-PROMPT-v6).
// ------------------------------------------------------------
const LPC_DIRS = ['up','left','down','right'];
const LPC_BASE = '/sprites/lpc_source/base';
// Idle/walk weapon-carry overlays live at sprites/lpc_source/weapon_walk/
// (NOT under base/). assets.js previously built these paths under LPC_BASE,
// i.e. `.../base/weapon_walk/...`, which does not
// Body + per-animation frame geometry. `rows` = LPC_DIRS.length unless
// noted (hurt has no per-direction rows in this pack — single strip).
const LPC_HERO = {
  walk:   { src:`${LPC_BASE}/walkcycle/BODY_male.png`, fw:64, fh:64, frames:9, rows:4, fps:12 },
  idle:   { src:`${LPC_BASE}/walkcycle/BODY_male.png`, fw:64, fh:64, frames:1, rows:4, fps:1 },
  hurt:   { src:`${LPC_BASE}/hurt/BODY_male.png`,      fw:64, fh:64, frames:6, rows:1, fps:10, loop:false },
  slash:  { src:`${LPC_BASE}/slash/BODY_human.png`,    fw:64, fh:64, frames:6, rows:4, fps:22, loop:false },
  thrust: { src:`${LPC_BASE}/thrust/BODY_animation.png`,fw:64, fh:64, frames:8, rows:4, fps:24, loop:false },
  // shoot (bow-draw pose) — wired this session per user decision (Option A:
  // dedicated archer pose, not particle-only FX). The `bow` folder in the
  // LPC source tree already ships a full BODY_animation.png (13 frames x 4
  // dirs, same 64x64 grid as the other anims) plus matching armor pieces
  // for all 3 tiers and its own WEAPON_bow.png — nothing needed sourcing,
  // it was already in the shipped asset tree, just not referenced yet.
  shoot:  { src:`${LPC_BASE}/bow/BODY_animation.png`,   fw:64, fh:64, frames:13, rows:4, fps:20, loop:false },
  // on-screen scale/foot anchor — CALIBRATED this session via a Playwright
  // harness + pixel measurement (PIL bbox on actual alpha content, not just
  // frame size): old knight_idle frame0 has a 29px-tall opaque region inside
  // its 32px frame, and at the old scale (1.93) that renders at 55.97px on
  // screen -- confirming the "~56px" target in the HERO comment above.
  // LPC's BODY_male frame (down-facing, walkcycle row2) has a 47px-tall
  // opaque region inside its 64px frame. So the matching scale is
  // 56/47 ≈ 1.19 (rounded to 1.2), NOT the placeholder 2.2 this was set to
  // earlier this session (2.2 rendered ~140px tall — confirmed via
  // screenshot bbox measurement, nearly 2.5x too big). foot:1.0 confirmed
  // correct as-is: both the old sprite (0px gap) and the LPC sprite (2px
  // gap) have feet essentially flush with the frame's bottom edge.
  scale: 1.2, foot: 1.0,
};

// Armor tier -> LPC part filenames, per animation folder (same filename
// works across walk/idle/slash/thrust/hurt since LPC keeps part names
// consistent per folder). rune_armor -> plate_armor per user decision
// this session (heavy ornate metal reading, not robe/cloth).
const LPC_ARMOR = {
  // v77: equipped armor colours now match the marketplace icons (owner report:
  // "armor preview di inventory tidak sama dengan yg di-equip dari warna/glow").
  // Measured dominant icon colours: leather = warm brown, iron = neutral steel,
  // rune = deep violet with a warding glow. `tint`/`glow` are applied over the
  // LPC layer in drawLPCComposite so the on-body colour reads like the shop art.
  leather_guard: { torso:'TORSO_leather_armor_torso.png', legs:'LEGS_pants_greenish.png', feet:'FEET_shoes_brown.png', tint:'#7a3c18', tintA:0.22 },
  iron_plate:    { torso:'TORSO_chain_armor_torso.png',   legs:'LEGS_plate_armor_pants.png', feet:'FEET_plate_armor_shoes.png' },
  // rune: purple chain jacket base + violet tint + a soft warding glow so it
  // shimmers like the icon (icon desc: "shimmer on hit").
  rune_armor:    { torso:'TORSO_chain_armor_jacket_purple.png', legs:'LEGS_plate_armor_pants.png', feet:'FEET_plate_armor_shoes.png', head:'HEAD_plate_armor_helmet.png', tint:'#5a1fa0', tintA:0.30, glow:'#8a3dff' },
  // Punch list #9 (MiniPay compliance) — the bare LPC BODY_male sheet is the
  // stock LPC "skin" layer with no clothing baked in (underwear only), so
  // any player with no marketplace armor equipped — which is every player
  // at run start, and anyone who hasn't bought armor yet — rendered
  // effectively undressed both in the char-select preview AND in the
  // dungeon. This is NOT a purchasable marketplace item (not in
  // marketplace-items.js, never shown in the shop) — it's a rendering-only
  // fallback outfit. drawLPCComposite() below falls back to this whenever
  // opts.armorId is unset, so bare skin can no longer appear anywhere.
  // Picked plain shirt/pants/shoes (not a repurposed tier) so it visually
  // reads as "default clothes", not "free copy of leather armor".
  base: { torso:'TORSO_leather_armor_shirt_white.png', legs:'LEGS_pants_greenish.png', feet:'FEET_shoes_brown.png' },
  // (v76 Task #7: warden_plate / ancient_aegis were removed from the shop on
  // owner request; their LPC_ARMOR entries went with them.)
  // Phase 3a — render-only full-plate set worn by the Corrupted Knight ENEMY
  // (not a marketplace item, never sold; same status as `base`). Full plate
  // torso/legs/feet + closed plate helm reads as a heavy armoured knight; the
  // enemy applies a dark "corrupted" tint over the whole composite at draw time
  // (see ARCHETYPES.corrupted_knight.lpc.tint). Parts exist across every anim
  // folder, so preloadAll()'s LPC_ARMOR sweep covers it automatically.
  knight_corrupt: { torso:'TORSO_plate_armor_torso.png', legs:'LEGS_plate_armor_pants.png', feet:'FEET_plate_armor_shoes.png', head:'HEAD_plate_armor_helmet.png', arms:'TORSO_plate_armor_arms_shoulders.png' }, // arms = POLISH 3a (menutup lengan telanjang)
};

// Weapon id -> which body-relative animation folder its overlay sheet
// lives in ('slash' or 'thrust') + the overlay file itself. Confirmed
// this session (direct-stack, verified via composite test):
//   war_axe, void_reaper — found in LPC generator GitHub repo this
//   session (was "missing asset" in prior sessions' plan), downscaled
//   from their 192px oversize cells to 64px same as longsword/rapier.
// ---------------------------------------------------------------------------
// NS_WEAPON — v76 Task #7. Weapons are no longer pre-baked LPC overlay sheets.
// ---------------------------------------------------------------------------
// WHY THE REWRITE: the old approach stacked a 4-row x N-col overlay sheet onto
// the body grid. Re-measured this session (PIL, per row/col alpha scan) the
// shipped sheets are full of holes and NOTHING could be layered on top to fix
// it:
//   longsword_walk / spear_walk / waraxe_walk .. ONLY the down row has art
//   dagger_walk ............................... up row empty; left/right only cols 0,4,5
//   scythe_walk ............................... col 0 empty on up/left/right -> the
//                                               weapon vanished exactly on IDLE
//   scythe_slash / waraxe_slash ............... up row empty for all 6 frames
// That is the root cause of "weapon hilang saat idle" and "senjata pindah
// tangan": each direction fell back to a different art source. It also made
// the owner's own weapon art impossible to show, so the $15 marketplace icon
// and the thing in your hand were different objects entirely.
//
// NEW MODEL: one canonical sprite per weapon (tip UP, grip at the bottom, see
// /sprites/weapons/) drawn by drawWeaponLayer() in entities.js, rotated around
// its grip and pinned to the hero's RIGHT hand. Consequences:
//   * no rows to be missing -> a weapon can never vanish in any direction/frame
//   * one explicit hand anchor -> it can never swap hands
//   * the sprite IS the marketplace icon art -> equipped always matches the shop
//   * attack motion is code, so every weapon gets its own swing (WEAPON_MOTION)
//
// Fields:
//   src    canonical sprite (64px tall box, tip up, grip bottom)
//   anim   BODY pose to play during the attack window ('slash'|'thrust'|'shoot')
//   motion procedural weapon animation, see WEAPON_MOTION in entities.js
//   gy     grip position as a fraction of sprite height from the TOP (1 = bottom)
//   ln     on-screen length in body-frame units (the LPC body frame is 64)
//   sfx    per-weapon attack sound, see Audio.attackFor() in audio.js
//   carry  'hand' (default) or 'back' — 'back' slings the weapon over the
//          shoulder during idle/walk and only brings it to the hands for the
//          attack (owner spec: bow rides on the back while walking)
//   glow   optional hex — premium weapons get a soft pulsing aura + a brighter
//          attack (drawWeaponLayer / swing FX read this). Matches the marketplace
//          icon's glow so equipped == shop.
//   htk    hits-to-kill a NORMAL enemy (owner spec v77): cheap weapons 4, mid 3,
//          the priciest 2. Damage per swing = ceil(enemy.maxHp / htk), so it
//          holds regardless of the enemy's raw HP. Bosses/elites take more (see
//          HTK_BOSS_MUL in game.js). Unarmed falls back to flat atkDmg.
const NS_WPN = '/sprites/weapons';
const NS_WEAPON = {
  rusty_blade:       { src:`${NS_WPN}/rusty_blade.png`,       anim:'slash',  motion:'slash',    gy:0.90, ln:30, sfx:'blade',     htk:4 },
  emberwood_maul:    { src:`${NS_WPN}/emberwood_maul.png`,    anim:'slash',  motion:'chop',     gy:0.94, ln:32, sfx:'wood',      htk:4 },
  ironbolt_crossbow: { src:`${NS_WPN}/ironbolt_crossbow.png`, anim:'shoot',  motion:'crossbow', gy:0.74, ln:27, sfx:'crossbow', htk:4, carry:'back' },
  argent_waraxe:     { src:`${NS_WPN}/argent_waraxe.png`,     anim:'slash',  motion:'chop',     gy:0.93, ln:32, sfx:'axe',       htk:3 },
  ancient_blade:     { src:`${NS_WPN}/ancient_blade.png`,     anim:'slash',  motion:'slash',    gy:0.88, ln:33, sfx:'blade',     htk:3, glow:'#ffd24a' },
  frost_spear:       { src:`${NS_WPN}/frost_spear.png`,       anim:'thrust', motion:'thrust',   gy:0.72, ln:40, sfx:'spear',     htk:3, glow:'#bdeeff' },
  verdant_reaper:    { src:`${NS_WPN}/verdant_reaper.png`,    anim:'slash',  motion:'reap',     gy:0.96, ln:38, sfx:'scythe',    htk:3, glow:'#57e389' },
  void_katana:       { src:`${NS_WPN}/void_katana.png`,       anim:'slash',  motion:'iai',      gy:0.90, ln:36, sfx:'katana',    htk:2, glow:'#b46bff' },
  sunfire_bow:       { src:`${NS_WPN}/sunfire_bow.png`,       anim:'shoot',  motion:'bow',      gy:0.50, ln:30, sfx:'bow',       htk:2, carry:'back', glow:'#ffcf3d' },
};

// Hero hand/grip anchor per facing, in 64px body-frame coords. RE-MEASURED
// v77 off base/walkcycle BODY_male: unlike a real over-the-shoulder carry, the
// LPC idle/walk pose holds BOTH hands together low in front of the navel, so
// the grip anchor is the CENTRE of that clasped-hands blob — not out to one
// side. Measured hand-blob centroid per facing (idle col0, both walk halves):
//   up (31.5,36) | left (32.5,45) | down (31.5,45) | right (30.5,45)
// The old x=43/23 values were the bow-overlay centroid (a bow's mass sits at
// its belly, far from the grip) and put the weapon floating beside the hip —
// the root of "senjata tidak dipegang tangan". `front:false` = the weapon is
// occluded by the torso for that facing (drawn before the body).
//   up   : hero faces away  -> weapon in front of the hands = toward camera = ON TOP
//   down : hero faces us     -> weapon crosses in front of the belt = ON TOP
//   left/right (profile)     -> the held weapon reads on top of the near arm
const LPC_HAND = [
  // Attack grip per facing — the hand reaches OUT toward the strike, not the
  // clasped-idle center, so the swing starts from the shoulder on the aim side
  // rather than the middle of the chest.
  { x:34, y:34, front:true  }, // 0 up    — reaching up/away
  { x:26, y:40, front:true  }, // 1 left  — reaching screen-left
  { x:34, y:42, front:true  }, // 2 down  — reaching down/toward camera
  { x:38, y:40, front:true  }, // 3 right — reaching screen-right
];
// Back-carry anchor per facing. v78: EVERY weapon now rides on the hero's back
// while idle/walking (owner spec — the in-hand carry read as "melayang" no
// matter how the hand anchor was tuned, so we sling everything and only bring
// it to the hands for the attack, exactly like the LPC quiver layer does).
// These numbers are LIFTED DIRECTLY from base/walkcycle/BEHIND_quiver.png — the
// point LPC's own artist chose for a slung item — so they are correct by
// construction, not guessed:
//   up (22,47) | left (23,47) | down (42,49) | right (40,47), sling ~135deg.
// front:false everywhere EXCEPT up — a BEHIND_ layer is occluded by the torso
// in every facing except when the hero faces away (up), where the back (and
// thus the slung weapon) is what we see.
const LPC_BACK = [
  { x:22.0, y:44, front:true,  ang:-0.62 }, // 0 up    — back to camera, weapon fully visible
  { x:23.2, y:45, front:false, ang:-0.62 }, // 1 left  — behind torso
  { x:41.6, y:46, front:false, ang: 0.62 }, // 2 down  — behind torso (only pommel/tip peeks)
  { x:39.6, y:45, front:false, ang: 0.62 }, // 3 right — behind torso
];
// Walk-cycle vertical bob (y per frame 0..8), measured off the body sheet.
const LPC_HAND_BOB = [0, 0, -1, -1, -1, 0, 1, 1, 1];
// Resting pose is no longer used for a hand-carry (everything slings on the
// back now); kept only as the attack-idle fallback lean. Values are the slung
// diagonal so a weapon that momentarily has no back anchor still reads sane.
const LPC_REST_ANG = [-0.62, -0.62, 0.62, 0.62];

// monster sprite sheets — idle/run share geometry across all variants;
// death frame count/width differ per-variant (see header note above).
const MON = {
  skel_reaper: { idle:{src:'/sprites/monsters2/skel2_idle.png',   fw:32,fh:32,frames:6},
                 walk:{src:'/sprites/monsters2/skel2_walk.png',   fw:32,fh:32,frames:10},
                 attack:{src:'/sprites/monsters2/skel2_attack.png', fw:32,fh:32,frames:9},
                 death:{src:'/sprites/monsters2/skel2_death.png', fw:32,fh:32,frames:17}, scale:3.73, foot:1.0 },
  vampire:     { idle:{src:'/sprites/monsters2/vampire_idle.png',   fw:32,fh:32,frames:6},
                 walk:{src:'/sprites/monsters2/vampire_walk.png',   fw:32,fh:32,frames:8},
                 attack:{src:'/sprites/monsters2/vampire_attack.png', fw:32,fh:32,frames:16},
                 death:{src:'/sprites/monsters2/vampire_death.png', fw:32,fh:32,frames:14}, scale:3.5, foot:1.0 },
  orc_base:    { idle:{src:'/sprites/monsters/orc_base_idle.png',   fw:32,fh:32,frames:4},
                 walk:{src:'/sprites/monsters/orc_base_run.png',    fw:64,fh:64,frames:6},
                 death:{src:'/sprites/monsters/orc_base_death.png', fw:64,fh:64,frames:6}, scale:1.87, foot:1.0 },
  orc_rogue:   { idle:{src:'/sprites/monsters/orc_rogue_idle.png',  fw:32,fh:32,frames:4},
                 walk:{src:'/sprites/monsters/orc_rogue_run.png',   fw:64,fh:64,frames:6},
                 death:{src:'/sprites/monsters/orc_rogue_death.png',fw:64,fh:64,frames:6}, scale:1.87, foot:1.0 },
  orc_shaman:  { idle:{src:'/sprites/monsters/orc_shaman_idle.png', fw:32,fh:32,frames:4},
                 walk:{src:'/sprites/monsters/orc_shaman_run.png',  fw:64,fh:64,frames:6},
                 death:{src:'/sprites/monsters/orc_shaman_death.png',fw:64,fh:64,frames:7}, scale:2.24, foot:1.0 },
  orc_warrior: { idle:{src:'/sprites/monsters/orc_warrior_idle.png', fw:32,fh:32,frames:4},
                 walk:{src:'/sprites/monsters/orc_warrior_run.png',  fw:64,fh:64,frames:6},
                 death:{src:'/sprites/monsters/orc_warrior_death.png',fw:96,fh:80,frames:6}, scale:1.75, foot:1.0 },
  skel_base:   { idle:{src:'/sprites/monsters/skel_base_idle.png',  fw:32,fh:32,frames:4},
                 walk:{src:'/sprites/monsters/skel_base_run.png',   fw:64,fh:64,frames:6},
                 death:{src:'/sprites/monsters/skel_base_death.png',fw:64,fh:64,frames:12}, scale:1.87, foot:1.0 },
  skel_mage:   { idle:{src:'/sprites/monsters/skel_mage_idle.png',  fw:32,fh:32,frames:4},
                 walk:{src:'/sprites/monsters/skel_mage_run.png',   fw:64,fh:64,frames:6},
                 death:{src:'/sprites/monsters/skel_mage_death.png',fw:64,fh:64,frames:6}, scale:1.75, foot:1.0 },
  skel_rogue:  { idle:{src:'/sprites/monsters/skel_rogue_idle.png', fw:32,fh:32,frames:4},
                 walk:{src:'/sprites/monsters/skel_rogue_run.png',  fw:64,fh:64,frames:6},
                 death:{src:'/sprites/monsters/skel_rogue_death.png',fw:64,fh:64,frames:6}, scale:1.75, foot:1.0 },
  skel_warrior:{ idle:{src:'/sprites/monsters/skel_warrior_idle.png', fw:32,fh:32,frames:4},
                 walk:{src:'/sprites/monsters/skel_warrior_run.png',  fw:64,fh:64,frames:6},
                 death:{src:'/sprites/monsters/skel_warrior_death.png',fw:64,fh:48,frames:6}, scale:1.87, foot:1.0 },
  // Phase 3b "beasts" — DIRECTIONAL monsters (LPC-format, OGA CC-BY, see
  // monsters3/CREDITS.md). Unlike the Pixel Crawler crew above (single row,
  // faces left, engine flips for right), these sheets have a real row PER
  // direction (0=up 1=left 2=down 3=right) and are drawn by the directional
  // path in entities.js (Enemy.dirMon) — NO horizontal flip. Each anim block:
  //   cols  = column stride of the sheet (frames-per-row on disk)
  //   col0  = first column of THIS animation within that row
  //   frames= how many columns this animation spans
  //   oneDir+row = animation lives on a single fixed row (death), not per-dir
  cave_golem: { dir:true, scale:1.9, foot:0.92,
    idle:  {src:'/sprites/monsters3/golem-walk.png', fw:64,fh:64, cols:7, col0:0, frames:1, fps:1},
    walk:  {src:'/sprites/monsters3/golem-walk.png', fw:64,fh:64, cols:7, col0:0, frames:7, fps:8},
    death: {src:'/sprites/monsters3/golem-die.png',  fw:64,fh:64, cols:7, col0:0, frames:7, fps:9, oneDir:true, row:0} },
  giant_spider: { dir:true, scale:1.7, foot:0.83,
    idle:  {src:'/sprites/monsters3/spider.png', fw:64,fh:64, cols:10, col0:0, frames:1, fps:1},
    walk:  {src:'/sprites/monsters3/spider.png', fw:64,fh:64, cols:10, col0:4, frames:6, fps:10},
    attack:{src:'/sprites/monsters3/spider.png', fw:64,fh:64, cols:10, col0:0, frames:4, fps:14},
    death: {src:'/sprites/monsters3/spider.png', fw:64,fh:64, cols:10, col0:0, frames:4, fps:10, oneDir:true, row:4} },
};

// enemy archetypes (stats are base @ floor 1, scaled by floor).
// Phase 3c (aggressive, user decision): every archetype's `spd` was reduced
// ~33% from its prior value so monsters read as slower/heavier vs the player
// (player spd=141, v65 T1 — was 188). Only `spd` changed — HP/DMG/XP balance is untouched.
// Reference (old -> new): orc_base 42->28, orc_rogue 54->36, orc_warrior 36->24,
// skel_base 44->29, giant_spider 56->38, skel_rogue 58->39, skel_reaper 46->31,
// cave_golem 30->20, vampire 50->34, corrupted_knight 40->27, orc_shaman 40->27,
// skel_mage 40->27, skel_warrior 34->23, THE WARLORD 38->25.
// 'mummy'/'boss' keys are gone — replaced by the Orc/Skeleton crews. Any
// code that gated logic on `arch.key==='mummy'` (e.g. the lift's floor-clear
// check) now keys off `isUndead` (skeleton crew) instead — see game.js.
const ARCHETYPES = [
  { key:'orc_base',    mon:'orc_base',    name:'Orc Raider',       hp:92, dmg:9,  spd:28, xp:38, color:'#7fae5a', r:15 },
  { key:'orc_rogue',   mon:'orc_rogue',   name:'Orc Skulker',      hp:80, dmg:11, spd:36, xp:44, color:'#6a9650', r:14 },
  { key:'orc_warrior',  mon:'orc_warrior',  name:'Orc Warrior',      hp:126, dmg:13, spd:24, xp:52, color:'#5c8a46', r:17, isUndead:false },
  { key:'skel_base',    mon:'skel_base',    name:'Restless Bones',   hp:76, dmg:8,  spd:29, xp:36, color:'#cbb98e', r:14, isUndead:true },
  // Phase 3b beast — Giant Spider (directional MON, walk/attack/death). Fast,
  // fragile; a "beast", not undead (does not gate the floor-clear lift).
  { key:'giant_spider', mon:'giant_spider', name:'Giant Spider',     hp:88, dmg:12, spd:38, xp:52, color:'#5a3a2a', r:15, isUndead:false },
  { key:'skel_rogue',   mon:'skel_rogue',   name:'Bone Skulker',     hp:68, dmg:10, spd:39, xp:42, color:'#b3a378', r:14, isUndead:true },
  { key:'skel_reaper',  mon:'skel_reaper',  name:'Reaper Skeleton',  hp:100, dmg:12, spd:31, xp:50, color:'#cfd6e6', r:15, isUndead:true },
  // Phase 3b beast — Cave Golem (directional MON, walk/death; uses the engine
  // swing FX for its attack). Slow, very tanky bruiser; a "beast", not undead.
  { key:'cave_golem',   mon:'cave_golem',   name:'Cave Golem',       hp:210, dmg:19, spd:20, xp:88, color:'#8a8f9a', r:18, isUndead:false },
  { key:'vampire',      mon:'vampire',      name:'Crypt Vampire',    hp:116, dmg:14, spd:34, xp:55, color:'#8a2f4a', r:15, isUndead:true },
  // Phase 3a — Corrupted Knight: a heavy humanoid rendered through the LPC
  // compositing pipeline (body+plate+helm+longsword, all 4 directions + slash),
  // NOT a flat MON spritesheet. `useLPC` + `lpc{}` tell Enemy to composite +
  // tint it (see entities.js). Appended last so the depth-gated spawn picker
  // (ARCHETYPES[rand*min(len,1+depth)] in game.js) only rolls it on deeper
  // floors, where a tanky armoured knight fits. isUndead:true so it counts as a
  // required kill for the floor-clear/lift gate, same as the skeleton crew.
  { key:'corrupted_knight', name:'Corrupted Knight', hp:150, dmg:16, spd:27, xp:72, color:'#6a3a8a', r:16, isUndead:true,
    useLPC:true, lpc:{ armorId:'knight_corrupt', weaponId:'ancient_blade', tint:'#3a1350', tintAlpha:0.34, scale:1.34 } },
];
const ORC_SHAMAN_ARCH = { key:'orc_shaman', mon:'orc_shaman', name:'Orc Shaman', hp:104, dmg:14, spd:27, xp:60, color:'#4a7a3a', r:16 };
const SKEL_MAGE_ARCH   = { key:'skel_mage',  mon:'skel_mage',  name:'Bone Caster', hp:88, dmg:15, spd:27, xp:58, color:'#8f9bb8', r:15, isUndead:true };
const SKEL_WARRIOR_ARCH= { key:'skel_warrior', mon:'skel_warrior', name:'Bone Warrior', hp:138, dmg:14, spd:23, xp:56, color:'#9c8f6e', r:17, isUndead:true };
const BOSS_ARCH = { key:'orc_warrior', mon:'orc_warrior', name:'THE WARLORD', hp:1100, dmg:20, spd:25, xp:600, color:'#ff3b5c', r:30, isBossScale:true };

const backgrounds = ['/backgrounds/forest.webp','/backgrounds/desert.webp',
  '/backgrounds/snow.webp','/backgrounds/field.webp','/backgrounds/back.webp'];
const BG_BY_KEY = {
  forest:'/backgrounds/forest.webp', desert:'/backgrounds/desert.webp',
  snow:'/backgrounds/snow.webp', field:'/backgrounds/field.webp', back:'/backgrounds/back.webp',
};

// ---- decoration / world-object sprites ----
const DECOR_SPRITES = {
  door:  { src:'/sprites/decor/door_a_frames', frames:2 },           // 0=closed 1=open, 16x16 each
  chest: { src:'/sprites/decor/chest_a_frames', frames:4 },          // 0=closed..3=open, 16x16 each
  // New top-down door/chest sprites — verified true top-down perspective
  // (unlike the Mystic Woods door used above, which is front-facing and
  // only ever looked correct on one wall orientation). 32x32 per frame, 5
  // frames closed->open.
  doorWood:  { src:'/sprites/tiles2/door_wood',  frames:5 },
  doorIron:  { src:'/sprites/tiles2/door_iron',  frames:5 },
  doorWood2: { src:'/sprites/tiles2/door_wood2', frames:5 },
  doorIron2: { src:'/sprites/tiles2/door_iron2', frames:5 },
  chestBig:   { src:'/sprites/tiles2/chest_big',   frames:5 },
  chestSmall: { src:'/sprites/tiles2/chest_small', frames:5 },
  lever:      { src:'/sprites/tiles2/lever',       frames:3 },
};
const GOLDEN_KEY_SRC = '/sprites/items/golden_key.png';

// ---- image cache + loader ----
const _img = {};
function loadImg(src){
  return new Promise(res=>{
    if(_img[src]) return res(_img[src]);
    const im=new Image(); im.onload=()=>{_img[src]=im;res(im);};
    im.onerror=()=>{ console.warn('img fail',src); res(null);}; im.src=src;
  });
}
function img(src){ return _img[src]||null; }

// Small, fast preload used by the title screen: just the 3 hero idle
// sprites needed for the character-select preview thumbnails. Loading only
// this tiny set (instead of the whole game's art via preloadAll) is what
// lets the hero previews appear almost instantly instead of waiting for
// every monster/decor/background sprite in the game to finish downloading
// first. loadImg() caches by src, so preloadAll() later won't re-fetch these.
async function preloadHeroPreviews(){
  const srcs = Object.values(HERO).map(h=>h.idle.src);
  await Promise.all(srcs.map(loadImg));
}

async function preloadLPCHero(){
  const srcs=new Set();
  const animFolders={walk:'walkcycle',idle:'walkcycle',hurt:'hurt',slash:'slash',thrust:'thrust',shoot:'bow'};
  ['walk','idle','hurt','slash','thrust','shoot'].forEach(k=>LPC_HERO[k]&&srcs.add(LPC_HERO[k].src));
  Object.values(LPC_ARMOR).forEach(a=>{
    Object.keys(animFolders).forEach(k=>{
      Object.values(a).forEach(fn=>srcs.add(`${LPC_BASE}/${animFolders[k]}/${fn}`));
    });
  });
  Object.values(NS_WEAPON).forEach(w=>srcs.add(w.src));
  await Promise.all([...srcs].map(loadImg));
}

async function preloadAll(){
  const srcs=new Set();
  Object.values(HERO).forEach(h=>['idle','walk','death'].forEach(k=>h[k]&&srcs.add(h[k].src)));
  Object.values(MON).forEach(m=>['idle','walk','attack','death'].forEach(k=>m[k]&&srcs.add(m[k].src)));
  // LPC hero (Phase 5.3 Task 5) — folded into the main preload so both the
  // fresh-start title-screen path AND the "Continue" saved-session path
  // (which skips preloadHeroPreviews entirely, see boot() in game.js)
  // have gear-visual assets ready before the dungeon renders.
  { const animFolders={walk:'walkcycle',idle:'walkcycle',hurt:'hurt',slash:'slash',thrust:'thrust',shoot:'bow'};
    ['walk','idle','hurt','slash','thrust','shoot'].forEach(k=>LPC_HERO[k]&&srcs.add(LPC_HERO[k].src));
    Object.values(LPC_ARMOR).forEach(a=>{
      Object.keys(animFolders).forEach(k=>{
        Object.values(a).forEach(fn=>srcs.add(`${LPC_BASE}/${animFolders[k]}/${fn}`));
      });
    });
    Object.values(NS_WEAPON).forEach(w=>srcs.add(w.src));
  }
  [ORC_SHAMAN_ARCH, SKEL_MAGE_ARCH, SKEL_WARRIOR_ARCH].forEach(a=>{
    const m=MON[a.mon]; ['idle','walk','death'].forEach(k=>m[k]&&srcs.add(m[k].src));
  });
  backgrounds.forEach(b=>srcs.add(b));
  srcs.add(GOLDEN_KEY_SRC);
  Object.values(DECOR_SPRITES).forEach(d=>{
    for(let i=0;i<d.frames;i++) srcs.add(`${d.src}/frame_${i}.png`);
  });
  await Promise.all([...srcs].map(loadImg));
}

// ---- per-act dungeon color themes (ancient-ruin palettes) ----
// Base colors sampled from the reference tilesets, extended with the
// earth/dirt, moss, crack and torch tones the procedural tile-texture
// renderer in game.js uses to give floors and walls their aged gradation
// (worn flagstones, packed-earth patches, mossy corners, rough masonry).
// `torch` is stored as bare 'r,g,b' so the renderer can append any alpha.
const DUNGEON_THEMES = {
  bluestone: {
    key:'bluestone',
    wallFill:'#232231', wallEdge:'rgba(128,138,163,.4)',
    floorA:'#343446', floorB:'#3f3f53', floorSpeckle:'rgba(128,138,163,.12)',
    dirtA:'#3b2f22', dirtB:'#2f2519', moss:'rgba(96,124,72,.30)',
    crack:'rgba(10,8,16,.55)', torch:'255,166,66',
    roomGlow:'rgba(146,153,192,0.16)', corridorGlow:'rgba(105,101,132,0.06)',
    door:'doorIron', chest:'chestBig',
  },
  catacombs: {
    key:'catacombs',
    wallFill:'#191010', wallEdge:'rgba(69,65,53,.4)',
    floorA:'#2e2a25', floorB:'#312220', floorSpeckle:'rgba(69,65,53,.14)',
    dirtA:'#33261a', dirtB:'#271d13', moss:'rgba(104,112,60,.28)',
    crack:'rgba(8,5,4,.6)', torch:'255,150,60',
    roomGlow:'rgba(180,140,90,0.14)', corridorGlow:'rgba(120,90,60,0.06)',
    door:'doorWood', chest:'chestSmall',
  },
  icestone: {
    key:'icestone',
    wallFill:'#132430', wallEdge:'rgba(150,200,220,.35)',
    floorA:'#1d3a4a', floorB:'#234458', floorSpeckle:'rgba(180,225,240,.14)',
    dirtA:'#2c3038', dirtB:'#22262d', moss:'rgba(110,150,140,.25)',
    crack:'rgba(4,10,16,.55)', torch:'190,220,255',
    roomGlow:'rgba(170,220,235,0.17)', corridorGlow:'rgba(110,170,190,0.07)',
    door:'doorIron2', chest:'chestBig',
  },
  voidstone: {
    key:'voidstone',
    wallFill:'#1f1229', wallEdge:'rgba(180,120,220,.35)',
    floorA:'#2c1838', floorB:'#341d42', floorSpeckle:'rgba(200,140,230,.13)',
    dirtA:'#31213a', dirtB:'#261830', moss:'rgba(140,100,170,.22)',
    crack:'rgba(12,4,18,.6)', torch:'220,150,255',
    roomGlow:'rgba(190,130,225,0.16)', corridorGlow:'rgba(130,80,160,0.07)',
    door:'doorWood2', chest:'chestSmall',
  },
};

window.NS_ASSETS={HERO,MON,ARCHETYPES,BOSS_ARCH,ORC_SHAMAN_ARCH,SKEL_MAGE_ARCH,SKEL_WARRIOR_ARCH,
  DUNGEON_THEMES,
  LPC_DIRS,LPC_BASE,LPC_HERO,LPC_ARMOR,NS_WEAPON,LPC_HAND,LPC_BACK,LPC_HAND_BOB,LPC_REST_ANG,preloadLPCHero,
  DECOR_SPRITES,GOLDEN_KEY_SRC,backgrounds,BG_BY_KEY,loadImg,img,preloadAll,preloadHeroPreviews};
