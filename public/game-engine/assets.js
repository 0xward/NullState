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
  { key:'orc_base',    mon:'orc_base',    name:'Orc Raider',       hp:42, dmg:9,  spd:42, xp:38, color:'#7fae5a', r:15 },
  { key:'orc_rogue',   mon:'orc_rogue',   name:'Orc Skulker',      hp:36, dmg:11, spd:54, xp:44, color:'#6a9650', r:14 },
  { key:'orc_warrior',  mon:'orc_warrior',  name:'Orc Warrior',      hp:58, dmg:13, spd:36, xp:52, color:'#5c8a46', r:17, isUndead:false },
  { key:'skel_base',    mon:'skel_base',    name:'Restless Bones',   hp:34, dmg:8,  spd:44, xp:36, color:'#cbb98e', r:14, isUndead:true },
  { key:'skel_rogue',   mon:'skel_rogue',   name:'Bone Skulker',     hp:30, dmg:10, spd:58, xp:42, color:'#b3a378', r:14, isUndead:true },
  { key:'skel_reaper',  mon:'skel_reaper',  name:'Reaper Skeleton',  hp:46, dmg:12, spd:46, xp:50, color:'#cfd6e6', r:15, isUndead:true },
  { key:'vampire',      mon:'vampire',      name:'Crypt Vampire',    hp:54, dmg:14, spd:50, xp:55, color:'#8a2f4a', r:15, isUndead:true },
];
const ORC_SHAMAN_ARCH = { key:'orc_shaman', mon:'orc_shaman', name:'Orc Shaman', hp:48, dmg:14, spd:40, xp:60, color:'#4a7a3a', r:16 };
const SKEL_MAGE_ARCH   = { key:'skel_mage',  mon:'skel_mage',  name:'Bone Caster', hp:40, dmg:15, spd:40, xp:58, color:'#8f9bb8', r:15, isUndead:true };
const SKEL_WARRIOR_ARCH= { key:'skel_warrior', mon:'skel_warrior', name:'Bone Warrior', hp:64, dmg:14, spd:34, xp:56, color:'#9c8f6e', r:17, isUndead:true };
const BOSS_ARCH = { key:'orc_warrior', mon:'orc_warrior', name:'THE WARLORD', hp:420, dmg:20, spd:38, xp:600, color:'#ff3b5c', r:30, isBossScale:true };

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

async function preloadAll(){
  const srcs=new Set();
  Object.values(HERO).forEach(h=>['idle','walk','death'].forEach(k=>h[k]&&srcs.add(h[k].src)));
  Object.values(MON).forEach(m=>['idle','walk','death'].forEach(k=>m[k]&&srcs.add(m[k].src)));
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

// ---- per-act dungeon color themes ----
// Colors sampled directly from the reference tilesets (bluestone from the
// free top-down dungeon pack, catacombs from RF Catacombs) so the
// code-rendered walls/floors carry an authentic palette instead of a
// single hardcoded color for every act. icestone/voidstone are derived
// variants (hue-shifted) for additional variety across acts that don't
// have a directly-sampled source tileset.
const DUNGEON_THEMES = {
  bluestone: {
    wallFill:'#1d1c2b', wallEdge:'rgba(128,138,163,.4)',
    floorA:'#343446', floorB:'#3f3f53', floorSpeckle:'rgba(128,138,163,.12)',
    roomGlow:'rgba(146,153,192,0.16)', corridorGlow:'rgba(105,101,132,0.06)',
    door:'doorIron', chest:'chestBig',
  },
  catacombs: {
    wallFill:'#140e0e', wallEdge:'rgba(69,65,53,.4)',
    floorA:'#2e2a25', floorB:'#312220', floorSpeckle:'rgba(69,65,53,.14)',
    roomGlow:'rgba(180,140,90,0.14)', corridorGlow:'rgba(120,90,60,0.06)',
    door:'doorWood', chest:'chestSmall',
  },
  icestone: {
    wallFill:'#10202c', wallEdge:'rgba(150,200,220,.35)',
    floorA:'#1d3a4a', floorB:'#234458', floorSpeckle:'rgba(180,225,240,.14)',
    roomGlow:'rgba(170,220,235,0.17)', corridorGlow:'rgba(110,170,190,0.07)',
    door:'doorIron2', chest:'chestBig',
  },
  voidstone: {
    wallFill:'#1a0f24', wallEdge:'rgba(180,120,220,.35)',
    floorA:'#2c1838', floorB:'#341d42', floorSpeckle:'rgba(200,140,230,.13)',
    roomGlow:'rgba(190,130,225,0.16)', corridorGlow:'rgba(130,80,160,0.07)',
    door:'doorWood2', chest:'chestSmall',
  },
};

window.NS_ASSETS={HERO,MON,ARCHETYPES,BOSS_ARCH,ORC_SHAMAN_ARCH,SKEL_MAGE_ARCH,SKEL_WARRIOR_ARCH,
  DUNGEON_THEMES,
  DECOR_SPRITES,GOLDEN_KEY_SRC,backgrounds,BG_BY_KEY,loadImg,img,preloadAll};
