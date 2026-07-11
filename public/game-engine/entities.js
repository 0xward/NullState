/* ============================================================
   NULL_STATE :: ENTITIES  (sprite animator + Player + Enemy)
   World coords: (x,y) = entity CENTER. y grows downward.
   ============================================================ */
const imgGet = window.NS_ASSETS.img;

// Shared scratch canvas for masked tint overlays (e.g. Frost Spear's slow
// tint on Enemy). A plain `ctx.globalCompositeOperation='source-atop'`
// fillRect drawn straight onto the main game canvas would composite against
// WHATEVER is already painted there this frame (floor tiles, decor, other
// enemies) — not just this sprite's own silhouette — because the main
// canvas has no per-entity alpha boundary. Drawing the sprite frame into
// this small offscreen canvas first, tinting THAT with source-atop, then
// stamping the result back onto the main canvas keeps the tint confined to
// the sprite's actual drawn pixels. Reused across all enemies/frames (one
// draw call is synchronous, so no cross-entity clobbering).
let _tintCanvas=null, _tintCtx=null;
function _getTintCtx(w, h){
  if(!_tintCanvas){ _tintCanvas=document.createElement('canvas'); _tintCtx=_tintCanvas.getContext('2d'); }
  const iw=Math.max(1,Math.ceil(w)), ih=Math.max(1,Math.ceil(h));
  if(_tintCanvas.width!==iw || _tintCanvas.height!==ih){ _tintCanvas.width=iw; _tintCanvas.height=ih; }
  else _tintCtx.clearRect(0,0,iw,ih);
  return _tintCtx;
}

// generic frame-sheet animator
class Anim {
  constructor(){ this.cfg=null; this.frame=0; this.t=0; this.done=false; this.key=null; }
  set(cfg, key){
    if(this.key===key) return;
    this.key=key; this.cfg=cfg; this.frame=0; this.t=0; this.done=false;
  }
  update(dt){
    if(!this.cfg) return;
    const fps=this.cfg.fps||9;
    this.t+=dt;
    if(this.t >= 1/fps){
      this.t=0; this.frame++;
      if(this.frame>=this.cfg.frames){
        if(this.loop===false){ this.frame=this.cfg.frames-1; this.done=true; }
        else this.frame=0;
      }
    }
  }
  draw(ctx, cx, cy, scale, flip, footY=0.92, alpha=1){
    if(!this.cfg){
      // No animation config set at all (should only ever happen for a
      // single frame right after construction) — never silently render
      // nothing, since that previously made entities (including the
      // player) vanish with zero visible trace and no error.
      ctx.save();
      ctx.globalAlpha=alpha*0.6;
      ctx.fillStyle='#5c8a78';
      ctx.beginPath(); ctx.ellipse(cx, cy-14, 12, 18, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      return;
    }
    const im=imgGet(this.cfg.src);
    if(!im){
      // Sprite not loaded yet (or failed to load) — draw a simple visible
      // placeholder instead of nothing. Silently skipping the draw here
      // used to mean an entity (including the player) could vanish
      // completely off-screen with no error and no indication why; a
      // rough silhouette at least keeps them visible/trackable and makes
      // a real asset-loading problem obvious instead of invisible.
      ctx.save();
      ctx.globalAlpha=alpha*0.6;
      ctx.fillStyle='#5c8a78';
      ctx.beginPath(); ctx.ellipse(cx, cy-14, 12, 18, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      return;
    }
    const {fw,fh}=this.cfg;
    const dw=fw*scale, dh=fh*scale;
    const dx=cx-dw/2;
    const dy=cy-dh*footY;          // feet anchored near cy
    ctx.save();
    ctx.globalAlpha=alpha;
    if(flip){ ctx.translate(cx,0); ctx.scale(-1,1); ctx.translate(-cx,0); }
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(im, this.frame*fw,0,fw,fh, dx,dy,dw,dh);
    ctx.restore();
  }
}

// Chunky pixel-art arc: stamps square "pixels" along an arc so attack
// slashes read as hand-drawn pixel animation frames rather than smooth
// vector strokes. Works for either sweep direction (a0 > a1 is fine).
function pixelArc(ctx,cx,cy,r,a0,a1,px,color,alpha){
  ctx.fillStyle=color;
  const steps=Math.max(5, (Math.abs(a1-a0)*r/px)|0);
  for(let i=0;i<=steps;i++){
    const a=a0+(a1-a0)*i/steps;
    ctx.globalAlpha=alpha*(0.45+0.55*Math.sin(Math.PI*i/steps));
    ctx.fillRect(Math.round(cx+Math.cos(a)*r-px/2), Math.round(cy+Math.sin(a)*r-px/2), px, px);
  }
  ctx.globalAlpha=1;
}

// ============================================================
// LPC compositing engine (Phase 5.3 Task 5). Draws body + armor +
// weapon as direct-stacked layers at a given (cx,cy). Used by BOTH the
// animated in-dungeon Player.draw() (see useLPCHero below) and the
// static outdoor title-screen preview (drawPreview() in game.js) so
// the two can never drift out of sync — see NEXT-SESSION-PROMPT-v6.
// Verified this session: armor parts AND weapon overlays are
// pre-aligned to the body's own grid in every LPC animation folder, so
// this is pure direct-stack — no anchor/rotation math needed anywhere
// (that was the original plan; corrected after a real composite test).
// ------------------------------------------------------------
function lpcDirFromVec(x, y){
  // LPC_DIRS order: 0=up 1=left 2=down 3=right
  if(Math.abs(x) >= Math.abs(y)) return x<0 ? 1 : 3;
  return y<0 ? 0 : 2;
}
function drawLPCComposite(ctx, cx, cy, scale, dirIndex, frame, opts){
  const A = window.NS_ASSETS;
  if(!A || !A.LPC_HERO) return false;
  const hero = A.LPC_HERO;
  const animKey = (opts && opts.attacking && opts.weaponAnim) ? opts.weaponAnim : (opts && opts.animKey) || 'walk';
  const animCfg = hero[animKey] || hero.walk;
  const bodyIm = A.img(animCfg.src);
  if(!bodyIm) return false; // not loaded yet — caller falls back to placeholder
  const {fw, fh} = animCfg;
  const rows = animCfg.rows || 1;
  const row = rows > 1 ? dirIndex : 0;
  const f = Math.max(0, Math.min(frame, animCfg.frames - 1));
  const dw = fw*scale, dh = fh*scale;
  const dx = cx - dw/2;
  const dy = cy - dh*(opts && opts.foot != null ? opts.foot : hero.foot);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = (opts && opts.alpha != null) ? opts.alpha : 1;
  // body
  ctx.drawImage(bodyIm, f*fw, row*fh, fw, fh, dx, dy, dw, dh);
  // armor: torso/legs/feet[/head], same anim folder as body, direct stack
  const armorDef = opts && opts.armorId && A.LPC_ARMOR[opts.armorId];
  if(armorDef){
    // animKey -> actual LPC asset folder name. Most anims share their name
    // with the folder (hurt/slash/thrust); walk+idle both read from
    // 'walkcycle'; shoot (hunters_bow, wired this session) reads from
    // 'bow' — the LPC source tree names that folder after the weapon, not
    // the animation, unlike the others.
    const animFolder = (animKey === 'idle' || animKey === 'walk') ? 'walkcycle'
                      : animKey === 'shoot' ? 'bow'
                      : animKey;
    ['legs','torso','feet','head'].forEach(part=>{
      const fn = armorDef[part];
      if(!fn) return;
      const im = A.img(`${A.LPC_BASE}/${animFolder}/${fn}`);
      if(im) ctx.drawImage(im, f*fw, row*fh, fw, fh, dx, dy, dw, dh);
    });
  }
  // weapon: only during the attack window, only on the matching anim
  // sheet (a spear won't try to draw itself during a 'walk' frame)
  if(opts && opts.attacking){
    const wDef = opts.weaponId && A.LPC_WEAPON[opts.weaponId];
    if(wDef && wDef.anim === animKey){
      const wIm = A.img(wDef.src);
      if(wIm){
        ctx.drawImage(wIm, f*fw, row*fh, fw, fh, dx, dy, dw, dh);
        if(wDef.double){
          // twin_daggers: second blade, small pixel offset scaled with the
          // sprite so it reads as two overlapping daggers, not a smear.
          // Offset bumped 3->6 (x scale) this session after a PIL composite
          // gut-check (dagger frame from slash/WEAPON_dagger.png stacked at
          // both offsets, viewed directly): at 3x the two blades nearly
          // fully overlapped and read as one slightly-blurred dagger, not
          // two. 6x clearly reads as two overlapping blades without looking
          // like two separate weapons. Not yet re-verified inside the real
          // canvas/game loop (this env had no network for npm/Playwright
          // this session) — worth one more glance next session once you can
          // run the app, but the static composite evidence is solid.
          const off = 6*scale;
          ctx.drawImage(wIm, f*fw, row*fh, fw, fh, dx+off, dy-off*0.6, dw, dh);
        }
      }
    }
  }
  ctx.restore();
  return true;
}

class Player {
  constructor(charKey, cfg){
    this.char=charKey; this.cfg=cfg;
    this.x=0; this.y=0; this.r=14;
    this.speed=188; this.vx=0; this.vy=0;
    this.facing=1; this.dirY=0; this.state='idle';
    this.anim=new Anim();
    this.maxHp=120; this.hp=120;
    this.xp=0; this.level=1; this.kills=0; this.celo=0;
    this.atkDmg=22;
    this.attacking=false; this.atkTime=0; this.atkCd=0; this.hitDone=false;
    this.swingFlash=0; this._lastMove={x:1,y:0};
    this.iframe=0; this.flash=0;
    this.depth=1;
    // ---- LPC hero rendering state (Phase 5.3 Task 5) ----
    // Gated by useLPCHero so the old Pixel Crawler sprite path stays
    // available/switchable until this is verified in a real browser
    // against live gameplay (a standalone Playwright harness confirmed
    // the compositing math this session, but NOT the full game loop —
    // see NEXT-SESSION-PROMPT-v6 for exact manual QA steps still owed).
    this.useLPCHero = (charKey === 'knight');
    this.equippedArmorId = null;   // set by applyEquipment() in game.js
    this.equippedWeaponId = null;  // set by applyEquipment() in game.js
    this._lpcDir = 2;              // 0=up 1=left 2=down 3=right
    this._lpcFrame = 0;
    this._lpcT = 0;
  }
  xpForNext(){ return this.level*200; }
  gainXp(n){
    this.xp+=n;
    let ups=0;
    while(this.xp>=this.xpForNext() && this.level<50){
      this.xp-=this.xpForNext(); this.level++; ups++;
      this.maxHp+=14; this.hp=this.maxHp; this.atkDmg+=3; this.speed+=1.5;
    }
    return ups;
  }
  startAttack(){
    if(this.atkCd>0 || this.attacking) return false;
    this.attacking=true; this.atkTime=0; this.hitDone=false;
    this.swingFlash=0.38; // class-flavored attack visual duration (see draw())
    this.atkCd=0.38;
    this._wantSwingFx=true;
    return true;
  }
  takeSwingFx(){ const v=this._wantSwingFx; this._wantSwingFx=false; return v; }
  hurt(dmg){
    if(this.iframe>0) return false;
    this.hp=Math.max(0,this.hp-dmg); this.iframe=0.7; this.flash=0.4;
    return true;
  }
  update(dt, input, dun){
    if(this.atkCd>0) this.atkCd-=dt;
    if(this.iframe>0) this.iframe-=dt;
    if(this.flash>0) this.flash-=dt;
    if(this.swingFlash>0) this.swingFlash-=dt;

    // movement (locked briefly mid-attack swing)
    const lock = this.attacking && this.atkTime<0.18;
    let mx=0,my=0;
    if(!lock){
      mx=(input.right?1:0)-(input.left?1:0);
      my=(input.down?1:0)-(input.up?1:0);
    }
    const mag=Math.hypot(mx,my)||1;
    mx/=mag; my/=mag;
    const moving = (mx||my) && !lock;
    if(moving){ this._lastMove={x:mx,y:my}; this.dirY=my; }
    const sp=this.speed*(this.attacking?0.55:1);
    // collide per-axis
    const nx=this.x+mx*sp*dt;
    if(!dun.isWall(nx,this.y) && !dun.isWall(nx+Math.sign(mx)*this.r,this.y)) this.x=nx;
    const ny=this.y+my*sp*dt;
    if(!dun.isWall(this.x,ny) && !dun.isWall(this.x,ny+Math.sign(my)*this.r)) this.y=ny;
    if(mx!==0) this.facing=mx>0?1:-1;

    // attack timeline (pose stays idle throughout — see startAttack note)
    if(this.attacking){
      this.atkTime+=dt;
      if(this.atkTime>=0.42){ this.attacking=false; }
    }
    // anim state — only idle/walk exist now, attacking no longer swaps sprite
    if(moving && !this.attacking){ this.anim.loop=true; this.anim.set(this.cfg.walk,'walk'); this.state='walk'; }
    else { this.anim.loop=true; this.anim.set(this.cfg.idle,'idle'); this.state='idle'; }
    this.anim.update(dt);

    // ---- LPC hero animation state (additive, only used when
    // useLPCHero is true — see drawLPCComposite/lpcDirFromVec above) ----
    if(this.useLPCHero){
      // BUGFIX (verified via standalone Playwright harness this session):
      // previously fell back to `this.facing` (a left/right-only flag that
      // defaults to 1 and is never set to 0) whenever |_lastMove.x|<=0.2.
      // That meant pure vertical movement (mx=0, my=±1) always substituted
      // facing=1 for lx, and lpcDirFromVec's `>=` tie-break then always
      // picked horizontal — the player could NEVER visually face up/down
      // while walking straight vertically. _lastMove already holds the
      // correct, fully-normalized last-movement vector (set only when
      // actually moving, so it correctly persists through idle frames too)
      // — no facing-based fallback is needed at all.
      const lx=this._lastMove ? this._lastMove.x : 1;
      const ly=this._lastMove ? this._lastMove.y : 0;
      this._lpcDir = lpcDirFromVec(lx, ly);
      const A = window.NS_ASSETS;
      if(this.attacking && A){
        const wDef = this.equippedWeaponId && A.LPC_WEAPON[this.equippedWeaponId];
        const animKey = (wDef && wDef.anim) || 'slash';
        const animCfg = A.LPC_HERO[animKey] || A.LPC_HERO.slash;
        // atkTime runs 0..0.42 (see startAttack/update above) — map the
        // strike window (0.10-0.30, see hitZone()) onto the sheet's frames
        // so the visible swing frame lines up with when the hit actually
        // lands, rather than just looping the sheet on its own clock.
        const prog = Math.max(0, Math.min(1, this.atkTime/0.42));
        this._lpcFrame = Math.min(animCfg.frames-1, Math.floor(prog*animCfg.frames));
        this._lpcAnimKey = animKey;
      } else if(moving){
        const walkCfg = A ? A.LPC_HERO.walk : null;
        const fps = (walkCfg&&walkCfg.fps) || 12;
        this._lpcT += dt;
        if(this._lpcT >= 1/fps){
          this._lpcT = 0;
          this._lpcFrame = (this._lpcFrame+1) % ((walkCfg&&walkCfg.frames)||9);
        }
        this._lpcAnimKey = 'walk';
      } else {
        this._lpcFrame = 0; this._lpcT = 0; this._lpcAnimKey = 'idle';
      }
    }
  }
  // returns hit zone center & radius when in the strike window
  hitZone(){
    if(!this.attacking || this.hitDone) return null;
    if(this.atkTime<0.10 || this.atkTime>0.30) return null;
    this.hitDone=true;
    // Same facing-fallback bug as the LPC dir calc in update() (see the
    // BUGFIX comment above) — fixed the same way this session: attacking
    // while walking straight up/down was registering the hit zone to the
    // side instead of up/down, because `this.facing` (left/right-only,
    // defaults to 1, never 0) was substituted in whenever |_lastMove.x|
    // was small. _lastMove already holds the correct persisted vector.
    const lx=this._lastMove ? this._lastMove.x : 1;
    const ly=this._lastMove ? this._lastMove.y : 0;
    const m=Math.hypot(lx,ly)||1;
    return { x:this.x+lx/m*38, y:this.y+ly/m*30, r:50, dmg:this.atkDmg };
  }
  draw(ctx){
    const a=this.iframe>0 && (Math.floor(this.iframe*20)%2===0)?0.4:1;
    // shadow
    ctx.save(); ctx.globalAlpha=0.35*a; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(this.x,this.y+8,this.r*1.3,7,0,0,7); ctx.fill(); ctx.restore();
    let drewLPC = false;
    if(this.useLPCHero){
      const A = window.NS_ASSETS;
      const heroCfg = A && A.LPC_HERO;
      drewLPC = heroCfg && drawLPCComposite(ctx, this.x, this.y, heroCfg.scale, this._lpcDir, this._lpcFrame, {
        animKey: this._lpcAnimKey || 'walk',
        attacking: this.attacking,
        weaponAnim: this.equippedWeaponId && A.LPC_WEAPON[this.equippedWeaponId] && A.LPC_WEAPON[this.equippedWeaponId].anim,
        armorId: this.equippedArmorId,
        weaponId: this.equippedWeaponId,
        alpha: a,
      });
    }
    if(!drewLPC){
      // Either useLPCHero is off, or the LPC sheets aren't loaded yet —
      // fall back to the old Pixel Crawler sprite so the player is never
      // invisible (same defensive principle as Anim.draw's own fallback).
      this.anim.draw(ctx,this.x,this.y, this.cfg.scale, this.facing<0, this.cfg.foot, a);
    }
    if(this.flash>0 && !drewLPC){
      this.anim.draw(ctx,this.x,this.y,this.cfg.scale,this.facing<0,this.cfg.foot,this.flash*0.7);
    }
    // Class-flavored attack visual — stands in for a dedicated attack
    // sprite (none of the 3 classes have one, only Idle/Run/Death).
    // Phase 5.3 Task 4: weapon identity is layered ON TOP of the class shape
    // below via `beh` (this._weaponBehavior) + `tier` (this._fxTier, 1-3
    // from the equipped item's price tier — see marketplace-items.js). The
    // class branch still decides the base silhouette (fire/daggers/sword);
    // tierScale/tierAlpha make higher-tier weapons of the SAME class read as
    // bigger/brighter, and the accent layer after it adds a small
    // behavior-specific flourish so all 7 behaviors stay distinguishable
    // even when two weapons share a class look.
    if(this.swingFlash>0){
      const dur=0.34;
      const sa=Math.max(0,this.swingFlash/dur);
      const prog=1-sa;                       // 0 -> 1 over the swing
      // 360° aim: orient the swing toward the actual move/analog vector
      // (not just left/right) so melee reads correctly in every direction.
      const _mv=(this._lastMove && (Math.abs(this._lastMove.x)+Math.abs(this._lastMove.y)>0.1))?this._lastMove:{x:this.facing,y:0};
      const aimAng=Math.atan2(_mv.y,_mv.x);
      const dir=1;
      const base=aimAng;
      const beh = this._weaponBehavior || 'slash';
      const tier = this._fxTier || 1;
      const tierScale = 0.8 + tier*0.3;      // 1->1.1, 2->1.4, 3->1.7
      const tierAlpha = Math.min(1, 0.65 + tier*0.15); // 1->.8, 2->.95, 3->1
      const fx = this.x+Math.cos(aimAng)*30, fy = this.y-6+Math.sin(aimAng)*30;

      // Hunter's Bow (ranged): the arrow itself (drawn in game.js) is the
      // main visual, so a full melee slash arc here would look wrong for a
      // weapon that never actually swings. Instead: a quick bow-release
      // glint — a short string-snap arc at the draw hand plus 3 small
      // "twang" flecks — that pops hard at release and fades fast, then we
      // skip the class-branch slash arc entirely for this behavior.
      if(beh==='ranged'){
        ctx.save();
        ctx.globalCompositeOperation='lighter';
        const pop=Math.min(1, prog*5);       // fast pop-and-fade at release
        ctx.globalAlpha=sa*pop*tierAlpha;
        ctx.strokeStyle='#eafff5'; ctx.lineWidth=2*tierScale;
        ctx.beginPath();
        ctx.arc(fx,fy, (9+prog*5)*tierScale, aimAng-1.0, aimAng+1.0);
        ctx.stroke();
        ctx.fillStyle='#fff3c4';
        for(let i=0;i<3;i++){
          const ang=aimAng+(i-1)*0.4;
          const rr=13*tierScale;
          ctx.globalAlpha=sa*pop*tierAlpha*0.85;
          ctx.fillRect(Math.round(fx+Math.cos(ang)*rr)-1, Math.round(fy+Math.sin(ang)*rr)-1, 2, 2);
        }
        ctx.restore();
        return; // no melee slash arc for a bow — nothing further to draw
      }

      ctx.save();
      ctx.globalCompositeOperation='lighter';
      if(this.char==='wizzard'){
        // fire burst: core glow + chunky pixel embers thrown forward
        const rad=30*tierScale;
        const g = ctx.createRadialGradient(fx,fy,0, fx,fy,rad);
        g.addColorStop(0, `rgba(255,236,170,${0.9*sa*tierAlpha})`);
        g.addColorStop(0.45, `rgba(255,140,40,${0.7*sa*tierAlpha})`);
        g.addColorStop(1, `rgba(255,60,20,0)`);
        ctx.fillStyle=g;
        ctx.beginPath(); ctx.arc(fx,fy,rad,0,7); ctx.fill();
        const emberCount=6+tier*2;
        for(let i=0;i<emberCount;i++){
          const ang=base + dir*((i-emberCount/2)*(0.78/emberCount)) + Math.sin(prog*20+i)*0.06;
          const rr=(8+prog*26+(i%3)*4)*tierScale;
          const s=((i%2)?4:3)*Math.min(1.3,tierScale);
          ctx.globalAlpha=sa*tierAlpha*(0.45+0.4*(((i*7)%3)/2));
          ctx.fillStyle=(i%3===0)?'#fff0b8':(i%3===1?'#ffb14a':'#ff7028');
          ctx.fillRect(Math.round(fx+Math.cos(ang)*rr)-2, Math.round(fy+Math.sin(ang)*rr)-2, s, s);
        }
      } else if(this.char==='rogue'){
        // twin dagger slashes: two crossing pixel arcs sweeping fast
        const lead1=base+dir*(-1.0+2.0*prog);
        const lead2=base+dir*( 1.0-2.0*prog);
        pixelArc(ctx, fx-dir*6, fy,   19*tierScale, lead1-dir*0.7, lead1, 2, '#fff3c4', sa*0.95*tierAlpha);
        pixelArc(ctx, fx+dir*4, fy-4, 16*tierScale, lead2-dir*0.5, lead2, 2, '#ffd9a0', sa*0.8*tierAlpha);
      } else {
        // knight: one wide steel slash — thick pixel arc + trailing
        // afterimage + a hot leading-edge pixel, like a drawn sword frame
        const cx=this.x+Math.cos(aimAng)*14, cy=this.y-6+Math.sin(aimAng)*14;
        const lead=base+dir*(-1.15+2.3*prog);
        pixelArc(ctx, cx, cy, 30*tierScale, lead-dir*0.85, lead, 3, '#eafff5', sa*tierAlpha);
        pixelArc(ctx, cx, cy, 24*tierScale, lead-dir*0.6,  lead, 2, '#9df5cf', sa*0.65*tierAlpha);
        ctx.globalAlpha=sa*tierAlpha; ctx.fillStyle='#ffffff';
        ctx.fillRect(Math.round(cx+Math.cos(lead)*30*tierScale)-2, Math.round(cy+Math.sin(lead)*30*tierScale)-2, 5, 5);
      }
      ctx.restore();

      // Behavior accent layer — a small extra flourish stacked on top of the
      // class shape above, so weapons that share a class silhouette but have
      // different mechanical behavior (e.g. Rusty Blade's plain 'slash' vs
      // Ancient Blade's 'triple_slash', both rendered by the same knight
      // branch) still read as visually distinct. Kept intentionally light —
      // this is a polish accent, not a second full effect.
      if(beh==='double_hit'){
        // faint echo arc, slightly time-offset — reads as "hits twice"
        ctx.save(); ctx.globalCompositeOperation='lighter';
        pixelArc(ctx, fx, fy, 22*tierScale, base-dir*0.35, base+dir*0.35, 2, '#9ff0ff', sa*0.5*tierAlpha);
        ctx.restore();
      } else if(beh==='knockback'){
        // heavy impact ring pushed outward — telegraphs the shove
        ctx.save(); ctx.globalCompositeOperation='lighter';
        ctx.globalAlpha=sa*0.55*tierAlpha; ctx.strokeStyle='#ff8a3d'; ctx.lineWidth=3*tierScale;
        ctx.beginPath(); ctx.arc(fx,fy,(14+prog*22)*tierScale,0,Math.PI*2); ctx.stroke();
        ctx.restore();
      } else if(beh==='triple_slash'){
        // third, wider gold arc layered over the base slash — "3 hits" read
        ctx.save(); ctx.globalCompositeOperation='lighter';
        pixelArc(ctx, fx, fy, 36*tierScale, base-dir*1.5, base+dir*0.35, 3, '#ffd24a', sa*0.7*tierAlpha);
        ctx.restore();
      } else if(beh==='aoe'){
        // void ring pulsing outward in ALL directions (not just the aim
        // cone) — signals the hit isn't confined to a narrow swing
        ctx.save(); ctx.globalCompositeOperation='lighter';
        ctx.globalAlpha=sa*0.5*tierAlpha; ctx.strokeStyle='#b46bff'; ctx.lineWidth=3*tierScale;
        ctx.beginPath(); ctx.arc(this.x,this.y-6,(20+prog*40)*tierScale,0,Math.PI*2); ctx.stroke();
        ctx.restore();
      } else if(beh==='slow'){
        // icy shard flecks trailing the swing — matches Enemy's frost tint
        ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.fillStyle='#bdeeff';
        for(let i=0;i<4;i++){
          const ang=base+dir*((i-1.5)*0.3);
          const rr=(18+prog*20)*tierScale;
          ctx.globalAlpha=sa*0.6*tierAlpha;
          ctx.fillRect(Math.round(fx+Math.cos(ang)*rr)-1, Math.round(fy+Math.sin(ang)*rr)-1, 2, 2);
        }
        ctx.restore();
      }
      // 'slash' (Rusty Blade, the plain starter weapon) gets no extra accent
      // beyond tier scaling — it's meant to read as the plain baseline that
      // everything else escalates from.
    }
  }
}

class Enemy {
  constructor(arch, x, y, depth, isBoss=false, elite=false){
    this.arch=arch; this.isBoss=isBoss; this.elite=elite;
    let scale = 1 + (depth-1)*0.14;
    let hpMul=1, dmgMul=1, xpMul=1, rMul=1, scMul=1;
    if(elite){ hpMul=2.3; dmgMul=1.45; xpMul=2.6; rMul=1.28; scMul=1.26; }
    if(arch.isBossScale){ hpMul*=2.0; dmgMul*=1.4; rMul*=1.7; scMul*=1.85; }
    // Data-driven per-floor scaling (monster-config.js): Boss Floors 5/10/15/20
    // get fixed hp/dmg/xp multipliers, every other floor gets a compounding
    // +8%/floor. This STACKS on top of the elite/boss multipliers above, it
    // does not replace them. Defensive guard matches the window.NS_X||{}
    // style already used elsewhere in this codebase (see game.js hitTest()),
    // in case monster-config.js hasn't loaded yet.
    const _floorScale = (window.NS_FLOOR_SCALE ? window.NS_FLOOR_SCALE(depth) : null) || { hpMul:1, dmgMul:1, xpMul:1 };
    hpMul  *= _floorScale.hpMul;
    dmgMul *= _floorScale.dmgMul;
    xpMul  *= _floorScale.xpMul;
    this.maxHp=Math.round(arch.hp*scale*hpMul);
    this.hp=this.maxHp;
    this.dmg=Math.round(arch.dmg*(1+(depth-1)*0.12)*dmgMul);
    this.spd=arch.spd*(elite?0.92:1);
    this.xp=Math.round(arch.xp*(1+(depth-1)*0.1)*xpMul);
    this.x=x; this.y=y; this.r=arch.r*rMul;
    this.cfg=window.NS_ASSETS.MON[arch.key];
    this._scaleMul=scMul;
    this.anim=new Anim(); this.facing=-1;
    this.state='idle'; this.attacking=false; this.atkTime=0; this.atkCd=0; this.hitDone=false;
    this.attackFlashT=0; this.windupT=0;
    this.aggro = isBoss?9999:(elite?420:300);
    this.hitFlash=0; this.dead=false; this.deathT=0; this.kb={x:0,y:0};
    this.spawnT=0.45;
    this.home=null; // room bounds (set by game.js) — bunker guards never leave their room
    this.ultiOffered=false; // ulti popup shown once per enemy
    this.name = arch.isBossScale ? arch.name : (elite ? (arch.name+' (Elite)') : arch.name);
  }
  hurt(dmg){
    this.hp-=dmg; this.hitFlash=0.18;
    if(this.hp<=0 && !this.dead){
      this.dead=true;
      if(this.cfg.death){
        this.anim.loop=false; this.anim.set(this.cfg.death,'death');
        const fps=this.cfg.death.fps||9;
        this.deathT = (this.cfg.death.frames/fps) + 0.35; // play full anim, then a short hold before fade
      } else {
        this.deathT=0.6;
      }
      return true;
    }
    return false;
  }
  // Bunker guards are bound to their home room: they only aggro while the
  // player is inside it (small grace so doorway fights still connect) and
  // their position is clamped so they can never spill out through a door.
  playerInHome(p, grace=34){
    if(!this.home) return true;
    return p.x>this.home.x0-grace && p.x<this.home.x1+grace &&
           p.y>this.home.y0-grace && p.y<this.home.y1+grace;
  }
  clampHome(){
    if(!this.home) return;
    this.x=Math.max(this.home.x0,Math.min(this.home.x1,this.x));
    this.y=Math.max(this.home.y0,Math.min(this.home.y1,this.y));
  }
  update(dt, player, dun){
    if(this.spawnT>0) this.spawnT-=dt;
    if(this.dead){ this.deathT-=dt; this.anim.update(dt); return; }
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.atkCd>0) this.atkCd-=dt;
    // Frost Spear slow debuff (set by hitTest() in game.js). Ticks down each
    // frame; while active, movement speed is multiplied by _slowMul. Does
    // not stack — a fresh hit just refreshes _slowT back to full duration.
    if(this._slowT>0){ this._slowT-=dt; if(this._slowT<=0){ this._slowT=0; this._slowMul=1; } }

    const dx=player.x-this.x, dy=player.y-this.y;
    const dist=Math.hypot(dx,dy)||1;
    if(dx!==0) this.facing=dx>0?1:-1;

    const reach=this.r+player.r+14;
    let chasing=false;
    if(this.attacking){
      this.atkTime+=dt;
      // deal damage mid-swing — wider window + reach grace than before,
      // since nothing freezes the player in place during an enemy's
      // swing; a tight window made attacks whiff constantly if the player
      // moved at all during the wind-up, even though they started in range.
      if(!this.hitDone && this.atkTime>0.16 && this.atkTime<0.5 && dist<reach+26){
        this.hitDone=true; this._wantHit=this.dmg;
      }
      // attack flash + a forward particle "swing" burst once, right as the
      // swing starts — stands in for a dedicated attack sprite, but only
      // for archetypes that don't have one (Orc/Skeleton Crew); skel_reaper
      // and vampire play their own real attack animation instead.
      if(!this.cfg.attack && this.atkTime<dt+0.001){ this.attackFlashT=0.5; this._wantSwingFx=true; }
      if(this.atkTime>=0.55){ this.attacking=false; this.atkCd=0.6; }
    } else if(dist<this.aggro && this.playerInHome(player)){
      if(dist<=reach && this.atkCd<=0){
        this.attacking=true; this.atkTime=0; this.hitDone=false; this.windupT=0.22;
      } else if(dist>reach){
        // chase — clamped to the home room so guards never spill out the door
        const _slow=this._slowT>0?(this._slowMul||1):1;
        let vx=dx/dist*this.spd*_slow, vy=dy/dist*this.spd*_slow;
        const nx=this.x+vx*dt, ny=this.y+vy*dt;
        if(!dun.isWall(nx,this.y)) this.x=nx;
        if(!dun.isWall(this.x,ny)) this.y=ny;
        this.clampHome();
        this.state='walk';
        chasing=true;
      }
    } else if(this.home){
      // player left (or never entered) this room — walk back to the post
      const hx=this.home.cx-this.x, hy=this.home.cy-this.y;
      const hd=Math.hypot(hx,hy);
      if(hd>26){
        const _slow2=this._slowT>0?(this._slowMul||1):1;
        const nx=this.x+hx/hd*this.spd*0.55*_slow2*dt, ny=this.y+hy/hd*this.spd*0.55*_slow2*dt;
        if(!dun.isWall(nx,this.y)) this.x=nx;
        if(!dun.isWall(this.x,ny)) this.y=ny;
        this.state='walk';
        chasing=true;
      }
    }
    if(this.attackFlashT>0) this.attackFlashT-=dt;
    if(this.windupT>0) this.windupT-=dt;
    // knockback (also clamped to the home room)
    if(Math.abs(this.kb.x)+Math.abs(this.kb.y)>0.5){
      const nx=this.x+this.kb.x*dt, ny=this.y+this.kb.y*dt;
      if(!dun.isWall(nx,this.y)) this.x=nx;
      if(!dun.isWall(this.x,ny)) this.y=ny;
      this.kb.x*=0.82; this.kb.y*=0.82;
      this.clampHome();
    }
    // Animation state machine: attacking plays the real attack sheet if
    // this archetype has one (skel_reaper, vampire); otherwise it holds
    // idle/walk and the swing reads via attackFlashT/hitFlash instead
    // (Orc/Skeleton Crew, which only ship Idle/Run/Death).
    this.anim.loop=true;
    if(this.attacking && this.cfg.attack){ this.anim.set(this.cfg.attack,'attack'); }
    else if(chasing){ this.anim.set(this.cfg.walk||this.cfg.idle,'walk'); }
    else { this.anim.set(this.cfg.idle,'idle'); }
    this.anim.update(dt);
  }
  // Consumes the one-shot "play a swing particle burst now" flag — game.js
  // checks this each frame after calling enemy.update() and calls spark()
  // at the enemy's position if it's true, then it's cleared.
  takeSwingFx(){ const v=this._wantSwingFx; this._wantSwingFx=false; return v; }
  takeWantHit(){ const d=this._wantHit; this._wantHit=0; return d; }
  draw(ctx){
    const scale=this.cfg.scale*(this._scaleMul||1);
    let a=1;
    if(this.spawnT>0) a=1-this.spawnT/0.45;
    if(this.dead) a=Math.max(0,Math.min(1, this.deathT/0.35));
    // elite aura
    if(this.elite && !this.dead){
      const pulse=0.5+0.5*Math.sin((performance.now()/300));
      ctx.save(); ctx.globalAlpha=0.25*a*(0.6+pulse*0.4);
      const grd=ctx.createRadialGradient(this.x,this.y-this.r*0.6,2,this.x,this.y-this.r*0.6,this.r*2.4);
      grd.addColorStop(0,'#ffae00'); grd.addColorStop(1,'rgba(255,174,0,0)');
      ctx.fillStyle=grd; ctx.beginPath();
      ctx.arc(this.x,this.y-this.r*0.6,this.r*2.4,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    // shadow
    ctx.save(); ctx.globalAlpha=0.3*a; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(this.x,this.y+6,this.r*1.2,6,0,0,7); ctx.fill(); ctx.restore();
    if(this.windupT>0 && !this.dead){
      const pulse=1-this.windupT/0.22;
      ctx.save(); ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=0.25+pulse*0.35;
      ctx.strokeStyle=this.elite?'#ffd166':'#ff5d54'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r+10+pulse*8,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    const flip=this.facing>0; // monster sheets face left by default → flip for right
    const ft=this.cfg.foot||0.9;
    this.anim.draw(ctx,this.x,this.y,scale,flip,ft,a);
    if(this.hitFlash>0){
      ctx.save(); ctx.globalCompositeOperation='lighter';
      this.anim.draw(ctx,this.x,this.y,scale,flip,ft,this.hitFlash*3);
      ctx.restore();
    }
    // Frost Spear slow tell: a soft light-blue overlay + faint icy ring
    // while _slowT is active, so the player can see the enemy is chilled.
    // The overlay is composited on an offscreen scratch canvas (see
    // _getTintCtx above) so it only tints this sprite's own drawn pixels,
    // not whatever floor/decor happens to be behind it on the main canvas.
    if(this._slowT>0 && !this.dead){
      const _im=imgGet(this.cfg.src);
      if(_im){
        const _fw=this.cfg.fw||24, _fh=this.cfg.fh||24;
        const _dw=_fw*scale, _dh=_fh*scale;
        const tctx=_getTintCtx(_dw,_dh);
        tctx.save();
        tctx.imageSmoothingEnabled=false;
        if(flip){ tctx.translate(_dw,0); tctx.scale(-1,1); }
        tctx.drawImage(_im, this.anim.frame*_fw,0,_fw,_fh, 0,0,_dw,_dh);
        tctx.globalCompositeOperation='source-atop';
        tctx.globalAlpha=0.35;
        tctx.fillStyle='#8fd8ff';
        tctx.fillRect(0,0,_dw,_dh);
        tctx.restore();
        const _dx=this.x-_dw/2, _dy=this.y-_dh*ft;
        ctx.save();
        ctx.drawImage(_tintCanvas,0,0,_dw,_dh, _dx,_dy,_dw,_dh);
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha=0.5+0.2*Math.sin(performance.now()/140);
      ctx.strokeStyle='#bdeeff'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r+4,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    // attack-swing flash: a sweeping pixel-art claw slash standing in for a
    // dedicated attack sprite (the source sheets only have Idle/Run/Death).
    if(this.attackFlashT>0 && !this.dead){
      const sa=Math.min(1,this.attackFlashT/0.5);
      const prog=1-this.attackFlashT/0.5;
      const dir=this.facing>0?1:-1;
      const base=this.facing>0?0:Math.PI;
      const lead=base+dir*(-0.95+1.9*prog);
      const cx=this.x+this.facing*this.r*0.7, cy=this.y-this.r*0.3;
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      pixelArc(ctx, cx, cy, this.r*1.1, lead-dir*0.7, lead, 3, this.elite?'#ffd166':'#ff8a7a', sa*0.9);
      pixelArc(ctx, cx, cy+3, this.r*0.85, lead-dir*0.45, lead, 2, '#ffffff', sa*0.45);
      ctx.restore();
    }
    // hp bar
    if(!this.dead && this.spawnT<=0){
      const w=this.r*2.2, hpw=w*(this.hp/this.maxHp);
      const by=this.y-this.r*2.0;
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(this.x-w/2,by,w,5);
      ctx.fillStyle=this.isBoss?'#ff3b5c':(this.elite?'#ffae00':'#ff5d54'); ctx.fillRect(this.x-w/2,by,Math.max(0,hpw),5);
      if((this.isBoss || this.elite) && window.NS_QUEUE_NAMEPLATE){
        // Nameplate is queued and drawn later in screen-space (after the
        // camera transform is popped) so it can be clamped to stay fully
        // on-screen instead of clipping off the edge of a narrow viewport.
        window.NS_QUEUE_NAMEPLATE(this, by-6);
      }
    }
  }
}
window.NS_ENT={Anim,Player,Enemy};
