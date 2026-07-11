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
const LPC_EXP  = '/sprites/lpc_source/expansion/normalized_64px';
const LPC_EXP2 = '/sprites/lpc_source/expansion2/normalized_64px';

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
  leather_guard: { torso:'TORSO_leather_armor_torso.png', legs:'LEGS_pants_greenish.png', feet:'FEET_shoes_brown.png' },
  iron_plate:    { torso:'TORSO_chain_armor_torso.png',   legs:'LEGS_plate_armor_pants.png', feet:'FEET_plate_armor_shoes.png' },
  rune_armor:    { torso:'TORSO_plate_armor_torso.png',   legs:'LEGS_plate_armor_pants.png', feet:'FEET_plate_armor_shoes.png', head:'HEAD_plate_armor_helmet.png' },
};

// Weapon id -> which body-relative animation folder its overlay sheet
// lives in ('slash' or 'thrust') + the overlay file itself. Confirmed
// this session (direct-stack, verified via composite test):
//   war_axe, void_reaper — found in LPC generator GitHub repo this
//   session (was "missing asset" in prior sessions' plan), downscaled
//   from their 192px oversize cells to 64px same as longsword/rapier.
// hunters_bow: WIRED this session — user picked Option A (dedicated
// archer body pose, see LPC_HERO.shoot above) over particle-only FX.
// twin_daggers (double_hit) reuses WEAPON_dagger.png rendered twice by
// the engine (existing double_hit FX timing) — overlay wiring done.
const LPC_WEAPON = {
  rusty_blade:   { anim:'slash',  src:`${LPC_BASE}/slash/WEAPON_dagger.png` },
  ancient_blade: { anim:'slash',  src:`${LPC_EXP}/WEAPON_longsword.png` },
  war_axe:       { anim:'slash',  src:`${LPC_EXP2}/WEAPON_waraxe_attack_slash.png` },
  void_reaper:   { anim:'slash',  src:`${LPC_EXP2}/WEAPON_scythe_attack_slash.png` },
  frost_spear:   { anim:'thrust', src:`${LPC_EXP}/WEAPON_long_spear.png` },
  // twin_daggers: reuses the same dagger overlay as rusty_blade, but with
  // `double:true` so drawLPCComposite() (see entities.js) draws it twice
  // at a small offset, reading as two blades instead of one. Rides the
  // existing double_hit swing timing/FX — no separate animation needed.
  twin_daggers:  { anim:'slash',  src:`${LPC_BASE}/slash/WEAPON_dagger.png`, double:true },
  // hunters_bow: own body pose ('shoot', see LPC_HERO above) + its own
  // overlay sheet, same 13-frame/4-dir grid as the body. marketplace-items.js
  // already tags this weapon `behavior:'ranged'` — the existing arrow/FX
  // system in game.js is untouched, this only adds the visual bow-draw
  // pose+overlay during the attack window.
  hunters_bow:   { anim:'shoot',  src:`${LPC_BASE}/bow/WEAPON_bow.png` },
};

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
};

// enemy archetypes (stats are base @ floor 1, scaled by floor).
// 'mummy'/'boss' keys are gone — replaced by the Orc/Skeleton crews. Any
// code that gated logic on `arch.key==='mummy'` (e.g. the lift's floor-clear
// check) now keys off `isUndead` (skeleton crew) instead — see game.js.
const ARCHETYPES = [
  { key:'orc_base',    mon:'orc_base',    name:'Orc Raider',       hp:92, dmg:9,  spd:42, xp:38, color:'#7fae5a', r:15 },
  { key:'orc_rogue',   mon:'orc_rogue',   name:'Orc Skulker',      hp:80, dmg:11, spd:54, xp:44, color:'#6a9650', r:14 },
  { key:'orc_warrior',  mon:'orc_warrior',  name:'Orc Warrior',      hp:126, dmg:13, spd:36, xp:52, color:'#5c8a46', r:17, isUndead:false },
  { key:'skel_base',    mon:'skel_base',    name:'Restless Bones',   hp:76, dmg:8,  spd:44, xp:36, color:'#cbb98e', r:14, isUndead:true },
  { key:'skel_rogue',   mon:'skel_rogue',   name:'Bone Skulker',     hp:68, dmg:10, spd:58, xp:42, color:'#b3a378', r:14, isUndead:true },
  { key:'skel_reaper',  mon:'skel_reaper',  name:'Reaper Skeleton',  hp:100, dmg:12, spd:46, xp:50, color:'#cfd6e6', r:15, isUndead:true },
  { key:'vampire',      mon:'vampire',      name:'Crypt Vampire',    hp:116, dmg:14, spd:50, xp:55, color:'#8a2f4a', r:15, isUndead:true },
];
const ORC_SHAMAN_ARCH = { key:'orc_shaman', mon:'orc_shaman', name:'Orc Shaman', hp:104, dmg:14, spd:40, xp:60, color:'#4a7a3a', r:16 };
const SKEL_MAGE_ARCH   = { key:'skel_mage',  mon:'skel_mage',  name:'Bone Caster', hp:88, dmg:15, spd:40, xp:58, color:'#8f9bb8', r:15, isUndead:true };
const SKEL_WARRIOR_ARCH= { key:'skel_warrior', mon:'skel_warrior', name:'Bone Warrior', hp:138, dmg:14, spd:34, xp:56, color:'#9c8f6e', r:17, isUndead:true };
const BOSS_ARCH = { key:'orc_warrior', mon:'orc_warrior', name:'THE WARLORD', hp:1100, dmg:20, spd:38, xp:600, color:'#ff3b5c', r:30, isBossScale:true };

const backgrounds = ['/backgrounds/forest.png','/backgrounds/desert.png',
  '/backgrounds/snow.png','/backgrounds/field.png','/backgrounds/back.png'];
const BG_BY_KEY = {
  forest:'/backgrounds/forest.png', desert:'/backgrounds/desert.png',
  snow:'/backgrounds/snow.png', field:'/backgrounds/field.png', back:'/backgrounds/back.png',
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
  Object.values(LPC_WEAPON).forEach(w=>srcs.add(w.src));
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
    Object.values(LPC_WEAPON).forEach(w=>srcs.add(w.src));
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
  LPC_DIRS,LPC_BASE,LPC_HERO,LPC_ARMOR,LPC_WEAPON,preloadLPCHero,
  DECOR_SPRITES,GOLDEN_KEY_SRC,backgrounds,BG_BY_KEY,loadImg,img,preloadAll,preloadHeroPreviews};
