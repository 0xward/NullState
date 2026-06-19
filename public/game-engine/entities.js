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
    this.anim.loop=false; this.anim.set(this.cfg.attack,'attack');
    this.atkCd=0.42;
    return true;
  }
  hurt(dmg){
    if(this.iframe>0) return false;
    this.hp=Math.max(0,this.hp-dmg); this.iframe=0.7; this.flash=0.4;
    return true;
  }
  update(dt, input, dun){
    if(this.atkCd>0) this.atkCd-=dt;
    if(this.iframe>0) this.iframe-=dt;
    if(this.flash>0) this.flash-=dt;

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

    // attack timeline
    if(this.attacking){
      this.atkTime+=dt;
      if(this.atkTime>=0.42){ this.attacking=false; this.anim.loop=true; }
    }
    // anim state
    if(this.attacking){ /* keep attack */ }
    else if(moving){ this.anim.loop=true; this.anim.set(this.cfg.walk,'walk'); this.state='walk'; }
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
  }
}

class Enemy {
  constructor(arch, x, y, depth, isBoss=false, elite=false){
    this.arch=arch; this.isBoss=isBoss; this.elite=elite;
    let scale = 1 + (depth-1)*0.14;
    let hpMul=1, dmgMul=1, xpMul=1, rMul=1, scMul=1;
    if(elite){ hpMul=2.3; dmgMul=1.45; xpMul=2.6; rMul=1.28; scMul=1.26; }
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
    this.aggro = isBoss?9999:(elite?420:300);
    this.hitFlash=0; this.dead=false; this.deathT=0; this.kb={x:0,y:0};
    this.spawnT=0.45;
    this.ultiOffered=false; // ulti popup shown once per enemy
    this.name = elite ? ('Elite '+arch.name) : arch.name;
  }
  hurt(dmg){
    this.hp-=dmg; this.hitFlash=0.18;
    if(this.hp<=0 && !this.dead){ this.dead=true; this.deathT=0.6; return true; }
    return false;
  }
  update(dt, player, dun){
    if(this.spawnT>0) this.spawnT-=dt;
    if(this.dead){ this.deathT-=dt; return; }
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.atkCd>0) this.atkCd-=dt;

    const dx=player.x-this.x, dy=player.y-this.y;
    const dist=Math.hypot(dx,dy)||1;
    if(dx!==0) this.facing=dx>0?1:-1;

    const reach=this.r+player.r+14;
    if(this.attacking){
      this.atkTime+=dt;
      // deal damage mid-swing
      if(!this.hitDone && this.atkTime>0.22 && this.atkTime<0.4 && dist<reach+10){
        this.hitDone=true; this._wantHit=this.dmg;
      }
      if(this.atkTime>=0.55){ this.attacking=false; this.anim.loop=true; this.atkCd=0.6; }
    } else if(dist<this.aggro){
      if(dist<=reach && this.atkCd<=0){
        this.attacking=true; this.atkTime=0; this.hitDone=false;
        this.anim.loop=false; this.anim.set(this.cfg.attack,'attack');
      } else if(dist>reach){
        // chase
        let vx=dx/dist*this.spd, vy=dy/dist*this.spd;
        const nx=this.x+vx*dt, ny=this.y+vy*dt;
        if(!dun.isWall(nx,this.y)) this.x=nx;
        if(!dun.isWall(this.x,ny)) this.y=ny;
        this.state='walk';
      }
    }
    // knockback
    if(Math.abs(this.kb.x)+Math.abs(this.kb.y)>0.5){
      const nx=this.x+this.kb.x*dt, ny=this.y+this.kb.y*dt;
      if(!dun.isWall(nx,this.y)) this.x=nx;
      if(!dun.isWall(this.x,ny)) this.y=ny;
      this.kb.x*=0.82; this.kb.y*=0.82;
    }
    if(!this.attacking){ this.anim.loop=true; this.anim.set(this.cfg.idle,'idle'); }
    this.anim.update(dt);
  }
  takeWantHit(){ const d=this._wantHit; this._wantHit=0; return d; }
  draw(ctx){
    const scale=this.cfg.scale*(this._scaleMul||1);
    let a=1;
    if(this.spawnT>0) a=1-this.spawnT/0.45;
    if(this.dead) a=Math.max(0,this.deathT/0.6);
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
    // hp bar
    if(!this.dead && this.spawnT<=0){
      const w=this.r*2.2, hpw=w*(this.hp/this.maxHp);
      const by=this.y-this.r*2.0;
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(this.x-w/2,by,w,5);
      ctx.fillStyle=this.isBoss?'#ff3b5c':(this.elite?'#ffae00':'#ff5d54'); ctx.fillRect(this.x-w/2,by,Math.max(0,hpw),5);
      if(this.isBoss || this.elite){
        ctx.fillStyle=this.isBoss?'#ffb347':'#ffd166'; ctx.font='10px "Share Tech Mono"'; ctx.textAlign='center';
        ctx.fillText(this.name, this.x, by-6);
      }
    }
  }
}
window.NS_ENT={Anim,Player,Enemy};
