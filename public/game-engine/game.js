/* ============================================================
   NULL_STATE :: GAME  (main loop, render, input, flow)
   --- React-mountable build ---
   Exposes window.NullStateGame = { mount(opts), unmount() }.
   opts.chain provides the on-chain NULL_STRIKE bridge (wagmi-backed),
   matching the original NS_CHAIN.ultiTx({damage,xp,killed,onStatus}) -> {ok,demo,hash}.
   ============================================================ */
window.NullStateGame = (() => {
const { HERO, MON, ARCHETYPES, BOSS_ARCH, backgrounds, preloadAll, img } = window.NS_ASSETS;
const { makeDungeon, TILE } = window.NS_DUNGEON;
const { Player, Enemy } = window.NS_ENT;
const { Decor, DECOR_TYPES, rollLoot } = window.NS_PROPS;
const Story = window.NS_STORY;
const A = window.Audio2;

// ---- mount/teardown state ----
let CHAIN = null;            // injected on mount (wagmi bridge)
let mounted = false, destroyed = false, rafId = null;
const _winL = [];            // [type, fn] window listeners to clean up
function winOn(type, fn){ window.addEventListener(type, fn); _winL.push([type, fn]); }

// ---- DOM refs (assigned in mount) ----
let cv = null, ctx = null;
let stick = null, nub = null, atkBtn = null, touchEl = null;
const $ = id => document.getElementById(id);

let cw=0, ch=0, dpr=1, zoom=1.4, zoomFar=1.4, zoomNear=2.0, portrait=false;

function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function resize(){
  if(!cv) return;
  dpr = Math.min(window.devicePixelRatio||1, 2);
  cw = cv.clientWidth; ch = cv.clientHeight;
  cv.width = cw*dpr; cv.height = ch*dpr;
  portrait = ch > cw;
  // explore (far) zoom + combat (near) zoom — camera animates between them
  zoomFar  = portrait ? clamp(cw/430, 1.15, 2.2) : clamp(Math.min(cw,ch)/620, 0.95, 2.05);
  zoomNear = zoomFar * 1.5;
  zoom = clamp(zoom, zoomFar, zoomNear);
}

// ---- input ----
const input = {up:0,down:0,left:0,right:0,attack:0};
const keymap = {
  ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down',
  ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right',
};
function onKeyDown(e){
  if(keymap[e.code]){ input[keymap[e.code]]=1; e.preventDefault(); }
  if(e.code==='Space'||e.code==='KeyJ'){ input.attack=1; e.preventDefault(); }
  if(e.code==='KeyE'){ tryInteract(); }
}
function onKeyUp(e){ if(keymap[e.code]) input[keymap[e.code]]=0;
  if(e.code==='Space'||e.code==='KeyJ') input.attack=0; }

// touch controls
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;
function setupTouch(){
  if(!isTouch || !touchEl) return; touchEl.classList.remove('hidden');
  let sid=null, sc={x:0,y:0};
  stick.addEventListener('touchstart',e=>{const t=e.changedTouches[0];sid=t.identifier;
    stick.classList.add('active');
    const r=stick.getBoundingClientRect(); sc={x:r.left+r.width/2,y:r.top+r.height/2}; e.preventDefault();},{passive:false});
  stick.addEventListener('touchmove',e=>{for(const t of e.changedTouches){if(t.identifier!==sid)continue;
    let dx=t.clientX-sc.x, dy=t.clientY-sc.y; const m=Math.hypot(dx,dy)||1; const cl=Math.min(m,26);
    dx=dx/m*cl; dy=dy/m*cl; nub.style.left=(26+dx)+'px'; nub.style.top=(26+dy)+'px';
    input.left=dx<-8?1:0; input.right=dx>8?1:0; input.up=dy<-8?1:0; input.down=dy>8?1:0;}
    e.preventDefault();},{passive:false});
  const end=e=>{for(const t of e.changedTouches){if(t.identifier===sid){sid=null;
    stick.classList.remove('active');
    nub.style.left='26px';nub.style.top='26px'; input.left=input.right=input.up=input.down=0;}}};
  stick.addEventListener('touchend',end); stick.addEventListener('touchcancel',end);
  atkBtn.addEventListener('touchstart',e=>{input.attack=1;e.preventDefault();},{passive:false});
  atkBtn.addEventListener('touchend',e=>{input.attack=0;e.preventDefault();},{passive:false});
}

// ---- world state ----
let G = null;  // game object
function newGame(charKey){
  const cfg = HERO[charKey];
  const p = new Player(charKey, cfg);
  G = { player:p, dun:null, enemies:[], decor:[], particles:[], dmgNums:[],
        depth:0, shake:0, time:0, paused:false, bgIndex:0, bossAlive:false, over:false,
        ulti:{ cd:0, lowHpArmed:true } };
  descend();
}

function descend(){
  G.depth++;
  G.player.depth=G.depth;
  const d = makeDungeon(G.depth);
  G.dun=d; G.enemies=[]; G.decor=[]; G.particles=[]; G.dmgNums=[];
  G.player.x=d.startPx.x; G.player.y=d.startPx.y;
  G.bgIndex=(G.depth-1)%backgrounds.length;
  G.ulti.lowHpArmed=true;
  const isBoss = G.depth%5===0;
  G.bossAlive=false;
  if(isBoss){
    const e=new Enemy(BOSS_ARCH, d.stairsPx.x, d.stairsPx.y-60, G.depth, true);
    G.enemies.push(e); G.bossAlive=true;
  } else {
    const eliteChance=Math.min(0.30, 0.12 + G.depth*0.015);
    let eliteCount=0;
    for(const s of d.spawns){
      const arch=ARCHETYPES[(Math.random()*Math.min(ARCHETYPES.length, 1+G.depth))|0]||ARCHETYPES[0];
      const elite = (eliteCount<2) && Math.random()<eliteChance;
      if(elite) eliteCount++;
      G.enemies.push(new Enemy(arch, s.x, s.y, G.depth, false, elite));
    }
  }
  // scatter breakable room decorations across rooms (not start/stairs tiles)
  spawnDecor(d);
  // banner + log
  showBanner(`FLOOR ${G.depth}`, isBoss?'⚠ GUARDED':backgrounds[G.bgIndex].split('/').pop().replace('.png','').toUpperCase());
  if(isBoss){
    cutscene(Story.bossIntro);
  } else {
    log(Story.floorLine(G.depth),'dm');
  }
  A.descend();
}

function spawnDecor(d){
  const common=['vase','pot','barrel','crate','cabinet_s'];
  const rare=['wardrobe','chest'];
  const g=d.grid, W=d.W, H=d.H;
  const isWall=(x,y)=> !(x>=0&&y>=0&&x<W&&y<H) || g[y][x]===0;
  for(const r of d.rooms){
    // Collect floor cells along the room edge that hug a wall, and the
    // direction the decoration should face (away from that wall, into the room):
    //   wall above  -> face DOWN  (6 o'clock)   wall below -> face UP   (12)
    //   wall left   -> face RIGHT (3 o'clock)   wall right -> face LEFT (9)
    const cand=[];
    for(let ty=r.y; ty<r.y+r.h; ty++){
      for(let tx=r.x; tx<r.x+r.w; tx++){
        if(g[ty][tx]===0) continue; // must stand on a floor tile
        const wU=isWall(tx,ty-1), wD=isWall(tx,ty+1), wL=isWall(tx-1,ty), wR=isWall(tx+1,ty);
        let facing=null, ox=0.5, oy=0.9;
        if(wU && !wD){ facing='down';  ox=0.5;  oy=0.66; }   // against top wall
        else if(wD && !wU){ facing='up';    ox=0.5;  oy=0.99; } // against bottom wall
        else if(wL && !wR){ facing='right'; ox=0.33; oy=0.92; } // against left wall
        else if(wR && !wL){ facing='left';  ox=0.67; oy=0.92; } // against right wall
        if(!facing) continue;
        const px=(tx+ox)*TILE, py=(ty+oy)*TILE;
        if(Math.hypot(px-d.startPx.x,py-d.startPx.y)<TILE*1.8) continue;
        if(Math.hypot(px-d.stairsPx.x,py-d.stairsPx.y)<TILE*1.8) continue;
        cand.push({px,py,facing});
      }
    }
    if(!cand.length) continue;
    // shuffle candidates
    for(let i=cand.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=cand[i]; cand[i]=cand[j]; cand[j]=t; }
    const area=r.w*r.h;
    const n=Math.min(cand.length, Math.min(4, Math.max(1, Math.round(area/16))));
    let placed=0;
    for(const c of cand){
      if(placed>=n) break;
      if(G.decor.some(o=>Math.hypot(o.x-c.px,o.y-c.py)<TILE*0.9)) continue;
      const t = Math.random()<0.12 ? rare[Math.random()<0.5?0:1]
                                   : common[Math.floor(Math.random()*common.length)];
      G.decor.push(new Decor(t,c.px,c.py,c.facing));
      placed++;
    }
  }
}

function applyLoot(kind,amt,x,y){
  const p=G.player;
  if(kind==='hp'){ p.hp=Math.min(p.maxHp,p.hp+amt); lootText(x,y,'+'+amt+' HP','#3dff88'); }
  else if(kind==='xp'){ const ups=p.gainXp(amt); lootText(x,y,'+'+amt+' XP','#4ad7ff');
    if(ups>0){ A.levelup(); log('◆ LEVEL UP → '+p.level,'reward'); spark(p.x,p.y-20,'#00ff88',24,200); } }
  else if(kind==='celo'){ p.celo+=amt; lootText(x,y,'+'+amt.toFixed(2)+' CELO','#ffd166'); }
  A.pickup(); updateHUD();
}
function lootText(x,y,txt,color){ G.dmgNums.push({x,y,val:txt,life:1.2,crit:false,vy:-38,color}); }

// ---------- ULTI (on-chain NULL_STRIKE) ----------
function offerUlti(target,reason){
  G.ulti.target=target; G.paused=true;
  $('ultiTarget').textContent=(target.name||'ENEMY').toUpperCase();
  $('ultiDesc').textContent = reason==='lowhp'
    ? 'You are near death. Sign an on-chain NULL_STRIKE to crush your foe before the dark takes you.'
    : (target.isBoss
        ? 'The Gatekeeper looms. Channel an on-chain NULL_STRIKE to break its guard.'
        : 'An elite blocks your path. Sign an on-chain NULL_STRIKE for devastating damage.');
  $('ultiStatus').textContent=''; $('ultiNote').textContent='';
  $('ultiTx').disabled=false;
  $('ulti').classList.remove('hidden');
}
function closeUlti(){
  $('ulti').classList.add('hidden');
  G.ulti.target=null; G.ulti.cd=8; if(G) G.paused=false;
}
function applyUltiDamage(t){
  const dmg=Math.max(1, Math.ceil(t.hp*0.92));
  t.hp=Math.max(1, t.hp-dmg);          // leave foe near death
  t.hitFlash=0.25;
  dmgNum(t.x,t.y-t.r,dmg,true);
  spark(t.x,t.y-10,'#ffae00',46,320);
  G.shake=13; G.ultiFlash=0.55; A.ultiBlast();
}
function maybeOfferUlti(nearest,nd){
  const u=G.ulti; if(!u||u.cd>0||G.paused||G.over) return;
  const p=G.player;
  if(p.hp/p.maxHp>0.4) u.lowHpArmed=true;
  if(u.lowHpArmed && p.hp/p.maxHp<0.25 && nearest && nd<330){
    u.lowHpArmed=false; offerUlti(nearest,'lowhp'); return;
  }
  if(nearest && !nearest.ultiOffered && nd<300 && (nearest.isBoss||nearest.elite)){
    nearest.ultiOffered=true; offerUlti(nearest, nearest.isBoss?'boss':'elite');
  }
}

function tryInteract(){
  if(!G||G.over) return;
  const d=G.dun, p=G.player;
  const dx=p.x-d.stairsPx.x, dy=p.y-d.stairsPx.y;
  if(Math.hypot(dx,dy)<TILE*0.9){
    if(G.bossAlive){ log('The way down is sealed. The Gatekeeper bars your path.','combat'); return; }
    descend();
  }
}

// ---- particles & numbers ----
function spark(x,y,color,n=8,spd=120){
  for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2, s=spd*(0.4+Math.random());
    G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0.4+Math.random()*0.3,
      max:0.7,color,r:2+Math.random()*2});}
}
function dmgNum(x,y,val,crit=false){ G.dmgNums.push({x,y,val,life:0.9,crit,vy:-46}); }

// ---- combat resolution ----
function hitTest(){
  const p=G.player;
  const z=p.hitZone();
  if(z){
    A.attack();
    let any=false;
    for(const e of G.enemies){
      if(e.dead) continue;
      if(Math.hypot(e.x-z.x,e.y-z.y) < z.r+e.r){
        const dmg=z.dmg+(Math.random()*6|0);
        const killed=e.hurt(dmg);
        dmgNum(e.x,e.y-e.r, dmg);
        spark(e.x,e.y-8,e.arch.color,10,160);
        const kx=Math.sign(e.x-p.x)||p.facing, ky=Math.sign(e.y-p.y);
        e.kb.x=kx*180; e.kb.y=ky*120;
        G.shake=Math.min(G.shake+5,9); A.hit(); any=true;
        if(killed){ onEnemyKilled(e); }
      }
    }
    if(any===false){ /* swing missed enemies */ }
    // breakable decorations caught in the same swing
    for(const o of G.decor){
      if(o.broken) continue;
      if(Math.hypot(o.x-(z.x), (o.y-o.h*0.4)-z.y) < z.r+o.r){
        const broke=o.hit();
        spark(o.x,o.y-o.h*0.4,'#caa15a',6,120); G.shake=Math.min(G.shake+2,6);
        if(broke){
          A.breakProp(); spark(o.x,o.y-o.h*0.45,'#b98a4a',20,180);
          const loot=rollLoot(o.def.loot);
          if(loot.kind!=='none') applyLoot(loot.kind, loot.amt, o.x, o.y-o.h*0.8);
          log(o.def.label+' shattered'+(loot.kind!=='none'?' — loot!':'.'), loot.kind==='celo'?'reward':'dm');
        } else { A.hit(); }
      }
    }
  }
  // enemies hitting player
  for(const e of G.enemies){
    if(e.dead) continue;
    const wd=e.takeWantHit?e.takeWantHit():0;
    if(wd>0){
      if(p.hurt(wd)){
        dmgNum(p.x,p.y-30,wd); A.hurt(); G.shake=Math.min(G.shake+7,12);
        spark(p.x,p.y-10,'#ff3b5c',8,120);
        updateHUD();
        if(p.hp<=0) gameOver();
      }
    }
  }
}

function onEnemyKilled(e){
  A.enemyDeath(); spark(e.x,e.y-10,e.arch.color,22,200);
  G.shake=Math.min(G.shake+4,9);
  const p=G.player;
  p.kills++;
  const reward=(0.01 + (e.isBoss?0.2:0.01)).toFixed(2);
  p.celo+=parseFloat(reward);
  const ups=p.gainXp(e.xp);
  log(`${e.arch.name} purged. +${e.xp} XP · +${reward} CELO`, 'reward');
  if(ups>0){ A.levelup(); log(`◆ LEVEL UP → ${p.level}. Max HP & power increased.`,'reward');
    spark(p.x,p.y-20,'#00ff88',30,220); }
  updateHUD();
  if(e.isBoss){
    G.bossAlive=false;
    setTimeout(()=>cutscene(Story.bossDown),700);
  }
}

// ---- camera ----
const cam={x:0,y:0};
function updateCam(){
  cam.x=G.player.x; cam.y=G.player.y;
  const halfW=cw/2/zoom, halfH=ch/2/zoom;
  cam.x=Math.max(halfW,Math.min(G.dun.pxW-halfW,cam.x));
  cam.y=Math.max(halfH,Math.min(G.dun.pxH-halfH,cam.y));
}

// ---- render ----
function render(){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cw,ch);
  ctx.fillStyle='#04060a'; ctx.fillRect(0,0,cw,ch);
  if(!G){ return; }

  const sx=(G.shake>0?(Math.random()*2-1)*G.shake:0);
  const sy=(G.shake>0?(Math.random()*2-1)*G.shake:0);
  ctx.save();
  ctx.translate(cw/2+sx, ch/2+sy);
  ctx.scale(zoom,zoom);
  ctx.translate(-cam.x,-cam.y);

  drawTiles();
  drawStairs();

  // entities + decor painter-sorted by y
  const ents=[G.player, ...G.enemies, ...G.decor].sort((a,b)=>a.y-b.y);
  for(const e of ents) e.draw(ctx);

  drawParticles();
  drawDmgNums();

  ctx.restore();

  drawDarkness(sx,sy);
  drawVignette();
  if(G.ultiFlash>0){
    const a=Math.min(0.7, G.ultiFlash);
    const g=ctx.createRadialGradient(cw/2,ch/2,0,cw/2,ch/2,Math.max(cw,ch)*0.7);
    g.addColorStop(0,`rgba(255,200,80,${a})`); g.addColorStop(1,`rgba(255,120,0,0)`);
    ctx.fillStyle=g; ctx.fillRect(0,0,cw,ch);
  }
}

function drawTiles(){
  const d=G.dun;
  const x0=Math.max(0,((cam.x-cw/2/zoom)/TILE|0)-1);
  const x1=Math.min(d.W,((cam.x+cw/2/zoom)/TILE|0)+2);
  const y0=Math.max(0,((cam.y-ch/2/zoom)/TILE|0)-1);
  const y1=Math.min(d.H,((cam.y+ch/2/zoom)/TILE|0)+2);
  for(let y=y0;y<y1;y++){
    for(let x=x0;x<x1;x++){
      const t=d.grid[y][x];
      const px=x*TILE, py=y*TILE;
      if(t===0){ continue; } // void = unlit
      // floor
      const shade=((x+y)%2===0)?'#0c1620':'#0a121b';
      ctx.fillStyle=shade; ctx.fillRect(px,py,TILE,TILE);
      // subtle grid edge near walls
      if(d.grid[y-1]&&d.grid[y-1][x]===0){ ctx.fillStyle='rgba(0,255,136,.05)'; ctx.fillRect(px,py,TILE,4); }
      // faint floor speckle
      if(((x*7+y*13)%11)===0){ ctx.fillStyle='rgba(0,255,136,.06)'; ctx.fillRect(px+TILE/2-1,py+TILE/2-1,2,2); }
    }
  }
  // wall faces (draw void-adjacent edges as raised wall)
  for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
    if(d.grid[y][x]!==0) continue;
    if(d.grid[y+1]&&d.grid[y+1][x]!==0){ // wall above a floor → draw face
      ctx.fillStyle='#16222e'; ctx.fillRect(x*TILE,(y+1)*TILE-10,TILE,10);
      ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(x*TILE,(y+1)*TILE-2,TILE,2);
    }
  }
}

function drawStairs(){
  const s=G.dun.stairsPx;
  const pulse=0.5+0.5*Math.sin(G.time*3);
  ctx.save();
  ctx.translate(s.x,s.y);
  const locked=G.bossAlive;
  const col=locked?'#ff3b5c':'#00ff88';
  ctx.globalAlpha=0.25+0.25*pulse;
  ctx.fillStyle=col;
  ctx.beginPath(); ctx.arc(0,0,30,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1; ctx.strokeStyle=col; ctx.lineWidth=2;
  ctx.strokeRect(-16,-16,32,32);
  ctx.fillStyle=col; ctx.font='14px "Share Tech Mono"'; ctx.textAlign='center';
  ctx.fillText(locked?'✖':'▾',0,5);
  ctx.restore();
}

function drawParticles(){
  for(const p of G.particles){
    const a=Math.max(0,p.life/p.max);
    ctx.globalAlpha=a; ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}
function drawDmgNums(){
  ctx.textAlign='center';
  for(const n of G.dmgNums){
    const a=Math.max(0,n.life/0.9);
    ctx.globalAlpha=a;
    ctx.font=`bold ${n.crit?20:15}px "Share Tech Mono"`;
    ctx.fillStyle=n.color||(n.crit?'#ffd166':'#fff');
    ctx.fillText(n.val, n.x, n.y);
  }
  ctx.globalAlpha=1;
}

function drawDarkness(sx,sy){
  // screen-space light around player
  const px=(G.player.x-cam.x)*zoom+cw/2+sx;
  const py=(G.player.y-cam.y)*zoom+ch/2+sy;
  const rad=Math.max(cw,ch)*0.42;
  const g=ctx.createRadialGradient(px,py,rad*0.18, px,py,rad);
  g.addColorStop(0,'rgba(0,0,0,0)');
  g.addColorStop(0.55,'rgba(2,5,8,0.35)');
  g.addColorStop(1,'rgba(1,3,5,0.95)');
  ctx.fillStyle=g; ctx.fillRect(0,0,cw,ch);
  // warm torch tint
  const g2=ctx.createRadialGradient(px,py,0,px,py,rad*0.6);
  g2.addColorStop(0,'rgba(0,255,136,0.06)');
  g2.addColorStop(1,'rgba(0,255,136,0)');
  ctx.fillStyle=g2; ctx.fillRect(0,0,cw,ch);
}
function drawVignette(){
  const g=ctx.createRadialGradient(cw/2,ch/2,Math.min(cw,ch)*0.3,cw/2,ch/2,Math.max(cw,ch)*0.75);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.55)');
  ctx.fillStyle=g; ctx.fillRect(0,0,cw,ch);
}

// ---- update ----
function update(dt){
  if(!G||G.paused||G.over) return;
  G.time+=dt;
  const p=G.player;
  if(G.ulti.cd>0) G.ulti.cd-=dt;
  if(G.ultiFlash>0) G.ultiFlash-=dt;
  // nearest alive enemy (drives auto-attack + camera + ulti)
  let nearest=null, nd=1e9;
  for(const e of G.enemies){ if(e.dead||e.spawnT>0) continue;
    const d=Math.hypot(e.x-p.x,e.y-p.y); if(d<nd){ nd=d; nearest=e; } }
  G._nd=nd;
  // nearest unbroken decoration
  let nearDecor=null, ndd=1e9;
  for(const o of G.decor){ if(o.broken) continue;
    const d=Math.hypot(o.x-p.x,o.y-p.y); if(d<ndd){ ndd=d; nearDecor=o; } }
  // AUTO-ATTACK: enemies first, then nearby breakables
  const enemyInRange = nearest && nd < (66+nearest.r);
  const decorInRange = nearDecor && ndd < (50+nearDecor.r);
  if(p.atkCd<=0 && !p.attacking){
    if(enemyInRange){ p.facing=(nearest.x>=p.x)?1:-1; p.startAttack(); }
    else if(decorInRange){ p.facing=(nearDecor.x>=p.x)?1:-1; p.startAttack(); }
  }
  if(input.attack) p.startAttack();          // manual (desktop)
  // ULTI offer (elite / boss / low-hp)
  maybeOfferUlti(nearest, nd);
  if(G.paused) return;                        // ulti popup opened this frame
  p.update(dt, input, G.dun);
  hitTest();
  for(const e of G.enemies) e.update(dt, p, G.dun);
  // resolve enemy-dealt damage collected in hitTest already; also separation
  G.enemies = G.enemies.filter(e=>!(e.dead && e.deathT<=0));
  // decorations
  for(const o of G.decor) o.update(dt);
  G.decor = G.decor.filter(o=>!(o.broken && o.brokenT<=0));
  // particles
  for(const pt of G.particles){ pt.x+=pt.vx*dt; pt.y+=pt.vy*dt; pt.vy+=160*dt; pt.life-=dt; }
  G.particles=G.particles.filter(p=>p.life>0);
  for(const n of G.dmgNums){ n.y+=n.vy*dt; n.vy+=40*dt; n.life-=dt; }
  G.dmgNums=G.dmgNums.filter(n=>n.life>0);
  if(G.shake>0) G.shake=Math.max(0,G.shake-dt*22);
  // dynamic camera zoom: far while exploring, closer near monsters
  const nd2 = G._nd!==undefined ? G._nd : 1e9;
  let zt;
  if(nd2 < 210) zt = zoomNear;
  else if(nd2 > 470) zt = zoomFar;
  else zt = zoomNear + (zoomFar - zoomNear) * ((nd2-210)/260);
  zoom += (zt - zoom) * Math.min(1, dt*3.2);
  // auto-descend on stepping onto unlocked stairs
  if(!G.bossAlive){
    const dx=p.x-G.dun.stairsPx.x, dy=p.y-G.dun.stairsPx.y;
    if(Math.hypot(dx,dy)<TILE*0.7){ descend(); return; }
  }
  // ambient dust
  if(Math.random()<0.15){ const a=Math.random()*Math.PI*2,r=60+Math.random()*120;
    G.particles.push({x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r,vx:0,vy:-8,life:1.2,max:1.2,
      color:'rgba(0,255,136,.25)',r:1}); }
  updateCam();
}

// ---- loop ----
let last=0;
function frame(t){
  if(destroyed) return;
  const dt=Math.min(0.05,(t-last)/1000||0); last=t;
  update(dt); render();
  rafId=requestAnimationFrame(frame);
}

// ---- HUD ----
function updateHUD(){
  if(!G) return; const p=G.player;
  $('hpFill').style.width=(p.hp/p.maxHp*100)+'%';
  $('hpText').textContent=`${Math.ceil(p.hp)}/${p.maxHp}`;
  $('xpFill').style.width=(p.xp/p.xpForNext()*100)+'%';
  $('xpText').textContent=`${p.xp}/${p.xpForNext()}`;
  $('lvl').textContent=p.level; $('floor').textContent=G.depth;
  $('kills').textContent=p.kills; $('celo').textContent=p.celo.toFixed(2);
}
function log(text,type='dm'){
  const el=document.createElement('div'); el.className='line '+type; el.textContent=text;
  const box=$('log'); if(!box) return; box.appendChild(el);
  while(box.children.length>5) box.removeChild(box.firstChild);
  setTimeout(()=>{ if(el.parentNode){el.style.transition='opacity .6s';el.style.opacity='0';
    setTimeout(()=>el.remove(),600);} }, 5200);
}
let bannerTO=null;
function showBanner(main,sub){
  const b=$('floorBanner'); if(!b) return; b.innerHTML=`${main}<span class="sub">${sub||''}</span>`;
  b.classList.add('show'); clearTimeout(bannerTO);
  bannerTO=setTimeout(()=>b.classList.remove('show'),2200);
}

// ---- cutscene ----
let csLines=[], csIdx=0, csDone=null;
function cutscene(lines,onDone){
  G&&(G.paused=true);
  csLines=lines; csIdx=0; csDone=onDone||null;
  $('story').classList.remove('hidden');
  renderCS();
}
function renderCS(){ $('storyText').textContent=csLines[csIdx]; }
function onStoryNext(){
  csIdx++;
  if(csIdx>=csLines.length){
    $('story').classList.add('hidden');
    if(G) G.paused=false;
    const cb=csDone; csDone=null; if(cb) cb();
  } else renderCS();
}

// ---- death ----
function gameOver(){
  if(G.over) return; G.over=true;
  const p=G.player;
  setTimeout(()=>{
    $('deathSub').textContent=Story.deathLine();
    $('deathStats').innerHTML=
      `<div class="ds"><b>${G.depth}</b><span>FLOOR REACHED</span></div>`+
      `<div class="ds"><b>${p.level}</b><span>LEVEL</span></div>`+
      `<div class="ds"><b>${p.kills}</b><span>SOULS PURGED</span></div>`+
      `<div class="ds"><b>${p.celo.toFixed(2)}</b><span>CELO RECLAIMED</span></div>`;
    $('death').classList.remove('hidden');
  },650);
}
function onRevive(){
  $('death').classList.add('hidden');
  newGame(selectedChar);
  cutscene(['You claw your way back from the NULL. The depths reset, but they remember…'], ()=>updateHUD());
  updateHUD();
}

// ---- ulti button handlers ----
function onUltiSkip(){ closeUlti(); }
async function onUltiTx(){
  const t=G&&G.ulti.target; if(!t){ closeUlti(); return; }
  const btn=$('ultiTx'), status=$('ultiStatus'), note=$('ultiNote');
  btn.disabled=true;
  const MAP={connecting:'Connecting wallet…',registering:'Registering Walker on-chain…',
    signing:'Confirm in your wallet…',pending:'Broadcasting to Celo…',
    demo:'No wallet connected — demo strike…'};
  try{
    const res=await CHAIN.ultiTx({
      damage: Math.ceil(t.hp*0.92), xp: t.xp, killed:false,
      onStatus:(s)=>{ status.textContent=MAP[s]||s; }
    });
    status.textContent='';
    applyUltiDamage(t);
    if(res.demo){
      note.textContent='⚠ Demo mode — connect a Celo wallet (MiniPay / MetaMask) for a real on-chain strike.';
    } else {
      note.innerHTML='✓ Confirmed on Celo'+(res.hash?` · <a href="https://celoscan.io/tx/${res.hash}" target="_blank" rel="noopener" style="color:#7fffce">view tx ↗</a>`:'');
    }
    log('⚡ NULL_STRIKE landed — '+(t.name||'foe')+' reels, near death.', 'reward');
    setTimeout(closeUlti, res.demo?700:1300);
  }catch(e){
    status.textContent='';
    const msg = (e&&e.message==='NO_WALLET') ? 'No wallet detected'
              : (e&&(e.shortMessage||e.info&&e.info.error&&e.info.error.message||e.message)) || 'Transaction failed';
    note.textContent='✗ '+msg+' — you can SKIP and keep fighting.';
    btn.disabled=false;
  }
}

// ---- title / char select ----
let selectedChar='male';
// draw a character preview at a CONSISTENT on-screen height by detecting the
// sprite's alpha bounding box (frame 0) and normalizing — so male & female match.
function drawPreview(elId, cfg){
  const im = window.NS_ASSETS.img(cfg.idle.src);
  const host = $(elId);
  if(!im || !host){ return; }
  const {fw,fh} = cfg.idle;
  const off=document.createElement('canvas'); off.width=fw; off.height=fh;
  const oc=off.getContext('2d'); oc.drawImage(im,0,0,fw,fh,0,0,fw,fh);
  let data;
  try{ data=oc.getImageData(0,0,fw,fh).data; }catch(e){ return; }
  let minX=fw,minY=fh,maxX=0,maxY=0,found=false;
  for(let y=0;y<fh;y++)for(let x=0;x<fw;x++){
    if(data[(y*fw+x)*4+3]>24){ found=true;
      if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; }
  }
  if(!found){ minX=0;minY=0;maxX=fw-1;maxY=fh-1; }
  const cW=maxX-minX+1, cH=maxY-minY+1;
  const BOX=88, TARGET=74, s=TARGET/cH;
  const dw=cW*s, dh=cH*s;
  const c=document.createElement('canvas'); c.width=BOX; c.height=BOX;
  const g=c.getContext('2d'); g.imageSmoothingEnabled=false;
  g.drawImage(im, minX,minY,cW,cH, (BOX-dw)/2, BOX-dh-6, dw,dh);
  host.innerHTML=''; host.appendChild(c);
  host.style.cssText=`width:${BOX}px;height:${BOX}px;`;
}
function paintPreview(){
  drawPreview('prevMale', HERO.male);
  drawPreview('prevFemale', HERO.female);
}
function onCharBtn(e){
  const b=e.currentTarget;
  document.querySelectorAll('.ns-game-root .char-btn').forEach(x=>x.classList.remove('selected'));
  b.classList.add('selected'); selectedChar=b.dataset.char;
}
function onMute(){
  const m=A.toggleMute(); $('muteBtn').classList.toggle('off',m);
  $('muteBtn').textContent=m?'♫':'♪';
}
async function onStart(){
  A.start();
  $('startBtn').textContent='ENTERING…'; $('startBtn').disabled=true;
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  newGame(selectedChar);
  updateHUD();
  cutscene(Story.intro, ()=>{ updateHUD(); });
}

// ---- attach DOM listeners (called in mount) ----
function attach(){
  winOn('resize', resize);
  winOn('keydown', onKeyDown);
  winOn('keyup', onKeyUp);
  cv.addEventListener('mousedown', ()=>{ input.attack=1; });
  cv.addEventListener('mouseup', ()=>{ input.attack=0; });
  $('storyNext').addEventListener('click', onStoryNext);
  $('reviveBtn').addEventListener('click', onRevive);
  $('ultiSkip').addEventListener('click', onUltiSkip);
  $('ultiTx').addEventListener('click', onUltiTx);
  document.querySelectorAll('.ns-game-root .char-btn').forEach(b=>b.addEventListener('click', onCharBtn));
  $('muteBtn').addEventListener('click', onMute);
  $('startBtn').addEventListener('click', onStart);
}

// debug hook (harmless; used for automated testing)
window.__NS = { get G(){ return G; },
  spawnNear(){ if(!G) return; const a=ARCHETYPES[0];
    G.enemies.push(new Enemy(a, G.player.x+50, G.player.y, G.depth, false)); },
  spawnElite(){ if(!G) return; const a=ARCHETYPES[0];
    G.enemies.push(new Enemy(a, G.player.x+120, G.player.y, G.depth, false, true)); },
  addDecor(t){ if(!G) return; G.decor.push(new Decor(t||'vase', G.player.x+40, G.player.y)); } };

// ---- boot ----
async function boot(){
  resize();
  $('titleLore').textContent=Story.title;
  setupTouch();
  await preloadAll();
  if(destroyed) return;
  paintPreview();
  rafId=requestAnimationFrame(frame);
}

// ---- public API ----
function mount(opts){
  opts = opts || {};
  if(mounted) return;
  mounted = true; destroyed = false; last = 0; G = null;
  CHAIN = opts.chain || { ultiTx: async ()=>({ ok:true, demo:true, hash:null }) };
  cv = document.getElementById('game');
  ctx = cv ? cv.getContext('2d') : null;
  stick = document.getElementById('stick');
  nub = document.getElementById('stickNub');
  atkBtn = document.getElementById('atkBtn');
  touchEl = document.getElementById('touchControls');
  if(!cv){ mounted=false; console.warn('NullStateGame: #game canvas not found'); return; }
  attach();
  boot();
}
function unmount(){
  destroyed = true; mounted = false;
  if(rafId){ cancelAnimationFrame(rafId); rafId=null; }
  _winL.forEach(([t,f])=>window.removeEventListener(t,f)); _winL.length=0;
  G = null; last = 0;
  cv = ctx = stick = nub = atkBtn = touchEl = null;
}

return { mount, unmount };
})();
