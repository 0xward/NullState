/* ============================================================
   NULL_STATE :: ENTITIES  (sprite animator + Player + Enemy)
   World coords: (x,y) = entity CENTER. y grows downward.
   ============================================================ */
const imgGet = window.NS_ASSETS.img;

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
    if(!this.cfg) return;
    const im=imgGet(this.cfg.src); if(!im) return;
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

class Player {
  constructor(charKey, cfg){
    this.char=charKey; this.cfg=cfg;
    this.x=0; this.y=0; this.r=14;
    this.speed=178; this.vx=0; this.vy=0;
    this.facing=1; this.state='idle';
    this.anim=new Anim();
    this.maxHp=120; this.hp=120;
    this.xp=0; this.level=1; this.kills=0; this.celo=0;
    this.atkDmg=22;
    this.attacking=false; this.atkTime=0; this.atkCd=0; this.hitDone=false;
    this.swingFlash=0;
    this.iframe=0; this.flash=0;
    this.depth=1;
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
    this.swingFlash=0.22; // brief weapon-swing flash since there's no attack sprite to switch to
    this.atkCd=0.42;
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
    const sp=this.speed*(this.attacking?0.4:1);
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
  }
  // returns hit zone center & radius when in the strike window
  hitZone(){
    if(!this.attacking || this.hitDone) return null;
    if(this.atkTime<0.12 || this.atkTime>0.30) return null;
    this.hitDone=true;
    return { x:this.x+this.facing*38, y:this.y, r:46, dmg:this.atkDmg };
  }
  draw(ctx){
    const a=this.iframe>0 && (Math.floor(this.iframe*20)%2===0)?0.4:1;
    // shadow
    ctx.save(); ctx.globalAlpha=0.35*a; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(this.x,this.y+8,this.r*1.3,7,0,0,7); ctx.fill(); ctx.restore();
    this.anim.draw(ctx,this.x,this.y, this.cfg.scale, this.facing<0, this.cfg.foot, a);
    if(this.flash>0){
      this.anim.draw(ctx,this.x,this.y,this.cfg.scale,this.facing<0,this.cfg.foot,this.flash*0.7);
    }
    // weapon-swing flash: a quick bright arc in front of the character,
    // standing in for a dedicated attack sprite the new classes don't have.
    if(this.swingFlash>0){
      const sa=this.swingFlash/0.22;
      ctx.save();
      ctx.globalAlpha=sa*0.8;
      ctx.globalCompositeOperation='lighter';
      ctx.strokeStyle='#eafff5'; ctx.lineWidth=3;
      ctx.beginPath();
      ctx.arc(this.x+this.facing*16, this.y-4, 22, -0.9, 0.9);
      ctx.stroke();
      ctx.restore();
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
    this.attackFlashT=0;
    this.aggro = isBoss?9999:(elite?420:300);
    this.hitFlash=0; this.dead=false; this.deathT=0; this.kb={x:0,y:0};
    this.spawnT=0.45;
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
  update(dt, player, dun){
    if(this.spawnT>0) this.spawnT-=dt;
    if(this.dead){ this.deathT-=dt; this.anim.update(dt); return; }
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.atkCd>0) this.atkCd-=dt;

    const dx=player.x-this.x, dy=player.y-this.y;
    const dist=Math.hypot(dx,dy)||1;
    if(dx!==0) this.facing=dx>0?1:-1;

    const reach=this.r+player.r+14;
    let chasing=false;
    if(this.attacking){
      this.atkTime+=dt;
      // deal damage mid-swing
      if(!this.hitDone && this.atkTime>0.22 && this.atkTime<0.4 && dist<reach+10){
        this.hitDone=true; this._wantHit=this.dmg;
      }
      // attack flash + a forward particle "swing" burst once, right as the
      // swing starts — stands in for a dedicated attack sprite (none of the
      // Orc/Skeleton crew sheets have one, only Idle/Run/Death).
      if(this.atkTime<dt+0.001){ this.attackFlashT=0.5; this._wantSwingFx=true; }
      if(this.atkTime>=0.55){ this.attacking=false; this.atkCd=0.6; }
    } else if(dist<this.aggro){
      if(dist<=reach && this.atkCd<=0){
        this.attacking=true; this.atkTime=0; this.hitDone=false;
      } else if(dist>reach){
        // chase
        let vx=dx/dist*this.spd, vy=dy/dist*this.spd;
        const nx=this.x+vx*dt, ny=this.y+vy*dt;
        if(!dun.isWall(nx,this.y)) this.x=nx;
        if(!dun.isWall(this.x,ny)) this.y=ny;
        this.state='walk';
        chasing=true;
      }
    }
    if(this.attackFlashT>0) this.attackFlashT-=dt;
    // knockback
    if(Math.abs(this.kb.x)+Math.abs(this.kb.y)>0.5){
      const nx=this.x+this.kb.x*dt, ny=this.y+this.kb.y*dt;
      if(!dun.isWall(nx,this.y)) this.x=nx;
      if(!dun.isWall(this.x,ny)) this.y=ny;
      this.kb.x*=0.82; this.kb.y*=0.82;
    }
    // Animation state machine: walk while chasing, idle otherwise (idle is
    // also held during the attack swing — see attackFlashT/hitFlash for how
    // the swing itself reads visually without a dedicated attack sprite).
    this.anim.loop=true;
    if(chasing){ this.anim.set(this.cfg.walk||this.cfg.idle,'walk'); }
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
    const flip=this.facing>0; // monster sheets face left by default → flip for right
    const ft=this.cfg.foot||0.9;
    this.anim.draw(ctx,this.x,this.y,scale,flip,ft,a);
    if(this.hitFlash>0){
      ctx.save(); ctx.globalCompositeOperation='lighter';
      this.anim.draw(ctx,this.x,this.y,scale,flip,ft,this.hitFlash*3);
      ctx.restore();
    }
    // attack-swing flash: a forward bright arc standing in for a dedicated
    // attack sprite (the source sheets only have Idle/Run/Death).
    if(this.attackFlashT>0 && !this.dead){
      const sa=Math.min(1,this.attackFlashT/0.5);
      ctx.save();
      ctx.globalAlpha=sa*0.85;
      ctx.globalCompositeOperation='lighter';
      ctx.strokeStyle = this.elite?'#ffd166':'#ff8a7a'; ctx.lineWidth=3;
      ctx.beginPath();
      ctx.arc(this.x+this.facing*this.r*0.9, this.y-this.r*0.3, this.r*1.1, -0.9, 0.9);
      ctx.stroke();
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
