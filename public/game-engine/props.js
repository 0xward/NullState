/* ============================================================
   NULL_STATE :: PROPS  (breakable ancient decorations + loot)
   Drawn as vector pixel-art (no external sprites needed).
   (x,y) = base/feet position on the floor.
   Everything here is era-appropriate for a forgotten ancient
   ruin: clay vessels, burial urns, cracked columns, braziers,
   bone piles, cave crystals, engraved tablets, weathered idols.
   Smashing the right pieces can drop a rare 'relic' (handled by
   applyLoot in game.js and stored in the player's inventory).
   Decorations hug the nearest wall and FACE INTO THE ROOM:
     facing 'down'  = against the top wall    (6 o'clock, front view)
     facing 'up'    = against the bottom wall (12 o'clock, seen from behind)
     facing 'right' = against the left wall   (3 o'clock, side profile)
     facing 'left'  = against the right wall  (9 o'clock, side profile)
   ============================================================ */
const DECOR_TYPES = {
  // ---- breakable decorations: smash them for loot ----
  vase:     { hp:1, w:24, h:38, label:'Glazed Vase',     loot:[['hp',6,50],['xp',12,32],['relic',1,4],['none',0,14]] },
  pot:      { hp:1, w:30, h:30, label:'Herb Pot',        loot:[['hp',8,58],['xp',10,26],['none',0,16]] },
  barrel:   { hp:2, w:30, h:40, label:'Old Barrel',      loot:[['xp',18,45],['hp',10,35],['none',0,20]] },
  crate:    { hp:2, w:34, h:34, label:'Supply Crate',    loot:[['xp',22,45],['hp',8,25],['item',1,20],['none',0,10]] },
  cabinet_s:{ hp:2, w:34, h:46, label:'Scroll Cabinet',  loot:[['hp',14,26],['xp',24,24],['item',2,30],['relic',1,10],['celo',0.01,10]], interactive:true },
  wardrobe: { hp:3, w:48, h:64, label:'Rotten Armoire',  loot:[['hp',32,24],['xp',55,24],['item',2,32],['celo',0.01,20]], interactive:true },
  // ---- ancient ornaments: break them for XP, CELO, or rare relics ----
  urn:      { hp:1, w:30, h:44, label:'Burial Urn',      loot:[['xp',20,40],['hp',10,28],['relic',1,12],['none',0,20]] },
  column:   { hp:3, w:34, h:60, label:'Cracked Column',  loot:[['xp',26,50],['hp',12,26],['relic',1,8],['none',0,16]] },
  brazier:  { hp:2, w:30, h:40, label:'Bronze Brazier',  loot:[['xp',24,48],['hp',10,30],['celo',0.01,10],['none',0,12]] },
  bones:    { hp:1, w:36, h:18, label:'Bone Pile',       loot:[['xp',10,45],['hp',6,25],['relic',1,5],['none',0,25]] },
  rubble:   { hp:1, w:36, h:20, label:'Fallen Stones',   loot:[['xp',10,45],['hp',6,20],['none',0,35]] },
  crystal:  { hp:2, w:26, h:40, label:'Cave Crystal',    loot:[['celo',0.01,25],['relic',1,20],['item',2,20],['xp',30,20],['none',0,15]] },
  tablet:   { hp:2, w:36, h:48, label:'Engraved Tablet', loot:[['relic',1,30],['item',3,25],['xp',40,25],['celo',0.01,20]] },
  statue:   { hp:3, w:36, h:62, label:'Weathered Idol',  loot:[['relic',1,30],['item',3,30],['celo',0.02,20],['xp',50,20]] },
  // ---- interactive containers: opened via interact/OPEN button, not combat ----
  chest:    { hp:2, w:42, h:34, label:'Lost Cache',      loot:[['celo',0.01,25],['relic',1,15],['item',3,35],['xp',60,15],['hp',30,10]], interactive:true },
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
    // Interactive containers (chests): opened via interact key, not combat.
    this.interactive=!!def.interactive;
    this.opened=false; this.openT=0;
  }
  hit(dmg){
    if(this.broken) return false;
    // Interactive containers cannot be damaged by combat swings.
    if(this.interactive) return false;
    this.hp-=1; this.hitFlash=0.16; this.shake=4;
    if(this.hp<=0){ this.broken=true; this.brokenT=0.45; return true; }
    return false;
  }
  // Open an interactive container (called from tryInteract / OPEN button).
  // Returns true if this interaction consumed the container (first open).
  open(){
    if(!this.interactive || this.opened) return false;
    this.opened=true; this.openT=0.6;
    this.rollLootSlots();
    return true;
  }
  // Generate (once) 2-4 loot slots for the dual-panel container window.
  // Each slot resolves 'item' draws into a concrete NS_ITEMS entry so the
  // window can show a real name/icon/rarity/burn-value preview immediately,
  // while non-item draws (hp/xp/celo/relic) stay as simple amount pickups.
  rollLootSlots(){
    if(this.lootSlots) return this.lootSlots;
    const table=this.def.loot||[];
    const n=2+Math.floor(Math.random()*3); // 2-4 slots
    const slots=[];
    for(let i=0;i<n;i++){
      const draw=rollLoot(table);
      if(draw.kind==='none') continue;
      if(draw.kind==='item'){
        const tier=draw.amt||1;
        const it=(window.NS_ITEMS && window.NS_ITEMS.rollItemDrop(tier))||null;
        if(!it) continue;
        const qty=(it.rarity==='common'||it.rarity==='uncommon')?(1+Math.floor(Math.random()*3)):1;
        slots.push({slotId:'s'+i, kind:'item', item:it, qty, taken:false});
      } else {
        slots.push({slotId:'s'+i, kind:draw.kind, amt:draw.amt, taken:false});
      }
    }
    this.lootSlots=slots;
    return slots;
  }
  update(dt){
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.shake>0) this.shake=Math.max(0,this.shake-dt*22);
    if(this.broken) this.brokenT-=dt;
    if(this.openT>0) this.openT-=dt;
    this.bob+=dt;
  }
  rect(ctx,x,y,w,h,col){ ctx.fillStyle=col; ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); }
  draw(ctx){
    if(this.broken && this.brokenT<=0) return;
    // Opened interactive containers fade to a dim "opened" look, then persist.
    const isOpened = this.interactive && this.opened;
    const a = this.broken ? Math.max(0,this.brokenT/0.45)
            : isOpened ? Math.max(0.5, 1 - (1 - Math.max(0, this.openT/0.6)) * 0.5)
            : 1;
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
    // A 'multiply' tint overlay gets a visually close darken/desaturate
    // look at a fraction of the render cost of ctx.filter.
    let tint = null; // [color, alpha] or null for no tint
    if(f==='up')        tint = ['#3a4a48', 0.42];   // back, in wall shadow
    else if(side)       tint = ['#4a5a55', 0.26];   // turned, partly shaded
    else                tint = ['#5a6a62', 0.12];   // facing camera, slight blend
    this.shape(ctx, f);
    if(tint){
      ctx.save();
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=tint[1]*a;
      ctx.fillStyle=tint[0];
      this.shapeMask(ctx);
      ctx.restore();
    }

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
  // when seen from behind (facing 'up') the handles / engravings / highlights are hidden.
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
        R(-13,-40,10,3,'#d9cba8'); R(3,-38,9,3,'#d9cba8');           // rolled scrolls peeking out
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
      if(this.opened){
        // Opened chest: lid hinged back, empty interior visible
        R(-21,-18,42,18,'#6b4326');                               // base
        R(-21,-20,42,4,'#caa15a');                                // trim band
        R(-19,-16,38,14,'#3a2514');                               // dark interior
        if(front){
          // Lid tilted back behind the chest
          ctx.beginPath(); ctx.fillStyle='#7d5230';
          ctx.moveTo(-21,-18); ctx.quadraticCurveTo(-24,-30,-18,-34);
          ctx.lineTo(-21,-18); ctx.fill();
          R(-21,-18,4,18,'#caa15a'); R(17,-18,4,18,'#caa15a');    // corner straps
        }
      } else {
        R(-21,-18,42,18,'#6b4326');                               // base
        ctx.beginPath(); ctx.fillStyle='#7d5230';
        ctx.moveTo(-21,-18); ctx.quadraticCurveTo(0,-34,21,-18); ctx.lineTo(21,-18); ctx.lineTo(-21,-18); ctx.fill();
        R(-21,-20,42,4,'#caa15a');                                // trim band (visible all sides)
        if(front){
          R(-3,-22,6,10,'#e0c074');                               // front lock
          R(-21,-18,4,18,'#caa15a'); R(17,-18,4,18,'#caa15a');    // corner straps
        }
      }
    } else if(t==='urn'){
      // tall clay burial urn with banded engravings
      R(-9,-44,18,6,'#8a6a42');                                  // rim
      R(-6,-40,12,4,'#6d5334');                                  // neck
      R(-15,-36,30,26,'#7a5a36'); R(-11,-36,22,26,'#8a6a42');    // body
      R(-13,-10,26,4,'#5a4228');                                 // foot
      if(front){
        R(-3,-33,4,18,'#a08050');                                // highlight
        R(-9,-26,18,2,'#5a4228'); R(-9,-20,18,2,'#5a4228');      // engraved bands
      }
    } else if(t==='column'){
      // cracked pillar snapped off partway up
      R(-15,-8,30,8,'#6b6557');                                  // base plinth
      R(-11,-52,22,44,'#7d7768');                                // shaft
      R(-11,-52,4,44,'#8f897a'); R(5,-52,6,44,'#645e50');        // fluting shade
      ctx.fillStyle='#7d7768';                                   // jagged broken top
      ctx.beginPath(); ctx.moveTo(-11,-52); ctx.lineTo(-5,-60); ctx.lineTo(1,-54); ctx.lineTo(7,-59); ctx.lineTo(11,-52); ctx.closePath(); ctx.fill();
      if(front){ R(-8,-30,3,10,'#57523f'); R(3,-42,3,8,'#57523f'); }  // cracks
    } else if(t==='brazier'){
      // bronze bowl on a stem, coals still burning (pulses via this.bob)
      R(-11,-6,22,6,'#3d2f1e');                                  // feet base
      R(-3,-16,6,10,'#4d3b26');                                  // stem
      R(-15,-26,30,10,'#6d5334'); R(-13,-24,26,6,'#7d6340');     // bowl
      const fl=0.7+0.3*Math.sin(this.bob*5);
      ctx.fillStyle='rgba(255,120,30,'+(0.8*fl).toFixed(3)+')';
      ctx.beginPath(); ctx.ellipse(0,-30,8,6+4*fl,0,0,7); ctx.fill();
      ctx.fillStyle='rgba(255,210,110,'+(0.85*fl).toFixed(3)+')';
      ctx.beginPath(); ctx.ellipse(0,-29,4,3+2*fl,0,0,7); ctx.fill();
    } else if(t==='bones'){
      // scattered remains — a skull and loose bones
      R(-16,-8,10,3,'#cfc4a6'); R(-2,-12,12,3,'#c2b696');
      R(8,-6,8,3,'#cfc4a6'); R(-8,-5,7,3,'#b8ab8b');
      ctx.fillStyle='#e0d6ba';
      ctx.beginPath(); ctx.arc(4,-14,4,0,7); ctx.fill();          // skull
      if(front){ ctx.fillStyle='#3a3226'; ctx.fillRect(2,-15,2,2); ctx.fillRect(6,-15,2,2); } // eye sockets
    } else if(t==='rubble'){
      // collapsed masonry chunks — plain ancient stone, nothing modern
      R(-18,-10,14,10,'#6b6557'); R(-6,-14,16,14,'#7d7768');
      R(6,-8,12,8,'#57523f'); R(-10,-18,9,6,'#8f897a');
      if(front){ R(-3,-8,4,3,'#494437'); }
    } else if(t==='crystal'){
      // glowing cave crystal cluster (grotto-only rare salvage)
      const glow=0.6+0.4*Math.sin(this.bob*3);
      ctx.fillStyle='rgba(120,220,255,'+(0.18*glow).toFixed(3)+')';
      ctx.beginPath(); ctx.ellipse(0,-16,16,20,0,0,7); ctx.fill();
      ctx.fillStyle='#57c8e8';
      ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(-13,-20); ctx.lineTo(-6,-28); ctx.lineTo(-3,0); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#7fdcf4';
      ctx.beginPath(); ctx.moveTo(-2,0); ctx.lineTo(0,-34); ctx.lineTo(8,-24); ctx.lineTo(8,0); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#b8ecfa';
      ctx.beginPath(); ctx.moveTo(1,-6); ctx.lineTo(2,-28); ctx.lineTo(5,-22); ctx.closePath(); ctx.fill();
      R(-12,-2,24,4,'#3f5a63');                                  // rocky base
    } else if(t==='tablet'){
      // engraved stone tablet on a plinth
      R(-18,-6,36,6,'#57523f');                                  // plinth
      R(-14,-44,28,38,'#7d7768'); R(-14,-44,28,4,'#8f897a');     // slab
      if(front){
        ctx.fillStyle='#4a4536';
        for(let ry=-36; ry<-12; ry+=6) ctx.fillRect(-10,ry,20,2); // engraved script rows
        R(-10,-40,8,2,'#c9a63a');                                 // gilded top glyph
      } else { R(-12,-42,24,34,'#6b6557'); }
    } else if(t==='statue'){
      // weathered idol on a pedestal
      R(-16,-8,32,8,'#57523f');                                  // pedestal
      R(-12,-14,24,6,'#6b6557');
      R(-8,-44,16,30,'#7d7768');                                 // robed body
      ctx.fillStyle='#8f897a';
      ctx.beginPath(); ctx.arc(0,-49,7,0,7); ctx.fill();          // head
      R(-12,-40,4,18,'#6b6557'); R(8,-40,4,18,'#6b6557');        // arms
      if(front){
        R(-3,-51,2,2,'#3a3226'); R(2,-51,2,2,'#3a3226');         // hollow eyes
        R(-4,-34,8,2,'#c9a63a');                                  // gold necklace remnant
        R(4,-28,3,8,'#4a4536');                                   // crack
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
