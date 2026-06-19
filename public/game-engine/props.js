/* ============================================================
   NULL_STATE :: PROPS  (breakable room decorations + loot)
   Drawn as vector pixel-art (no external sprites needed).
   (x,y) = base/feet position on the floor.
   Decorations hug the nearest wall and FACE INTO THE ROOM:
     facing 'down'  = against the top wall    (6 o'clock, front view)
     facing 'up'    = against the bottom wall (12 o'clock, seen from behind)
     facing 'right' = against the left wall   (3 o'clock, side profile)
     facing 'left'  = against the right wall  (9 o'clock, side profile)
   ============================================================ */
const DECOR_TYPES = {
  vase:     { hp:1, w:24, h:38, label:'Vase',          loot:[['hp',6,55],['xp',12,30],['none',0,15]] },
  pot:      { hp:1, w:30, h:30, label:'Planter',       loot:[['hp',8,60],['xp',10,25],['none',0,15]] },
  barrel:   { hp:2, w:30, h:40, label:'Barrel',        loot:[['xp',18,45],['hp',10,35],['none',0,20]] },
  crate:    { hp:2, w:34, h:34, label:'Crate',         loot:[['xp',22,55],['hp',8,30],['none',0,15]] },
  cabinet_s:{ hp:2, w:34, h:46, label:'Cabinet',       loot:[['hp',14,45],['xp',24,40],['celo',0.01,15]] },
  wardrobe: { hp:3, w:48, h:64, label:'Old Wardrobe',  loot:[['hp',32,40],['xp',55,40],['celo',0.01,20]] },
  chest:    { hp:2, w:42, h:34, label:'Lost Cache',    loot:[['celo',0.01,45],['xp',60,35],['hp',30,20]] },
};

function rollLoot(table){
  const total=table.reduce((s,t)=>s+t[2],0);
  let r=Math.random()*total;
  for(const t of table){ r-=t[2]; if(r<=0) return {kind:t[0],amt:t[1]}; }
  return {kind:'none',amt:0};
}

class Decor {
  constructor(type, x, y, facing='down'){
    const def=DECOR_TYPES[type];
    this.type=type; this.def=def; this.x=x; this.y=y;
    this.facing=facing;                 // 'down' | 'up' | 'left' | 'right'
    this.maxHp=def.hp; this.hp=def.hp;
    this.r=def.w*0.55; this.h=def.h;
    this.broken=false; this.brokenT=0; this.hitFlash=0; this.shake=0;
    this.bob=Math.random()*Math.PI*2;
  }
  hit(dmg){
    if(this.broken) return false;
    this.hp-=1; this.hitFlash=0.16; this.shake=4;
    if(this.hp<=0){ this.broken=true; this.brokenT=0.45; return true; }
    return false;
  }
  update(dt){
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.shake>0) this.shake=Math.max(0,this.shake-dt*22);
    if(this.broken) this.brokenT-=dt;
    this.bob+=dt;
  }
  rect(ctx,x,y,w,h,col){ ctx.fillStyle=col; ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); }
  draw(ctx){
    if(this.broken && this.brokenT<=0) return;
    const a = this.broken ? Math.max(0,this.brokenT/0.45) : 1;
    const sx=this.shake>0?(Math.random()*2-1)*this.shake:0;
    const f=this.facing||'down';
    const side = (f==='left'||f==='right');

    // ---- contact shadow: anchors the prop to the floor/wall so it doesn't float ----
    ctx.save();
    ctx.globalAlpha=0.34*a; ctx.fillStyle='#000';
    // shadow stretches a touch INTO the room (away from the wall) for grounding
    let shx=this.x, shy=this.y+2;
    if(f==='down') shy=this.y+1;
    else if(f==='up') shy=this.y+3;
    else if(f==='right') shx=this.x+3;
    else if(f==='left')  shx=this.x-3;
    ctx.beginPath(); ctx.ellipse(shx, shy, this.r*1.12, 5.5, 0, 0, 7); ctx.fill();
    ctx.restore();

    // ---- body ----
    ctx.save();
    ctx.globalAlpha=a;
    ctx.translate(this.x+sx, this.y);
    ctx.imageSmoothingEnabled=false;

    // Orientation: side walls -> mirrored narrow profile (never upside-down).
    if(side){
      const dir = (f==='right') ? 1 : -1;   // left wall faces right(+), right wall faces left(-)
      ctx.scale(0.82*dir, 1);
    }

    // Blend with the dark dungeon + convey facing through lighting.
    // (ctx.filter only affects the shape we draw next, not the background.)
    let filt='saturate(0.82) brightness(0.92)';
    if(f==='up')        filt='saturate(0.6) brightness(0.55)';   // back, in wall shadow
    else if(side)       filt='saturate(0.74) brightness(0.8)';   // turned, partly shaded
    ctx.filter=filt;
    this.shape(ctx, f);
    ctx.filter='none';

    // hit flash overlay (silhouette)
    if(this.hitFlash>0){
      ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=this.hitFlash*2.2;
      ctx.fillStyle='#fff';
      this.shapeMask(ctx);
      ctx.globalCompositeOperation='source-over';
    }
    ctx.restore();
  }
  // colored body. `facing` controls whether front-only details are shown:
  // when seen from behind (facing 'up') the handles / locks / highlights are hidden.
  shape(ctx, facing='down'){
    const t=this.type, R=this.rect.bind(this,ctx);
    const front = facing!=='up';     // show front detailing?
    if(t==='vase'){
      R(-12,-30,24,8,'#1f6f63'); R(-9,-32,18,4,'#2a8f7e');     // neck
      R(-14,-24,28,20,'#1b5f56'); R(-10,-24,20,20,'#247a6d');  // body
      R(-10,-6,20,6,'#143f3a');
      if(front) R(-4,-22,4,16,'#39a892');                      // front highlight
    } else if(t==='pot'){
      R(-15,-12,30,12,'#7a4a2a'); R(-15,-12,30,3,'#945e3a');
      R(-3,-30,6,18,'#2f7d3a'); R(-12,-24,12,5,'#3c9a49');     // leaves (visible all sides)
      R(2,-26,12,5,'#3c9a49'); R(-10,-20,9,4,'#48b557');
    } else if(t==='barrel'){
      R(-15,-40,30,40,'#6b4326');
      R(-15,-34,30,4,'#3f2916'); R(-15,-16,30,4,'#3f2916');    // hoops (symmetric)
      R(-15,-40,4,40,'#7d5230'); R(11,-40,4,40,'#52341d');     // shading
    } else if(t==='crate'){
      R(-17,-34,34,34,'#7a5630');
      ctx.strokeStyle='#4d3318'; ctx.lineWidth=2; ctx.strokeRect(-16,-33,32,32);
      if(front){ ctx.beginPath(); ctx.moveTo(-16,-33); ctx.lineTo(16,-1); ctx.moveTo(16,-33); ctx.lineTo(-16,-1); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(-16,-17); ctx.lineTo(16,-17); ctx.stroke(); } // plain back plank
    } else if(t==='cabinet_s'){
      R(-17,-46,34,46,'#5a3a22'); R(-17,-46,34,3,'#744c2c');
      R(-15,-43,28,40,'#6e472a');
      if(front){
        ctx.strokeStyle='#3a2514'; ctx.lineWidth=1.5;
        ctx.strokeRect(-15,-43,14,40); ctx.strokeRect(1,-43,14,40);  // doors
        R(-3,-26,2,5,'#caa15a'); R(3,-26,2,5,'#caa15a');             // knobs
      } else {
        ctx.strokeStyle='#3a2514'; ctx.lineWidth=1.5; ctx.strokeRect(-15,-43,30,40); // plain back
      }
    } else if(t==='wardrobe'){
      R(-24,-64,48,64,'#4a2f1c'); R(-24,-64,48,4,'#6b452a');
      R(-21,-60,42,56,'#5d3b23');
      if(front){
        ctx.strokeStyle='#2e1d10'; ctx.lineWidth=2;
        ctx.strokeRect(-21,-60,21,56); ctx.strokeRect(0,-60,21,56);  // doors
        R(-4,-36,3,8,'#caa15a'); R(2,-36,3,8,'#caa15a');             // handles
      } else {
        ctx.strokeStyle='#2e1d10'; ctx.lineWidth=2; ctx.strokeRect(-21,-60,42,56); // plain back
      }
      R(-21,-6,42,6,'#3a2514');                                       // base
    } else if(t==='chest'){
      R(-21,-18,42,18,'#6b4326');                               // base
      ctx.beginPath(); ctx.fillStyle='#7d5230';
      ctx.moveTo(-21,-18); ctx.quadraticCurveTo(0,-34,21,-18); ctx.lineTo(21,-18); ctx.lineTo(-21,-18); ctx.fill();
      R(-21,-20,42,4,'#caa15a');                                // trim band (visible all sides)
      if(front){
        R(-3,-22,6,10,'#e0c074');                               // front lock
        R(-21,-18,4,18,'#caa15a'); R(17,-18,4,18,'#caa15a');    // corner straps
      }
    }
  }
  // solid silhouette for hit-flash overlay
  shapeMask(ctx){
    const h=this.def.h, w=this.def.w;
    ctx.fillRect(-w/2, -h, w, h);
  }
}
window.NS_PROPS={Decor,DECOR_TYPES,rollLoot};
