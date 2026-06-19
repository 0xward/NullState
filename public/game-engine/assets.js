/* ============================================================
   NULL_STATE :: ASSETS  (sprite sheets + loader + archetypes)
   Frame layouts verified from source sheets.
   ============================================================ */
// scale chosen so on-screen character height (contentH*scale) is consistent (~64px)
const HERO = {
  male: {
    idle:   { src:'/sprites/hero/idle.png',   fw:288, fh:240, frames:8, fps:8 },
    walk:   { src:'/sprites/hero/run.png',    fw:288, fh:240, frames:8, fps:13 },
    attack: { src:'/sprites/hero/attack.png', fw:288, fh:240, frames:8, fps:18 },
    scale:0.63, foot:0.725,   // contentH 102 -> ~64px
  },
  female: {
    idle:   { src:'/sprites/hero/female_idle.png',   fw:192, fh:192, frames:6, fps:7 },
    walk:   { src:'/sprites/hero/female_walk.png',   fw:192, fh:192, frames:6, fps:12 },
    attack: { src:'/sprites/hero/female_attack.png', fw:192, fh:192, frames:6, fps:16 },
    scale:0.82, foot:0.688,   // contentH 78 -> ~64px
  },
};

// monster sprite sheets (foot = fraction of frame height where feet rest)
const MON = {
  mummy:    { idle:{src:'/sprites/monsters/mummy_idle.png',  fw:128,fh:128,frames:8 },
              attack:{src:'/sprites/monsters/mummy_attack.png',fw:128,fh:128,frames:10}, scale:0.95, foot:0.852 },
  ice:      { idle:{src:'/sprites/monsters/ice_idle.png',    fw:128,fh:128,frames:8 },
              attack:{src:'/sprites/monsters/ice_attack.png',fw:128,fh:128,frames:10}, scale:0.95, foot:0.859 },
  shadow:   { idle:{src:'/sprites/monsters/shadow_idle.png', fw:180,fh:180,frames:5 },
              attack:{src:'/sprites/monsters/shadow_attack.png',fw:180,fh:180,frames:6}, scale:0.8, foot:0.872 },
  creature: { idle:{src:'/sprites/monsters/creature_idle.png',fw:256,fh:256,frames:16},
              attack:{src:'/sprites/monsters/creature_attack.png',fw:256,fh:256,frames:16}, scale:0.7, foot:0.648 },
  boss:     { idle:{src:'/sprites/monsters/boss_idle.png',   fw:256,fh:256,frames:6 },
              attack:{src:'/sprites/monsters/boss_attack.png',fw:256,fh:256,frames:8 }, scale:1.2, foot:0.969 },
};

// enemy archetypes (stats are base @ floor 1, scaled by floor)
const ARCHETYPES = [
  { key:'mummy',    name:'Husk of the Forgotten', hp:46, dmg:8,  spd:34, xp:38, color:'#caa15a', r:16 },
  { key:'ice',      name:'Frost Wraith',          hp:40, dmg:10, spd:46, xp:42, color:'#7fd8ff', r:15 },
  { key:'shadow',   name:'Null Shade',            hp:34, dmg:12, spd:62, xp:50, color:'#a06bff', r:14 },
  { key:'creature', name:'Voidspawn',             hp:64, dmg:9,  spd:40, xp:60, color:'#5dff9e', r:20 },
];
const BOSS_ARCH = { key:'boss', name:'THE GATEKEEPER', hp:420, dmg:20, spd:38, xp:600, color:'#ff3b5c', r:34 };

const backgrounds = ['/backgrounds/forest.png','/backgrounds/desert.png',
  '/backgrounds/snow.png','/backgrounds/field.png','/backgrounds/back.png'];

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
  Object.values(HERO).forEach(h=>['idle','walk','attack'].forEach(k=>srcs.add(h[k].src)));
  Object.values(MON).forEach(m=>['idle','attack'].forEach(k=>srcs.add(m[k].src)));
  backgrounds.forEach(b=>srcs.add(b));
  await Promise.all([...srcs].map(loadImg));
}

window.NS_ASSETS={HERO,MON,ARCHETYPES,BOSS_ARCH,backgrounds,loadImg,img,preloadAll};
