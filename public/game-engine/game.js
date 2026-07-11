/* ============================================================
   NULL_STATE :: GAME  (main loop, render, input, flow)
   --- React-mountable build ---
   Exposes window.NullStateGame = { mount(opts), unmount() }.
   opts.chain provides the on-chain NULL_STRIKE bridge (wagmi-backed),
   matching the original NS_CHAIN.ultiTx({damage,xp,killed,onStatus}) -> {ok,demo,hash}.
   ============================================================ */
window.NullStateGame = (() => {
const { HERO, MON, ARCHETYPES, BOSS_ARCH, ORC_SHAMAN_ARCH, SKEL_MAGE_ARCH, SKEL_WARRIOR_ARCH, backgrounds, BG_BY_KEY, preloadAll, preloadHeroPreviews, preloadLPCHero, img, DECOR_SPRITES, GOLDEN_KEY_SRC, DUNGEON_THEMES } = window.NS_ASSETS;
const { makeDungeon, TILE } = window.NS_DUNGEON;
const { Player, Enemy } = window.NS_ENT;
const { Decor, DECOR_TYPES, rollLoot } = window.NS_PROPS;
const Story = window.NS_STORY;
const CAMPAIGN = window.NS_CAMPAIGN;
const Outdoor = window.NS_OUTDOOR;
const A = window.Audio2;

// ---- mount/teardown state ----
let CHAIN = null;            // injected on mount (wagmi bridge)
// WALLET_ADDRESS: current connected wallet, attached to burn-record events
// so /api/burn/record knows whose stash to credit. Kept in sync after
// mount via setWalletAddress() (see DungeonGame.tsx — wagmi's address can
// change after the engine has already mounted).
let WALLET_ADDRESS = null;
// INITIAL_STATS: baseline {xp, level} pulled from the on-chain PlayerProfile,
// applied to a brand-new run so a returning player's career level carries
// over even when there's no exact bunker save (see applyRestoredState()).
let INITIAL_STATS = null;
// SAVED_SESSION: an exact off-chain snapshot (see getSaveSnapshot()) written
// by the Settings > Save Game action. Single-use — consumed the moment
// onStart() restores it, so it can't be replayed (matches "Death is
// permanent" — no save-scumming a dangerous fight).
let SAVED_SESSION = null;
let mounted = false, destroyed = false, rafId = null;
const _winL = [];            // [type, fn] window listeners to clean up
function winOn(type, fn, opts){ window.addEventListener(type, fn, opts); _winL.push([type, fn]); }

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
  // explore (far) zoom + combat (near) zoom — camera animates between them.
  // Lowered floors/multiplier vs. the original (1.15 far / 1.5x near) — those
  // made characters render far too large on typical phone widths (~360-430px).
  zoomFar  = portrait ? clamp(cw/520, 0.78, 1.5) : clamp(Math.min(cw,ch)/680, 0.85, 1.6);
  zoomNear = zoomFar * 1.22; // gentler combat push-in (was 1.5x)
  zoom = clamp(zoom, zoomFar, zoomNear);
}

// ---- input ----
const input = {up:0,down:0,left:0,right:0,attack:0};
function resetInput(){
  input.up=input.down=input.left=input.right=input.attack=0;
  if(nub){ nub.style.left='26px'; nub.style.top='26px'; }
  if(stick) stick.classList.remove('active');
}
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

// Recompute level-derived stats (maxHp/atkDmg/speed) so a restored player
// at level N has exactly the same numbers gainXp()'s level-up loop would
// have produced getting there naturally — see entities.js Player.gainXp().
function applyLevelStats(p, level){
  const steps = Math.max(0, level - 1);
  p.level = level;
  p.maxHp = 120 + 14 * steps;
  p.atkDmg = 22 + 3 * steps;
  p.speed = 188 + 1.5 * steps;
}

// Apply a saved/baseline snapshot to a freshly-constructed player + G.
// `snap` shape: { xp, level, kills, celo, hp, depth, maxDepthReached,
//                 inventory:{keys,relics,shards}, key:{depth,taken} }
function applyRestoredState(G, p, snap){
  applyLevelStats(p, snap.level || 1);
  p.xp = snap.xp || 0;
  p.kills = snap.kills || 0;
  p.celo = snap.celo || 0;
  p.hp = Math.min(snap.hp != null ? snap.hp : p.maxHp, p.maxHp);
  if (snap.inventory) {
    G.inventory.keys = snap.inventory.keys || 0;
    G.inventory.relics = snap.inventory.relics || 0;
    G.inventory.shards = snap.inventory.shards || 0;
    G.inventory.items = {};
    if (snap.inventory.items && window.NS_ITEMS) {
      for (const [id, qty] of Object.entries(snap.inventory.items)) {
        const item = window.NS_ITEMS.getItem(Number(id));
        if (item && qty > 0) G.inventory.items[item.id] = { item, qty };
      }
    }
  }
  if (snap.key && snap.key.taken) {
    G.key.depth = snap.key.depth || 0;
    G.key.taken = true;
  } else {
    // Key wasn't picked up (or no key info saved) — re-roll it like a fresh run.
    placeKeyRandomly();
  }
  G.maxDepthReached = Math.max(snap.maxDepthReached || 1, snap.depth || 1);
}

function newGame(charKey, restoreSnapshot){
  const cfg = HERO[charKey];
  const p = new Player(charKey, cfg);
  G = { player:p, dun:null, enemies:[], decor:[], particles:[], dmgNums:[], projectiles:[],
        depth:0, shake:0, time:0, paused:false, bgIndex:0, bossAlive:false, over:false,
        // Unified non-blocking action button state (replaces the old ULTI
        // popup). mode: null | 'ulti' | 'open'. target: the boss Enemy (ulti)
        // or the Decor container (open) currently in range. cd: short
        // cooldown after a NULL_STRIKE so the button can't be double-tapped
        // while the same boss stays in range.
        action:{ mode:null, target:null, cd:0 },
        // Per-floor cache: floors[depth] = {dun, enemies, decor, cleared, bossAlive}
        // so revisiting a floor via the lift shows it exactly as it was left
        // (dead enemies stay dead, unbroken decor stays lootable).
        floors:{}, maxDepthReached:0,
        // Per-run state: the one golden key in this match, where it currently
        // sits (floor + world pos), whether it's been picked up, and the
        // floor to respawn on after death.
        key:{ depth:0, x:0, y:0, taken:false },
        // keys/relics/shards: legacy simple counters (still used for lift-key
        // and the relic-power mutation system). items: the new NS_ITEMS-backed
        // stash, keyed by item id -> {item, qty}. burnQueue: Set of item ids
        // the player has marked to send to the weekly burn pool.
        inventory:{ keys:0, relics:0, shards:0, items:{} },
        burnQueue:new Set(),
        // Marketplace equipment (offchain). owned: list of equipment ids the
        // player has purchased (loaded from Firebase via NS_EQUIP.setOwned).
        // equipped: currently worn item id per slot. PERMANENT — never consumed.
        equipment:{ owned:[], equipped:{ mainhand:null, body:null } },
        discoveredRooms:new Set(), lastRoomId:null, floorClearShown:{}, combo:{count:0,t:0},
        respawnDepth:1 };

  // A save (exact bunker resume) takes priority; otherwise fall back to the
  // on-chain career baseline (level/xp carried over, but a fresh floor 1
  // run) so "Continue" never silently starts a level-1 nobody again.
  const snap = restoreSnapshot || (INITIAL_STATS ? {
    xp: INITIAL_STATS.xp, level: INITIAL_STATS.level, kills: 0, celo: 0,
    depth: 1, maxDepthReached: 1,
  } : null);

  let startDepth = 1;
  if (snap) {
    applyRestoredState(G, p, snap);
    startDepth = snap.depth || 1;
  } else {
    placeKeyRandomly();
  }
  applyEquipment(p);   // normalize atk/HP from any equipped gear (safe if none)
  descend(startDepth);
}

// Pick a random floor (1-6, an early/mid band so it's findable across a
// typical run length) and a random spawn-like spot in it for the golden
// key. Re-rolled whenever the key needs to relocate (run start, or after
// the player dies before ever picking it up).
function placeKeyRandomly(depth){
  const d = depth || (1 + (Math.random()*6|0));
  G.key.depth = d;
  G.key._pendingPlacement = true; // resolved into x/y once that floor's dungeon exists
}

function ensureFloor(depth){
  if(G.floors[depth]){
    resolvePendingKeyPlacement(depth, G.floors[depth].dun);
    return G.floors[depth];
  }
  const d = makeDungeon(depth);
  const floor = { dun:d, enemies:[], decor:[], cleared:false, bossAlive:false, visited:false };
  const isBoss = depth%5===0;
  if(isBoss){
    const e=new Enemy(BOSS_ARCH, d.stairsPx.x, d.stairsPx.y-60, depth, true);
    floor.enemies.push(e); floor.bossAlive=true;
  } else {
    const ELITE_ARCHS = [ORC_SHAMAN_ARCH, SKEL_MAGE_ARCH, SKEL_WARRIOR_ARCH];
    const eliteChance=Math.min(0.30, 0.12 + depth*0.015);
    let eliteCount=0;
    for(const s of d.spawns){
      const elite = (eliteCount<2) && Math.random()<eliteChance;
      if(elite){
        eliteCount++;
        const arch = ELITE_ARCHS[(Math.random()*ELITE_ARCHS.length)|0];
        floor.enemies.push(new Enemy(arch, s.x, s.y, depth, false, true));
      } else {
        const arch=ARCHETYPES[(Math.random()*Math.min(ARCHETYPES.length, 1+depth))|0]||ARCHETYPES[0];
        floor.enemies.push(new Enemy(arch, s.x, s.y, depth, false, false));
      }
    }
  }
  spawnDecorInto(floor, d);
  resolvePendingKeyPlacement(depth, d);
  G.floors[depth] = floor;
  return floor;
}

// Resolve the golden key's world position once a floor's room layout
// exists, if this is the floor it's currently assigned to and it hasn't
// been placed yet (covers both a brand-new floor and a key that relocated
// onto a floor that was already cached from an earlier visit).
function resolvePendingKeyPlacement(depth, d){
  if(!(G.key.depth===depth && G.key._pendingPlacement && !G.key.taken)) return;
  const room = d.rooms[1 + (Math.random()*Math.max(0,d.rooms.length-2)|0)] || d.rooms[0];
  const pt = safePointInRoom(d, room) || { x:(room.cx+0.5)*TILE, y:(room.cy+0.5)*TILE };
  G.key.x = pt.x;
  G.key.y = pt.y;
  G.key._pendingPlacement = false;
}

function safePointInRoom(d, room, avoid){
  if(!d || !room) return null;
  const tiles=[];
  const yFrom = room.shape==='cells' ? room.y+3 : room.y;
  for(let ty=yFrom; ty<room.y+room.h; ty++) for(let tx=room.x; tx<room.x+room.w; tx++){
    if(tx<0||ty<0||tx>=d.W||ty>=d.H) continue;
    if(d.grid[ty][tx]===0) continue;
    const px=(tx+0.5)*TILE, py=(ty+0.5)*TILE;
    if(avoid && Math.hypot(px-avoid.x,py-avoid.y)<TILE*1.2) continue;
    tiles.push({x:px,y:py});
  }
  if(!tiles.length) return null;
  return tiles[(Math.random()*tiles.length)|0];
}

function placePlayerOnFloor(floor, firstVisit){
  const d=floor.dun;
  let pt;
  if(firstVisit){
    pt = {x:d.startPx.x, y:d.startPx.y};
  } else {
    const liftRoom = d.roomAt((d.stairsPx.x/TILE)|0, (d.stairsPx.y/TILE)|0);
    pt = safePointInRoom(d, liftRoom, d.stairsPx) || {x:d.stairsPx.x, y:d.stairsPx.y-TILE*0.6};
  }
  if(d.isWall(pt.x, pt.y)){
    const r = d.rooms.find(room => room.visited) || d.rooms[0];
    pt = safePointInRoom(d, r) || d.startPx;
  }
  G.player.x=pt.x; G.player.y=pt.y;
}

function isFloorClearForAdvance(depth){
  const f = G.floors[depth];
  if(!f) return false;
  // "Clear" = every mummy (regular or elite) AND any boss on the floor is dead.
  return f.enemies.every(e => e.dead || !(e.arch.isUndead || e.isBoss));
}

function descend(toDepth){
  const target = toDepth!==undefined ? toDepth : G.depth+1;
  // snapshot current floor's live state back into the cache before leaving
  if(G.dun && G.floors[G.depth]){
    const cur = G.floors[G.depth];
    cur.enemies = G.enemies; cur.decor = G.decor; cur.bossAlive = G.bossAlive;
    cur.visited = true;
  }
  G.depth = target;
  G.maxDepthReached = Math.max(G.maxDepthReached, target);
  const floor = ensureFloor(target);
  G.dun = floor.dun; G.enemies = floor.enemies; G.decor = floor.decor;
  G.bossAlive = floor.bossAlive;
  G.particles=[]; G.dmgNums=[]; G.projectiles=[];
  // Pull the current act's color theme so drawTiles/drawWallFaces render
  // with the right palette for this leg of the campaign.
  const act = CAMPAIGN[campaignActIndex];
  G.dungeonTheme = DUNGEON_THEMES[(act && act.dungeonTheme) || 'bluestone'];
  // Only drop the player at the entrance the FIRST time a floor is visited;
  // revisiting (lift travel) places them at the lift landing instead so
  // backtracking doesn't feel like restarting the floor from its far entrance.
  const firstVisit = !floor.visited;
  placePlayerOnFloor(floor, firstVisit);
  if(!firstVisit){
    // Landing spot is near the lift, so avoid reopening the menu immediately
    // after changing floors. Walking away and back will still trigger it.
    G._liftPrompted = true;
  }
  resetInput();
  floor.visited = true;
  G.player.depth=G.depth;
  G.bgIndex=(G.depth-1)%backgrounds.length;
  G.action.mode=null; G.action.target=null;
  setActionButton(null);
  const isBoss = G.depth%5===0;
  showBanner(`FLOOR ${G.depth}`, isBoss?'⚠ GUARDED':backgrounds[G.bgIndex].split('/').pop().replace('.png','').toUpperCase());
  if(isBoss && floor.bossAlive){
    cutscene(Story.bossIntro);
  } else {
    log(Story.floorLine(G.depth),'dm');
  }
  A.descend();
}

function spawnDecorInto(floor, d){
  // NOTE: 'monitor' used to be listed here but was never defined in
  // DECOR_TYPES (props.js) — picking it threw "Cannot read properties of
  // undefined (reading 'hp')" inside `new Decor()`, which aborted
  // ensureFloor() -> descend() partway through, before G.dun was ever
  // assigned. That left G.dun permanently null and crashed every
  // subsequent frame in checkRoomDiscovery(), freezing the screen right
  // after the bunker-entry transition. Replaced with real DECOR_TYPES
  // entries ('urn'/'bones') that also fit the ancient-ruin theme better
  // than a sci-fi monitor ever did.
  const common=['vase','pot','barrel','crate','cabinet_s','cabinet_s','urn','bones'];
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
        // Bottom-wall ('up'-facing) placement intentionally disabled — decor
        // (wardrobes, pots, urns, etc.) should only ever hug the N/W/E walls,
        // never the S wall, per design direction.
        if(wU && !wD){ facing='down';  ox=0.5;  oy=0.66; }   // against top wall
        else if(wL && !wR){ facing='right'; ox=0.33; oy=0.92; } // against left wall
        else if(wR && !wL){ facing='left';  ox=0.67; oy=0.92; } // against right wall
        if(!facing) continue;
        const px=(tx+ox)*TILE, py=(ty+oy)*TILE;
        if(Math.hypot(px-d.startPx.x,py-d.startPx.y)<TILE*1.8) continue;
        if(Math.hypot(px-d.stairsPx.x,py-d.stairsPx.y)<TILE*1.8) continue;
        let nearDoor=false;
        for(const door of r.doors){
          if(Math.hypot(px-(door.x+0.5)*TILE, py-(door.y+0.5)*TILE) < TILE*1.4){ nearDoor=true; break; }
        }
        if(nearDoor) continue;
        cand.push({px,py,facing});
      }
    }
    if(!cand.length) continue;
    // shuffle candidates
    for(let i=cand.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=cand[i]; cand[i]=cand[j]; cand[j]=t; }
    const area=r.w*r.h;
    const n=Math.min(cand.length, Math.min(3, Math.max(1, Math.round(area/20))));
    let placed=0;
    for(const c of cand){
      if(placed>=n) break;
      if(floor.decor.some(o=>Math.hypot(o.x-c.px,o.y-c.py)<TILE*1.3)) continue;
      const t = Math.random()<0.12 ? rare[Math.random()<0.5?0:1]
                                   : common[Math.floor(Math.random()*common.length)];
      floor.decor.push(new Decor(t,c.px,c.py,c.facing));
      placed++;
    }
  }
}

function applyLoot(kind,amt,x,y){
  const p=G.player;
  if(kind==='hp'){
    if(p.hp>=p.maxHp){
      // Full HP — don't waste the drop, convert it to XP instead.
      const ups=p.gainXp(amt); lootText(x,y,'+'+amt+' XP (HP full)','#4ad7ff');
      if(ups>0){ A.levelup(); log('◆ LEVEL UP → '+p.level,'reward'); spark(p.x,p.y-20,'#00ff88',24,200); }
    } else {
      p.hp=Math.min(p.maxHp,p.hp+amt); lootText(x,y,'+'+amt+' HP','#3dff88');
    }
  }
  else if(kind==='xp'){ const ups=p.gainXp(amt); lootText(x,y,'+'+amt+' XP','#4ad7ff');
    if(ups>0){ A.levelup(); log('◆ LEVEL UP → '+p.level,'reward'); spark(p.x,p.y-20,'#00ff88',24,200); } }
  else if(kind==='celo'){ p.celo+=amt; lootText(x,y,'+'+amt.toFixed(2)+' USDm','#ffd166'); }
  else if(kind==='relic'){
    G.inventory.relics = (G.inventory.relics||0) + amt;
    applyRelicPower(amt, x, y);
  }
  A.pickup(); updateHUD();
}
// Add a rolled NS_ITEMS item (with a quantity) straight into the player's
// stash — used by combat/decor loot rolls that draw an 'item' kind directly
// (not via a container window). Stacks per item id, capped at the item's
// rarity stackCap.
function addItemToStash(item, qty){
  if(!item) return;
  const inv=G.inventory.items;
  const cur=inv[item.id] || { item, qty:0 };
  cur.qty = Math.min(item.stackCap||99, cur.qty + (qty||1));
  inv[item.id] = cur;
}
function applyRelicPower(amt,x,y){
  const p=G.player;
  const roll=(G.inventory.relics + G.depth + p.level) % 4;
  if(roll===0){ p.atkDmg += 2*amt; lootText(x,y,'RELIC: +DMG','#ffdf8a'); }
  else if(roll===1){ p.maxHp += 6*amt; p.hp=Math.min(p.maxHp,p.hp+12*amt); lootText(x,y,'RELIC: +VITALITY','#7fffce'); }
  else if(roll===2){ p.speed += 2.5*amt; lootText(x,y,'RELIC: +SPEED','#8ad8ff'); }
  else { G.inventory.shards=(G.inventory.shards||0)+amt; p.celo+=0.01*amt; lootText(x,y,'RELIC: +NULL SHARD','#d88cff'); }
  spark(p.x,p.y-18,'#d88cff',24,180);
  log('◆ Relic absorbed — your Walker mutates.', 'reward');
}
function lootText(x,y,txt,color){ G.dmgNums.push({x,y,val:txt,life:1.2,crit:false,vy:-38,color}); }

// ---------- Unified action button (NULL_STRIKE + container OPEN) ----------
// Replaces the old blocking ULTI popup. A single non-blocking button
// (#actionBtn) sits near the attack button; its mode/label/visibility is
// driven every frame by updateActionButton() from the position of the
// nearest boss / nearest openable container.
function applyUltiDamage(t){
  const dmg=Math.max(1, Math.ceil(t.hp*0.92));
  t.hp=Math.max(1, t.hp-dmg);          // leave foe near death
  t.hitFlash=0.25;
  dmgNum(t.x,t.y-t.r,dmg,true);
  spark(t.x,t.y-10,'#ffae00',46,320);
  G.shake=13; G.ultiFlash=0.55; A.ultiBlast();
}
// A room is "clear" once every enemy that spawned in it is dead (mirrors
// isFloorClearForAdvance, but scoped to a single room so a container in an
// already-cleared room stays openable even mid-floor).
function isRoomClear(room){
  if(!room || !G.dun) return true;
  return G.enemies.every(e => e.dead || (G.dun.roomAt((e.x/TILE)|0,(e.y/TILE)|0) !== room));
}
function setActionButton(mode, label){
  const btn=$('actionBtn'); if(!btn) return;
  if(!mode){ btn.classList.add('hidden'); btn.disabled=false; btn.classList.remove('loading'); return; }
  btn.classList.remove('hidden');
  btn.dataset.mode=mode;
  btn.textContent = label || (mode==='ulti' ? '⚡ NULL_STRIKE' : '▤ OPEN');
}
function updateActionButton(nearest, nd){
  const a=G.action;
  if(G.paused || G.over || a.cd>0){ setActionButton(null); return; }
  // Priority 1: a live boss within striking range -> NULL_STRIKE.
  if(nearest && !nearest.dead && nearest.isBoss && nd<180){
    a.mode='ulti'; a.target=nearest;
    setActionButton('ulti', '⚡ NULL_STRIKE');
    return;
  }
  // Priority 2: nearest unopened container, but only once its room is clear.
  const p=G.player;
  let nearestDecor=null, nnd=1e9;
  for(const o of G.decor){
    if(!o.interactive || o.opened) continue;
    const dist=Math.hypot(o.x-p.x, (o.y-o.h*0.35)-p.y);
    if(dist<nnd){ nnd=dist; nearestDecor=o; }
  }
  if(nearestDecor && nnd<TILE*1.1){
    const room=G.dun.roomAt((p.x/TILE)|0,(p.y/TILE)|0);
    if(isRoomClear(room)){
      a.mode='open'; a.target=nearestDecor;
      setActionButton('open', '▤ OPEN');
      return;
    }
  }
  a.mode=null; a.target=null;
  setActionButton(null);
}
function onActionBtnClick(){
  const a=G.action; if(!a || !a.mode) return;
  if(a.mode==='ulti') onUltiButtonTap();
  else if(a.mode==='open') onOpenButtonTap();
}
// NULL_STRIKE: apply the damage instantly (so it feels responsive), then
// send the 0.005 USDm fee on-chain in the background via CHAIN.ultiTx (bridged
// to walletRef.payUsdmFee in DungeonGame.tsx). The button shows a brief
// loading state either way — the strike itself never waits on the tx.
async function onUltiButtonTap(){
  const t=G.action.target; if(!t || t.dead) return;
  const btn=$('actionBtn');
  applyUltiDamage(t);
  log('⚡ NULL_STRIKE landed — '+(t.name||'foe')+' reels, near death.', 'reward');
  if(btn){ btn.disabled=true; btn.classList.add('loading'); btn.textContent='…'; }
  G.action.cd=1.5;
  CHAIN.ultiTx({ damage: Math.ceil(t.hp*0.92), xp: t.xp, killed:false, onStatus:()=>{} })
    .then(res=>{
      if(res && !res.demo) log('✓ NULL_STRIKE fee confirmed on-chain.','dm');
    })
    .catch(()=>{ /* fee tx failed — the strike itself already landed, so just log it */
      log('⚠ NULL_STRIKE fee tx failed — strike still landed.', 'dm');
    });
  setTimeout(()=>{
    if(btn){ btn.disabled=false; btn.classList.remove('loading'); }
  }, 450);
}
function onOpenButtonTap(){
  const target=G.action.target; if(!target || target.opened) return;
  const btn=$('actionBtn');
  if(btn){ btn.disabled=true; btn.classList.add('loading'); btn.textContent='…'; }
  setTimeout(()=>{
    if(!target.open()){ if(btn){ btn.disabled=false; btn.classList.remove('loading'); } return; }
    A.breakProp();
    spark(target.x, target.y-target.h*0.45, '#ffd166', 22, 180);
    log(target.def.label+' opened.', 'dm');
    if(btn){ btn.disabled=false; btn.classList.remove('loading'); }
    G.action.mode=null; G.action.target=null; setActionButton(null);
    openContainerWindow(target);
  }, 450);
}

function tryInteract(){
  if(!G||G.over) return;
  const d=G.dun, p=G.player;
  // Lift interaction (stairs)
  const dx=p.x-d.stairsPx.x, dy=p.y-d.stairsPx.y;
  if(Math.hypot(dx,dy)<TILE*0.9){
    openLiftMenu();
    return;
  }
  // 'E' interact mirrors the OPEN action button for containers already in
  // range (same 450ms open + dual-panel flow), so there are two equivalent
  // ways to open a container: tap the button, or walk up and press E.
  if(G.action.mode==='open' && G.action.target) onOpenButtonTap();
}

// ---- shared grid helpers ----
// All three item grids (#invItems, #containerItems/LOOT, #containerPlayerItems/
// YOUR INVENTORY) are laid out as a fixed 5-column CSS grid (see .inv-items /
// .container-items in globals.css). Padding every grid out to a fixed slot
// count with empty placeholder cells — instead of only rendering rows for
// populated slots — keeps the grid shape constant no matter how many items
// it holds.
// The container window (LOOT + YOUR INVENTORY, opened from a breakable/
// chest prop) is a centered modal with limited vertical room, so it's
// padded to 5x3 (15 slots) — a full 5x5 (25) made the modal taller than the
// viewport and forced the whole page to scroll just to reach TAKE ALL/close.
// The standalone inventory panel (#invItems, opened via the top-right inv
// button) has its own internal scroll area sized for the full screen, so it
// keeps the larger 5x5 (25) grid.
const GRID_SLOT_COUNT = 25;
const CONTAINER_GRID_SLOT_COUNT = 15;
function fillGridPlaceholders(host, count){
  for(let i=0;i<count;i++){
    const cell=document.createElement('div');
    cell.className='inv-item inv-item-empty';
    host.appendChild(cell);
  }
}

// ---- container loot window (dual-panel: container slots + player stash) ----
function openContainerWindow(decor){
  const win=$('containerWindow'); if(!win) return;
  G._openContainer = decor;
  G.paused = true;
  const title=$('containerTitle'); if(title) title.textContent=(decor.def.label||'CONTAINER').toUpperCase();
  renderContainerSlots();
  renderStashPanel('containerPlayerItems','containerPlayerEmpty',{readonly:true, gridSlots:CONTAINER_GRID_SLOT_COUNT});
  win.classList.remove('hidden');
}
// Non-item loot kinds that DO have a real sprite/icon representation (same
// files used by renderStashPanel's addRow() for the persistent counters).
// hp/xp/celo are instant stat pickups with no persistent icon, so those
// stay text-only — only 'relic' gets an image here.
const CONTAINER_LOOT_ICONS = { relic:'/sprites/items/relic.png' };

function renderContainerSlots(){
  const decor=G._openContainer; if(!decor) return;
  const host=$('containerItems'), empty=$('containerEmpty');
  if(!host) return;
  host.innerHTML='';
  const slots=(decor.lootSlots||[]).filter(s=>!s.taken);
  // As with renderStashPanel(), the grid itself (now always padded to a
  // fixed 5x3) visually communicates "nothing here" via empty placeholder
  // cells, so the old "Empty." text is kept hidden rather than shown
  // alongside/instead of the grid.
  if(empty) empty.style.display='none';
  if(!slots.length){ fillGridPlaceholders(host,CONTAINER_GRID_SLOT_COUNT); return; }
  for(const s of slots){
    const row=document.createElement('div');
    row.className='inv-item container-slot';
    row.dataset.slot=s.slotId;
    if(s.kind==='item'){
      const it=s.item;
      row.style.borderColor=it.color;
      row.innerHTML=`<img class="inv-item-icon" src="${it.icon}" alt="${it.name}" draggable="false">`+
        `<span class="inv-item-name" style="color:${it.color}">${it.name}</span>`+
        `<span class="inv-item-count">×${s.qty}</span>`+
        `<span class="inv-item-value">${it.burnValue.toFixed(3)} USDm</span>`;
    } else {
      const labelMap={hp:'HP',xp:'XP',celo:'USDm',relic:'RELIC'};
      const iconSrc=CONTAINER_LOOT_ICONS[s.kind];
      row.innerHTML=(iconSrc?`<img class="inv-item-icon" src="${iconSrc}" alt="${labelMap[s.kind]||s.kind}" draggable="false">`:'')+
        `<span class="inv-item-name">+${s.amt}${typeof s.amt==='number'&&s.amt<1?'':''} ${labelMap[s.kind]||s.kind.toUpperCase()}</span>`;
    }
    // Item slots open the zoom overlay (TAKE button) for a deliberate,
    // one-at-a-time confirmation. Non-item loot (hp/xp/celo/relic) has no
    // icon/name to zoom on, so those keep the old instant-take behavior.
    if(s.kind==='item'){
      row.addEventListener('click', ()=>openItemZoom({mode:'container-loot', slotId:s.slotId, item:s.item, qty:s.qty}));
    } else {
      row.addEventListener('click', ()=>takeContainerSlot(s.slotId));
    }
    host.appendChild(row);
  }
  fillGridPlaceholders(host,Math.max(0,CONTAINER_GRID_SLOT_COUNT-slots.length));
}
function takeContainerSlot(slotId){
  const decor=G._openContainer; if(!decor) return;
  const slot=(decor.lootSlots||[]).find(s=>s.slotId===slotId && !s.taken);
  if(!slot) return;
  slot.taken=true;
  if(slot.kind==='item') addItemToStash(slot.item, slot.qty);
  else applyLoot(slot.kind, slot.amt, decor.x, decor.y-decor.h*0.8);
  A.pickup();
  renderContainerSlots();
  renderStashPanel('containerPlayerItems','containerPlayerEmpty',{readonly:true, gridSlots:CONTAINER_GRID_SLOT_COUNT});
  updateInventoryPanel();
}
function takeAllContainerSlots(){
  const decor=G._openContainer; if(!decor) return;
  for(const s of (decor.lootSlots||[])){ if(!s.taken) takeContainerSlot(s.slotId); }
}
function closeContainerWindow(){
  const win=$('containerWindow'); if(win) win.classList.add('hidden');
  G._openContainer=null;
  G.paused=false;
}

// ---- lift menu ----
function openLiftMenu(){
  if(!G||G.over||G.paused) return;
  resetInput();
  G.paused = true;
  const opts = [];
  for(let f=1; f<=G.maxDepthReached; f++) opts.push({ floor:f, locked:false });
  const nextFloor = G.depth+1;
  if(nextFloor<=5 && !opts.find(o=>o.floor===nextFloor)){
    opts.push({ floor:nextFloor, locked: !isFloorClearForAdvance(G.depth) });
  }
  opts.sort((a,b)=>a.floor-b.floor);
  renderLiftMenu(opts);
  $('liftMenu').classList.remove('hidden');
}
function renderLiftMenu(opts){
  const host = $('liftFloorList'); if(!host) return;
  host.innerHTML = '';
  for(const o of opts){
    const btn = document.createElement('button');
    btn.className = 'big-btn lift-floor-btn' + (o.floor===G.depth ? ' current' : '') + (o.locked ? ' locked' : '');
    btn.disabled = o.locked;
    btn.textContent = o.locked ? `FLOOR ${o.floor} 🔒` : (o.floor===G.depth ? `FLOOR ${o.floor} (here)` : `FLOOR ${o.floor}`);
    if(!o.locked && o.floor!==G.depth){
      btn.addEventListener('click', () => { closeLiftMenu(); travelToFloor(o.floor); });
    }
    host.appendChild(btn);
  }
}
function closeLiftMenu(){
  $('liftMenu').classList.add('hidden');
  // Do NOT unpause here — if the player chose a floor, travelToFloor()
  // keeps the game paused through the entire dark-transition + descend()
  // sequence and only unpauses once the new floor is fully loaded and
  // visible again. Only unpause immediately for an outright cancel (no
  // floor travel happening at all).
}
function onLiftCancel(){
  $('liftMenu').classList.add('hidden');
  G.paused = false;
}
function travelToFloor(depth){
  if(!G) return;
  // Ignore a floor-change request while a transition is already running —
  // see the guard note in showLoadingTransition() for why this matters on
  // touch devices.
  if(_fadeActive) return;
  resetInput();
  G.paused = true;
  // Stay paused for the whole transition so the update loop can't keep
  // simulating the OLD floor while the screen fades — see closeLiftMenu().
  showLoadingTransition(() => descend(depth), () => { resetInput(); G.paused = false; });
}
// Dark loading transition: fade to black, swap floor data underneath while
// hidden, then fade back in — used for every lift trip so the cached-floor
// swap never happens visibly mid-frame. onDark runs once the screen is
// fully black (safe to swap state); onDone runs once it's fully faded back
// in (safe to resume simulation/input).
//
// Two failure modes used to leave the player stuck staring at a fully
// black screen after changing floors:
//   1) Overlapping calls — on touch devices a single tap can fire both a
//      real 'click' and a synthetic/ghost one, so this could be invoked
//      twice in quick succession. The two calls shared the same element's
//      opacity/timeout state, and once their setTimeout chains interleaved
//      it was possible for the LAST thing to run to be an early step of
//      one chain (opacity back to '1', not yet hidden) with no further
//      timer left pending to ever fade it back — a permanent black screen.
//   2) An exception thrown inside onDark() (the floor-swap callback) would
//      abort the setTimeout callback before it reached the fade-back-in
//      step, again leaving the overlay fully opaque forever.
// Both are fixed below: a single in-flight guard prevents overlap, all
// pending timers are tracked and torn down before a new transition starts,
// and onDark() runs inside try/catch so the fade ALWAYS continues back in
// even if the floor swap itself throws.
let _fadeActive = false;
let _fadeTimers = [];
function _clearFadeTimers(){ _fadeTimers.forEach(id=>clearTimeout(id)); _fadeTimers=[]; }
function showLoadingTransition(onDark, onDone, loadingText){
  const el = $('loadingFade');
  const textEl = $('loadingFadeText');
  if(!el){ try{ onDark(); } finally { if(onDone) onDone(); } return; }

  // If a previous transition is still mid-flight, cancel its pending timers
  // and start clean rather than letting the two interleave.
  if(_fadeActive) _clearFadeTimers();
  _fadeActive = true;

  if(textEl){ textEl.textContent = loadingText||''; textEl.classList.remove('show'); }
  el.classList.remove('hidden');
  el.style.opacity = '0';
  requestAnimationFrame(()=>{
    el.style.opacity = '1';
    const t1 = setTimeout(()=>{
      try{
        onDark();
      } catch(err){
        console.error('showLoadingTransition: onDark failed, fading back in anyway', err);
      }
      if(textEl && loadingText) textEl.classList.add('show');
      const t2 = setTimeout(()=>{
        if(textEl) textEl.classList.remove('show');
        el.style.opacity = '0';
        const t3 = setTimeout(()=>{
          el.classList.add('hidden');
          _fadeActive = false;
          if(onDone) onDone();
        }, 420);
        _fadeTimers.push(t3);
      }, loadingText ? 1400 : 260);
      _fadeTimers.push(t2);
    }, 420);
    _fadeTimers.push(t1);
  });
}

// ---- particles & numbers ----
function spark(x,y,color,n=8,spd=120){
  for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2, s=spd*(0.4+Math.random());
    G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0.4+Math.random()*0.3,
      max:0.7,color,r:2+Math.random()*2});}
}
function dmgNum(x,y,val,crit=false){ G.dmgNums.push({x,y,val,life:0.9,crit,vy:-46}); }
function hitSpark(x,y,color){
  G.particles.push({x,y,vx:0,vy:0,life:0.16,max:0.16,color:'rgba(255,255,255,.9)',r:10});
  spark(x,y,color||'#fff',8,210);
}
function roomTitle(room){
  if(!room) return 'FORSAKEN PASSAGE';
  if(room.vibe==='prison') return 'BROKEN CELL BLOCK';
  if(room.vibe==='cave') return 'NULL GROTTO';
  if(room.vibe==='crypt') return 'CRYPT CHAMBER';
  if(room.vibe==='moss') return 'MOSS-CHOKED VAULT';
  if(room.vibe==='earth') return 'EARTHEN RUIN';
  return 'STONE BUNKER ROOM';
}
function checkRoomDiscovery(){
  const d=G.dun, p=G.player;
  const room=d.roomAt((p.x/TILE)|0,(p.y/TILE)|0);
  const id=room ? `${G.depth}:${room.id}` : `corridor:${G.depth}:${(p.x/TILE)|0}:${(p.y/TILE)|0}`;
  if(room && G.lastRoomId!==id){
    G.lastRoomId=id;
    if(!G.discoveredRooms.has(id)){
      G.discoveredRooms.add(id);
      showBanner(roomTitle(room), 'NEW AREA DISCOVERED');
      spark(p.x,p.y-20,'#00ff88',12,90);
    }
  }
}
function checkFloorClearReward(){
  if(G.floorClearShown[G.depth]) return;
  if(!isFloorClearForAdvance(G.depth)) return;
  G.floorClearShown[G.depth]=true;
  G.player.hp=Math.min(G.player.maxHp, G.player.hp+18);
  G.player.celo+=0.01;
  showBanner('FLOOR SECURED', 'LIFT UNLOCKED · +0.01 USDm');
  spark(G.player.x,G.player.y-18,'#00ff88',36,240);
  updateHUD();
}

// Shared "damage + FX" application for a single enemy hit — used by melee
// swings (hitTest() below) AND ranged projectiles (updateProjectiles()), so
// hit-stop/particles/knockback/shake always feel consistent no matter which
// weapon behavior dealt the hit. fromX/fromY is the point knockback should
// push away from (player position for melee, arrow position for ranged).
function applyHitToEnemy(e, dmg, fromX, fromY, beh){
  const killed=e.hurt(dmg);
  dmgNum(e.x,e.y-e.r, dmg);
  const _fx = window.NS_FX;
  const _kbCfg = (window.NS_MONSTER_CONFIG||{}).knockback || {base:{x:220,y:145}};
  const _shakeCfg = (window.NS_MONSTER_CONFIG||{}).shake || {playerAttack:6};
  const _partCfg = (window.NS_MONSTER_CONFIG||{}).particles || {lightHit:10,heavyHit:14};
  if (_fx) {
    _fx.triggerHitStopForDmg(dmg, e.isBoss);
    const pcount = dmg > 20 ? _partCfg.heavyHit : _partCfg.lightHit;
    _fx.particleBurst(G.particles, e.x, e.y-8, e.arch.color, pcount, 170);
  } else {
    spark(e.x,e.y-8,e.arch.color,10,160);
  }
  const kx=Math.sign(e.x-fromX)||1, ky=Math.sign(e.y-fromY);
  const _kbBase = beh==='knockback' ? (_kbCfg.knockback||{x:420,y:270}) :
                   beh==='aoe'       ? (_kbCfg.aoe||{x:320,y:210}) :
                                       (_kbCfg.base||{x:220,y:145});
  e.kb.x = kx * _kbBase.x * (e.isBoss ? 0.45 : 1);
  e.kb.y = ky * _kbBase.y * (e.isBoss ? 0.45 : 1);
  hitSpark(e.x,e.y-e.r*0.55,e.arch.color);
  const _shakeAmt = e.isBoss ? (_shakeCfg.bossHit||18) : (_shakeCfg.playerAttack||6);
  G.shake=Math.min(G.shake+_shakeAmt,20); A.hit();
  if(killed){ onEnemyKilled(e); }
  return killed;
}

// ---- ranged projectiles (Hunter's Bow) ----
// Lightweight arrow: travels in a straight line from where it was fired,
// deals damage to the first enemy it touches, then despawns. Drawn with
// canvas primitives only (no new sprite assets) — a thin rotated shaft plus
// a small pixel arrowhead, matching the chunky pixel-art FX language used
// elsewhere (pixelArc() in entities.js).
function spawnProjectile(owner, dmg){
  const mv = (owner._lastMove && (Math.abs(owner._lastMove.x)+Math.abs(owner._lastMove.y)>0.1))
    ? owner._lastMove : { x: owner.facing, y: 0 };
  const m = Math.hypot(mv.x,mv.y)||1;
  const dx=mv.x/m, dy=mv.y/m;
  const speed=640, startDist=28;
  G.projectiles.push({
    x: owner.x+dx*startDist, y: owner.y-8+dy*startDist,
    vx: dx*speed, vy: dy*speed,
    dmg, r:7, traveled:0, maxRange:560, dead:false,
  });
}
function updateProjectiles(dt){
  if(!G.projectiles.length) return;
  for(const pr of G.projectiles){
    if(pr.dead) continue;
    const stepX=pr.vx*dt, stepY=pr.vy*dt;
    const nx=pr.x+stepX, ny=pr.y+stepY;
    if(G.dun.isWall(nx,ny)){ pr.dead=true; spark(pr.x,pr.y,'#eafff5',5,90); continue; }
    pr.x=nx; pr.y=ny; pr.traveled+=Math.hypot(stepX,stepY);
    if(pr.traveled>=pr.maxRange){ pr.dead=true; continue; }
    for(const e of G.enemies){
      if(e.dead) continue;
      if(Math.hypot(e.x-pr.x,e.y-pr.y) < pr.r+e.r){
        applyHitToEnemy(e, pr.dmg, pr.x, pr.y, 'ranged');
        pr.dead=true;
        break;
      }
    }
  }
  G.projectiles = G.projectiles.filter(pr=>!pr.dead);
}
function drawProjectiles(ctx){
  for(const pr of G.projectiles){
    const ang=Math.atan2(pr.vy,pr.vx);
    ctx.save();
    ctx.translate(pr.x,pr.y); ctx.rotate(ang);
    ctx.fillStyle='#c98a4a';
    ctx.fillRect(-12,-1.5,20,3);           // shaft
    ctx.fillStyle='#eafff5';
    ctx.beginPath();                       // arrowhead
    ctx.moveTo(10,0); ctx.lineTo(3,-4); ctx.lineTo(3,4); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#8a6a3a';
    ctx.fillRect(-14,-3,3,2); ctx.fillRect(-14,1,3,2); // fletching
    ctx.restore();
  }
}

// ---- combat resolution ----
function hitTest(){
  const p=G.player;
  const z=p.hitZone();
  if(z){
    A.attack();
    // Equipped-weapon behavior modifiers (Marketplace items). z.dmg already
    // includes the weapon's flat atkBonus via applyEquipment(); these tune the
    // *feel*: bigger reach (aoe), heavier knockback, and extra rapid hits
    // (double/triple slash).
    const beh = p._weaponBehavior || null;
    if(beh==='ranged'){
      // Hunter's Bow: fire an arrow instead of a melee hitbox. This fully
      // REPLACES the melee swing for this weapon — no phantom melee hit
      // alongside the arrow, and no decor-smashing melee sweep either.
      spawnProjectile(p, z.dmg+(Math.random()*6|0));
    } else {
      let any=false;
      const radiusMul = beh==='aoe' ? 1.8 : (beh==='knockback' ? 1.15 : 1);
      const extraHits = beh==='triple_slash' ? 2 : (beh==='double_hit' ? 1 : 0);
      const reach = z.r * radiusMul;
      for(const e of G.enemies){
        if(e.dead) continue;
        if(Math.hypot(e.x-z.x,e.y-z.y) < reach+e.r){
          const dmg=z.dmg+(Math.random()*6|0);
          let killed=applyHitToEnemy(e, dmg, p.x, p.y, beh);
          for(let h=0; h<extraHits && !killed; h++){
            const d2=Math.max(1,Math.round(dmg*0.7));
            killed=applyHitToEnemy(e, d2, p.x, p.y, beh);
            dmgNum(e.x+8*(h+1), e.y-e.r-8*(h+1), d2);
          }
          // Frost Spear: apply/refresh a temporary slow debuff on hit.
          // Enemy.update() (entities.js) reads _slowMul/_slowT and ticks the
          // timer down; refreshing on repeated hits is fine, but the
          // multiplier itself does not stack multiplicatively — it's just
          // reapplied at the same strength each hit.
          if(beh==='slow' && !e.dead){
            const M = window.NS_MARKET;
            const w = (M && G.equipment.equipped.mainhand) ? M.getEquipment(G.equipment.equipped.mainhand) : null;
            const slowPct = (w && w.effect && w.effect.slowPct) || 0.5;
            e._slowMul = 1 - slowPct;
            e._slowT = 3.0;
          }
          any=true;
        }
      }
      if(any===false){ /* swing missed enemies */ }
      // breakable decorations caught in the same swing (skip interactive containers)
      for(const o of G.decor){
        if(o.broken || o.interactive) continue;
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
  A.enemyDeath();
  // Enhanced death effects (Phase 5)
  const _fxK = window.NS_FX;
  const _shakeCfgK = (window.NS_MONSTER_CONFIG||{}).shake || {};
  const _partCfgK  = (window.NS_MONSTER_CONFIG||{}).particles || {};
  if (_fxK) {
    const count = e.isBoss ? (_partCfgK.bossKill||60) : (_partCfgK.death||28);
    _fxK.particleBurst(G.particles, e.x, e.y-10, e.arch.color, count, 220);
    _fxK.particleShower(G.particles, e.x, e.y-10, '#fffbe0', Math.floor(count*0.4), 150);
  } else {
    spark(e.x,e.y-10,e.arch.color,22,200);
  }
  const _shakeK = e.isBoss ? (_shakeCfgK.bossKill||28) : (_shakeCfgK.enemyDeath||8);
  G.shake=Math.min(G.shake+_shakeK,24);
  const p=G.player;
  p.kills++;
  const reward=(0.01 + (e.isBoss?0.2:0.01)).toFixed(2);
  p.celo+=parseFloat(reward);
  const ups=p.gainXp(e.xp);
  log(`${e.arch.name} purged. +${e.xp} XP · +${reward} USDm`, 'reward');
  if(ups>0){ A.levelup(); log(`◆ LEVEL UP → ${p.level}. Max HP & power increased.`,'reward');
    spark(p.x,p.y-20,'#00ff88',30,220); applyEquipment(p); }
  G.combo.count = (G.combo.t>0 ? G.combo.count+1 : 1);
  G.combo.t = 3.2;
  if(G.combo.count>=3){
    const bonus=Math.min(25, G.combo.count*3);
    const up2=p.gainXp(bonus);
    lootText(p.x,p.y-36,`COMBO x${G.combo.count} +${bonus} XP`,'#ffd166');
    if(up2>0) A.levelup();
  }
  if(e.elite && Math.random()<0.65) applyLoot('relic',1,e.x,e.y-e.r);
  updateHUD();
  checkFloorClearReward();
  if(e.isBoss){
    G.bossAlive=false;
    if(G.depth>=5){
      setTimeout(()=>onActBunkerCleared(),700);
    } else {
      setTimeout(()=>cutscene(Story.bossDown),700);
    }
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

// ---- nameplates (elite/boss labels) ----
// Drawn in screen-space AFTER the zoom/camera transform is popped, and
// clamped to stay inside the canvas, so they never clip off the edge on
// narrow phone viewports (the old code drew them in world-space, which
// clipped at the screen edge whenever an elite stood near the camera bound).
let _nameplateQ = [];
window.NS_QUEUE_NAMEPLATE = (enemy, worldAboveY) => {
  _nameplateQ.push({ name: enemy.name, isBoss: enemy.isBoss, wx: enemy.x, wy: worldAboveY });
};
function drawNameplates(sx, sy){
  if(!_nameplateQ.length) return;
  ctx.save();
  ctx.font = '11px "Share Tech Mono"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for(const n of _nameplateQ){
    const sxp = (n.wx-cam.x)*zoom + cw/2 + sx;
    const syp = (n.wy-cam.y)*zoom + ch/2 + sy;
    const half = ctx.measureText(n.name).width/2 + 6;
    const cx = clamp(sxp, half, cw-half);
    const cy = clamp(syp, 14, ch-6);
    ctx.fillStyle = n.isBoss ? '#ffb347' : '#ffd166';
    ctx.fillText(n.name, cx, cy);
  }
  ctx.restore();
  _nameplateQ = [];
}

// ---- render ----
function render(){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cw,ch);
  ctx.fillStyle='#04060a'; ctx.fillRect(0,0,cw,ch);

  if(Outdoor.active()){
    resetInput();
    const bgKey = Outdoor.currentBgKey ? Outdoor.currentBgKey() : null;
    const bgImg = bgKey ? img(BG_BY_KEY[bgKey]) : null;
    Outdoor.render(ctx, cw, ch, bgImg);
    return;
  }

  if(!G){ return; }

  const sx=(G.shake>0?(Math.random()*2-1)*G.shake:0);
  const sy=(G.shake>0?(Math.random()*2-1)*G.shake:0);
  ctx.save();
  ctx.translate(cw/2+sx, ch/2+sy);
  ctx.scale(zoom,zoom);
  ctx.translate(-cam.x,-cam.y);

  drawTiles();
  drawTorchSconces();
  drawObjectiveTrail();
  drawStairs();
  drawGoldenKey();

  // entities + decor painter-sorted by y — cull anything sitting in a
  // room the player hasn't visited yet, so nothing leaks through the
  // solid-black fog-of-war ahead of actually walking in.
  const d=G.dun;
  const ents=[G.player, ...G.enemies, ...G.decor]
    .filter(e => e===G.player || isTileVisited(d, (e.x/TILE)|0, (e.y/TILE)|0))
    .sort((a,b)=>a.y-b.y);
  for(const e of ents){
    try{ e.draw(ctx); }
    catch(err){
      // A single bad draw call (bad sprite config, NaN position, etc.)
      // must never abort the loop — that used to mean every entity
      // sorted after the failing one, including the player, silently
      // never got drawn for the rest of that frame.
      if(!G._drawErrLogged){ G._drawErrLogged=true; console.error('[NullState] entity draw failed', err); }
    }
  }

  drawProjectiles(ctx);

  // Second wall pass: the wall block directly south of the player is
  // re-drawn ON TOP of the sprites at low alpha, so walking behind a tall
  // wall softly occludes the hero instead of the sprite floating over it.
  drawWallOcclusion();

  drawParticles();
  drawDmgNums();

  ctx.restore();

  drawNameplates(sx, sy);
  drawDarkness(sx,sy);
  drawVignette();
  drawMinimap();
  if(G.ultiFlash>0){
    const a=Math.min(0.7, G.ultiFlash);
    const g=ctx.createRadialGradient(cw/2,ch/2,0,cw/2,ch/2,Math.max(cw,ch)*0.7);
    g.addColorStop(0,`rgba(255,200,80,${a})`); g.addColorStop(1,`rgba(255,120,0,0)`);
    ctx.fillStyle=g; ctx.fillRect(0,0,cw,ch);
  }
}

// Wall block height (px) — gives walls visual volume instead of a thin line,
// which is also what lets us fade a wall when it would visually cover the
// player standing behind it (see drawWallFaces below).
const WALL_H = 30;

// Door tile rendering: real sprite (Mystic Woods wooden door, 2 frames —
// closed/open), opens when the player is near it. Falls back to a plain
// outlined tile if the sprite image hasn't finished loading yet.
function drawDoorTile(px,py,tx,ty){
  const p=G.player;
  const distTiles = Math.hypot((tx+0.5)-(p.x/TILE), (ty+0.5)-(p.y/TILE));
  const theme = G.dungeonTheme || DUNGEON_THEMES.bluestone;
  const doorSet = DECOR_SPRITES[theme.door] || DECOR_SPRITES.doorIron;
  // 5-frame closed->open sprite, indexed by proximity so the door visibly
  // swings open as the player approaches and shut again as they leave.
  const frame = Math.max(0, Math.min(4, Math.round((1.5-distTiles)*3)));
  const im = img(`${doorSet.src}/frame_${frame}.png`);
  // The sprite sheet is drawn for a door set into a horizontal (N/S) wall.
  // On an E/W wall the gap runs vertically, so the same art would sit flat
  // against a wall it doesn't belong to — rotate it 90° so it "stands" in
  // the vertical gap instead of always rendering in the N/S orientation.
  const door = (G.dun && G.dun.doorAt) ? G.dun.doorAt(tx,ty) : null;
  const side = door ? door.side : 'N';
  const vertical = (side==='E' || side==='W');
  if(im){
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = theme.wallFill; ctx.fillRect(px,py,TILE,TILE);
    if(vertical){
      const cx=px+TILE/2, cy=py+TILE/2;
      ctx.translate(cx,cy);
      ctx.rotate(Math.PI/2);
      ctx.drawImage(im, -TILE/2, -TILE/2-8, TILE, TILE+8);
    } else {
      ctx.drawImage(im, px, py-8, TILE, TILE+8); // slight extra height so the arch reads as part of the wall above it
    }
    ctx.restore();
    return;
  }
  // fallback: flat lit gap, in case the sprite hasn't loaded yet
  const open = distTiles < 1.3;
  ctx.fillStyle = theme.wallFill; ctx.fillRect(px,py,TILE,TILE);
  ctx.fillStyle = open ? '#02060a' : '#0e1c24';
  ctx.fillRect(px+4, py+4, TILE-8, TILE-8);
  ctx.fillStyle = open ? 'rgba(0,255,136,.45)' : 'rgba(0,255,136,.25)';
  ctx.fillRect(px+4, py+4, TILE-8, 2);
  ctx.fillRect(px+4, py+TILE-6, TILE-8, 2);
}

function drawTiles(){
  const d=G.dun;
  const x0=Math.max(0,((cam.x-cw/2/zoom)/TILE|0)-1);
  const x1=Math.min(d.W,((cam.x+cw/2/zoom)/TILE|0)+2);
  const y0=Math.max(0,((cam.y-ch/2/zoom)/TILE|0)-2); // extra row above for tall walls
  const y1=Math.min(d.H,((cam.y+ch/2/zoom)/TILE|0)+2);

  // Mark rooms the player is currently standing in (and their connected
  // corridor cells) as visited, so fog-of-war reveals them permanently.
  markVisited(d);

  for(let y=y0;y<y1;y++){
    for(let x=x0;x<x1;x++){
      const t=d.grid[y][x];
      const px=x*TILE, py=y*TILE;
      if(t===0){ continue; } // void = unlit, nothing to draw
      if(!isTileVisited(d,x,y)){
        // Unexplored room/corridor: semi-dark instead of pitch black, so the
        // layout remains readable while entities/loot still stay hidden.
        const theme = G.dungeonTheme || DUNGEON_THEMES.bluestone;
        ctx.fillStyle = t===3 ? 'rgba(18,26,31,0.72)' : theme.floorA;
        ctx.fillRect(px,py,TILE,TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.48)'; ctx.fillRect(px,py,TILE,TILE);
        continue;
      }
      if(t===3){
        drawDoorTile(px,py,x,y);
        continue;
      }
      // floor — colored per the current act's dungeon theme
      const theme = G.dungeonTheme || DUNGEON_THEMES.bluestone;
      drawFloorTile(px,py,x,y,theme,d.roomAt(x,y));
    }
  }
  drawRoomLighting(x0,x1,y0,y1);
  drawWallFaces(x0,x1,y0,y1);
}

function drawFloorTile(px,py,x,y,theme,room){
  const shade=((x+y)%2===0)?theme.floorA:theme.floorB;
  ctx.fillStyle=shade; ctx.fillRect(px,py,TILE,TILE);
  const h=(x*928371 + y*689287)>>>0;
  if(room && room.vibe==='cave'){
    ctx.fillStyle=theme.dirtA; ctx.globalAlpha=0.22;
    ctx.beginPath(); ctx.ellipse(px+TILE*0.5,py+TILE*0.55, TILE*(0.25+((h%7)/30)), TILE*0.16, 0, 0, 7); ctx.fill();
    ctx.globalAlpha=1;
  } else {
    ctx.strokeStyle='rgba(0,0,0,0.16)'; ctx.lineWidth=1;
    ctx.strokeRect(px+0.5,py+0.5,TILE-1,TILE-1);
    if((h%9)===0){ ctx.fillStyle=theme.floorSpeckle; ctx.fillRect(px+TILE/2-1,py+TILE/2-1,2,2); }
    if((h%17)===0){ ctx.fillStyle=theme.crack; ctx.fillRect(px+8,py+20,18,2); ctx.fillRect(px+24,py+22,2,7); }
    if(room && room.vibe==='moss' && (h%5)===0){ ctx.fillStyle=theme.moss; ctx.fillRect(px+2,py+TILE-7,12,3); ctx.fillRect(px+6,py+TILE-11,7,3); }
  }
}

// Soft overhead-lamp glow centered on each visited room (and a gentler
// glow along visited corridor tiles), drawn on top of the flat floor color
// so rooms/corridors read as lit, walkable spaces — distinct from the dark
// solid walls drawn afterward in drawWallFaces.
function drawRoomLighting(x0,x1,y0,y1){
  const d=G.dun;
  const theme = G.dungeonTheme || DUNGEON_THEMES.bluestone;
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  for(const r of d.rooms){
    if(!r.visited) continue;
    if(r.x+r.w<x0-2 || r.x>x1+2 || r.y+r.h<y0-2 || r.y>y1+2) continue; // outside viewport, skip
    const cx=(r.cx+0.5)*TILE, cy=(r.cy+0.5)*TILE;
    const rad=Math.max(r.w,r.h)*TILE*0.62;
    const g=ctx.createRadialGradient(cx,cy,0, cx,cy,rad);
    g.addColorStop(0,theme.roomGlow);
    g.addColorStop(0.6,theme.corridorGlow);
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;
    ctx.fillRect(r.x*TILE-TILE, r.y*TILE-TILE, (r.w+2)*TILE, (r.h+2)*TILE);
  }
  // gentle ambient strip along visited corridor tiles (non-room floor)
  for(let y=y0;y<y1;y++){
    for(let x=x0;x<x1;x++){
      if(d.grid[y][x]===0 || d.grid[y][x]===2) continue;
      if(d.roomAt(x,y)) continue; // rooms already got the glow above
      if(!isTileVisited(d,x,y)) continue;
      ctx.fillStyle=theme.corridorGlow;
      ctx.fillRect(x*TILE, y*TILE, TILE, TILE);
    }
  }
  // warm torch pools only in explored corridor/room edges.
  for(const l of d.lamps||[]){
    if(l.tx<x0-2||l.tx>x1+2||l.ty<y0-2||l.ty>y1+2) continue;
    if(!isTileVisited(d,l.tx,l.ty)) continue;
    const flick=0.78+0.22*Math.sin(G.time*8 + l.tx*0.9 + l.ty*0.4);
    const cx=(l.tx+0.5)*TILE, cy=(l.ty+0.48)*TILE;
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,TILE*2.0);
    g.addColorStop(0,`rgba(${theme.torch},${0.22*flick})`);
    g.addColorStop(0.45,`rgba(${theme.torch},${0.09*flick})`);
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(cx-TILE*2,cy-TILE*2,TILE*4,TILE*4);
  }
  ctx.restore();
}

function drawTorchSconces(){
  const d=G.dun; if(!d||!d.lamps) return;
  const theme=G.dungeonTheme||DUNGEON_THEMES.bluestone;
  const x0=Math.max(0,((cam.x-cw/2/zoom)/TILE|0)-1);
  const x1=Math.min(d.W,((cam.x+cw/2/zoom)/TILE|0)+2);
  const y0=Math.max(0,((cam.y-ch/2/zoom)/TILE|0)-2);
  const y1=Math.min(d.H,((cam.y+ch/2/zoom)/TILE|0)+2);
  for(const l of d.lamps){
    if(l.tx<x0||l.tx>x1||l.ty<y0||l.ty>y1) continue;
    if(!isTileVisited(d,l.tx,l.ty)) continue;
    // Push the sconce off the tile's center toward whichever edge is the
    // actual wall (N/S/E/W), so it reads as mounted on the wall face
    // instead of floating in the middle of the walkway.
    const edge = TILE*0.36;
    let ox=0, oy=0;
    if(l.side==='N') oy=-edge;
    else if(l.side==='S') oy=edge;
    else if(l.side==='W') ox=-edge;
    else if(l.side==='E') ox=edge;
    const x=(l.tx+0.5)*TILE+ox, y=(l.ty+0.48)*TILE+oy;
    const flick=0.7+0.3*Math.sin(G.time*10+l.tx);
    ctx.save();
    ctx.translate(x,y);
    ctx.fillStyle='#4b3322'; ctx.fillRect(-5,-12,10,9);
    ctx.fillStyle='#7b5632'; ctx.fillRect(-3,-15,6,8);
    ctx.globalCompositeOperation='lighter';
    ctx.fillStyle=`rgba(${theme.torch},${0.85*flick})`;
    ctx.beginPath(); ctx.ellipse(0,-19,5,8,0,0,7); ctx.fill();
    ctx.fillStyle='rgba(255,245,180,.82)'; ctx.fillRect(-1,-23,2,6);
    ctx.restore();
  }
}

function drawObjectiveTrail(){
  if(!G||!G.dun||G.paused) return;
  const hostiles = G.enemies.filter(e=>!e.dead && (e.arch.isUndead || e.isBoss));
  let target;
  if(hostiles.length){
    target = hostiles.reduce((best,e)=>{
      const d=Math.hypot(e.x-G.player.x,e.y-G.player.y);
      return !best || d<best.d ? {x:e.x,y:e.y,d,color:e.elite?'#ffd166':'#ff6070'} : best;
    }, null);
  } else if(!G.key.taken && G.key.depth===G.depth && !G.key._pendingPlacement){
    target = {x:G.key.x,y:G.key.y,color:'#ffd166'};
  } else {
    target = {x:G.dun.stairsPx.x,y:G.dun.stairsPx.y,color:'#00ff88'};
  }
  const dx=target.x-G.player.x, dy=target.y-G.player.y;
  const dist=Math.hypot(dx,dy);
  if(dist<TILE*3) return;
  const ux=dx/dist, uy=dy/dist;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for(let i=1;i<=4;i++){
    const pulse=(Math.sin(G.time*4-i*0.8)+1)/2;
    ctx.globalAlpha=0.12+pulse*0.18;
    ctx.fillStyle=target.color;
    const px=G.player.x+ux*TILE*(1.2+i*0.75), py=G.player.y+uy*TILE*(1.2+i*0.75);
    ctx.beginPath(); ctx.arc(px,py,3+i*0.35,0,7); ctx.fill();
  }
  ctx.restore();
}

// A room (or the start room) is visited once the player has stood inside
// it; corridor tiles are considered visited once adjacent to any visited
// room or once the player has physically stood on them.
function markVisited(d){
  const p=G.player;
  const tx=(p.x/TILE)|0, ty=(p.y/TILE)|0;
  const room = d.roomAt(tx,ty);
  if(room && !room.visited) room.visited = true;
  if(!d._visitedTiles) d._visitedTiles = new Set();
  if(!d._visitedCorridors) d._visitedCorridors = new Set();
  // Corridors reveal in one shot: the whole connected hallway the player
  // just stepped into lights up together, matching how rooms already
  // reveal fully on entry, instead of leaving unstepped-on edge tiles dark.
  const cid = (d.corridorId && d.corridorId[ty]) ? d.corridorId[ty][tx] : -1;
  if(cid!==-1) d._visitedCorridors.add(cid);
  d._visitedTiles.add(ty*d.W+tx);
  // also mark the 8 neighbours so standing in a doorway reveals both sides a touch
  for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
    const nx=tx+dx, ny=ty+dy;
    if(nx>=0&&ny>=0&&nx<d.W&&ny<d.H) d._visitedTiles.add(ny*d.W+nx);
  }
}
function isTileVisited(d,x,y){
  const room = d.roomAt(x,y);
  if(room) return room.visited;
  // corridor / non-room tile: visited once the player has set foot
  // anywhere in that same connected corridor (whole hallway lights up
  // together), falling back to the old per-tile check for edge cases
  // (e.g. the single-room fallback dungeon has no corridor components).
  const cid = (d.corridorId && d.corridorId[y]) ? d.corridorId[y][x] : -1;
  if(cid!==-1 && d._visitedCorridors && d._visitedCorridors.has(cid)) return true;
  return d._visitedTiles && d._visitedTiles.has(y*d.W+x);
}
function isEntityVisibleToPlayer(d,e){
  if(!d || !e) return false;
  const tx=(e.x/TILE)|0, ty=(e.y/TILE)|0;
  if(!isTileVisited(d,tx,ty)) return false;
  const er=d.roomAt(tx,ty);
  const pr=d.roomAt((G.player.x/TILE)|0, (G.player.y/TILE)|0);
  if(er && pr && er!==pr) return false;
  if(er && !pr) return Math.hypot(e.x-G.player.x,e.y-G.player.y)<TILE*2.2;
  return true;
}

// Tall wall blocks (top + front face) with an occlusion fade: a wall segment
// that visually sits between the camera and the player (i.e. the player is
// "behind" it from the top-down view, in the dead zone the tall front face
// would otherwise paint over) fades to a low alpha so the player sprite
// stays visible through it — but only dims a little, not full transparency,
// so the wall is still legible while you're back there.
function drawWallFaces(x0,x1,y0,y1){
  const d=G.dun;
  const theme = G.dungeonTheme || DUNGEON_THEMES.bluestone;
  const isFloor=(x,y)=> x>=0&&y>=0&&x<d.W&&y<d.H&&d.grid[y][x]!==0;
  const isVisitedFloor=(x,y)=> isFloor(x,y) && isTileVisited(d,x,y);
  // Expand the draw window by 1 tile so the extra "thickness" tile (drawn
  // one step outside an actual wall tile) isn't clipped at the viewport edge.
  const ex0=x0-1, ex1=x1+1, ey0=y0-1, ey1=y1+1;

  for(let y=ey0;y<ey1;y++){
    for(let x=ex0;x<ex1;x++){
      if(y<0||y>=d.H||x<0||x>=d.W) continue;
      if(d.grid[y][x]!==0) continue; // only void/wall tiles render here

      // A wall tile only gets drawn if it's within 2 tiles of a VISITED
      // floor tile (so unexplored areas stay fully hidden, matching the
      // existing fog-of-war). Checking up to 2 tiles away (not just 1) is
      // what gives the wall its thickness: the tile directly adjacent to
      // floor AND the tile one step further out both qualify and render.
      let nearVisitedFloor=false;
      for(let dy=-2; dy<=2 && !nearVisitedFloor; dy++){
        for(let dx=-2; dx<=2; dx++){
          if(Math.abs(dx)+Math.abs(dy)>2) continue; // diamond radius, not full square
          if(dx===0 && dy===0) continue;
          if(isVisitedFloor(x+dx,y+dy)){ nearVisitedFloor=true; break; }
        }
      }
      if(!nearVisitedFloor) continue;

      drawWallBlock(x,y,theme,d);
    }
  }
}

// One extruded 3D wall block — raised TOP face (shifted up by WALL_H so it
// covers what's behind/north of the wall, correct 3/4 top-down perspective)
// plus a lit FRONT face wherever the wall borders floor to the south,
// connecting the top face down to the floor line like a real solid wall.
function drawWallBlock(x,y,theme,d){
  const isFloor=(ax,ay)=> ax>=0&&ay>=0&&ax<d.W&&ay<d.H&&d.grid[ay][ax]!==0;
  const wx=x*TILE, wy=y*TILE;

  // TOP face (raised)
  ctx.fillStyle = theme.wallFill;
  ctx.fillRect(wx, wy-WALL_H, TILE, TILE);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(wx+1, wy-WALL_H+1, TILE-2, TILE-2);

  // FRONT face (south) — visible whenever floor lies below this wall
  if(isFloor(x,y+1)){
    const fy = wy+TILE-WALL_H;
    ctx.fillStyle = theme.wallFill;
    ctx.fillRect(wx, fy, TILE, WALL_H);
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; // light catch on the vertical face
    ctx.fillRect(wx, fy, TILE, WALL_H);
    // brick mortar lines
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(wx, fy+WALL_H*0.5-1, TILE, 2);
    ctx.fillRect(wx+((x%2)?TILE*0.5:TILE*0.25)-1, fy+2, 2, WALL_H*0.5-3);
    ctx.fillRect(wx+((x%2)?TILE*0.25:TILE*0.6)-1, fy+WALL_H*0.5+1, 2, WALL_H*0.5-3);
    // lit lip where the top face meets the front face
    ctx.fillStyle = theme.wallEdge;
    ctx.fillRect(wx, fy, TILE, 3);
    // contact shadow on the floor at the base of the wall
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(wx, wy+TILE, TILE, 4);
  }

  // lit edges where the raised top borders floor on the other sides
  const edge = 3;
  ctx.fillStyle = theme.wallEdge;
  if(isFloor(x,y-1)) ctx.fillRect(wx, wy-WALL_H, TILE, edge);
  if(isFloor(x+1,y)) ctx.fillRect(wx+TILE-edge, wy-WALL_H, edge, TILE);
  if(isFloor(x-1,y)) ctx.fillRect(wx, wy-WALL_H, edge, TILE);
}

// Occlusion fade: when the player stands directly behind (north of) a wall,
// that wall's block is re-drawn over the sprites at low alpha so the hero is
// softly hidden by the wall instead of rendering in front of it.
function drawWallOcclusion(){
  if(!G || !G.dun || !G.player) return;
  const d=G.dun, p=G.player;
  const theme=G.dungeonTheme||DUNGEON_THEMES.bluestone;
  const ptx=(p.x/TILE)|0, pty=(p.y/TILE)|0;
  const y=pty+1;
  if(y>=d.H) return;
  ctx.save();
  ctx.globalAlpha=0.55;
  for(let x=ptx-1;x<=ptx+1;x++){
    if(x<0||x>=d.W) continue;
    if(d.grid[y][x]!==0) continue;           // not a wall tile
    if(p.y <= y*TILE - WALL_H - 4) continue; // raised block doesn't reach the sprite
    drawWallBlock(x,y,theme,d);
  }
  ctx.restore();
}

// ---- golden key (rare, one per match, relocates if you die before grabbing it) ----
function drawGoldenKey(){
  if(!G.key || G.key.taken || G.key._pendingPlacement || G.key.depth!==G.depth) return;
  const { x, y } = G.key;
  if(!isTileVisited(G.dun, (x/TILE)|0, (y/TILE)|0)) return;
  const bob = Math.sin(G.time*3.2)*4;
  const pulse = 0.5+0.5*Math.sin(G.time*4);

  ctx.save();
  ctx.translate(x, y);

  // ground glow (warm gold, floor-hugging ellipse like the lift's red one)
  const g = ctx.createRadialGradient(0,3,0, 0,3,22);
  g.addColorStop(0, `rgba(255,209,102,${0.30+0.12*pulse})`);
  g.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = g;
  ctx.save(); ctx.scale(1,0.4);
  ctx.beginPath(); ctx.arc(0,7,22,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // bobbing key icon
  ctx.translate(0, bob - 8);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(-4,0,5,0,Math.PI*2); ctx.fill();      // bow (ring)
  ctx.fillStyle = '#caa15a';
  ctx.beginPath(); ctx.arc(-4,0,2.2,0,Math.PI*2); ctx.fill();    // bow hole
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(-1,-1.5,11,3);                                     // shaft
  ctx.fillRect(5,-1.5,2,5);                                       // tooth 1
  ctx.fillRect(8,-1.5,2,4);                                       // tooth 2
  // sparkle
  ctx.globalAlpha = 0.6+0.4*pulse;
  ctx.fillStyle = '#fff8e0';
  ctx.fillRect(-4,-9,1.5,4); ctx.fillRect(-6,-7,4,1.5);
  ctx.restore();
  ctx.restore();
}

function drawStairs(){
  const s=G.dun.stairsPx;
  if(!isTileVisited(G.dun, (s.x/TILE)|0, (s.y/TILE)|0)) return;
  const pulse=0.5+0.5*Math.sin(G.time*3);
  const bob=Math.sin(G.time*2.4)*5; // arrow bob amplitude, px

  ctx.save();
  ctx.translate(s.x,s.y);

  // ---- ground glow circle (faded red, hugs the floor) ----
  const glowR = 34;
  const g = ctx.createRadialGradient(0,4,0, 0,4,glowR);
  g.addColorStop(0, 'rgba(255,70,90,0.22)');
  g.addColorStop(0.6, 'rgba(255,40,70,0.13)');
  g.addColorStop(1, 'rgba(255,30,60,0)');
  ctx.fillStyle = g;
  ctx.save(); ctx.scale(1,0.42); // flatten into a floor-hugging ellipse
  ctx.beginPath(); ctx.arc(0,9.5,glowR,0,Math.PI*2); ctx.fill();
  ctx.restore();
  // thin ring outline on the glow, breathing with the pulse
  ctx.globalAlpha = 0.25+0.2*pulse;
  ctx.strokeStyle = '#ff4a5e'; ctx.lineWidth = 1.5;
  ctx.save(); ctx.scale(1,0.42);
  ctx.beginPath(); ctx.arc(0,9.5,glowR*0.86,0,Math.PI*2); ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;

  // ---- lift platform (small raised block, top-down) ----
  ctx.fillStyle = '#1a2430';
  ctx.fillRect(-19,-14,38,28);
  ctx.fillStyle = '#26343f';
  ctx.fillRect(-15,-10,30,20);
  ctx.fillStyle = 'rgba(0,255,136,.5)';
  ctx.fillRect(-15,-10,30,2);
  // diagonal hazard ticks along the platform edge (lift/industrial feel)
  ctx.strokeStyle = 'rgba(255,200,80,.35)'; ctx.lineWidth=2;
  for(let i=-12;i<=12;i+=8){ ctx.beginPath(); ctx.moveTo(i,9); ctx.lineTo(i+4,13); ctx.stroke(); }

  // ---- bobbing arrow pointing down at the glow circle ----
  ctx.translate(0, -34 + bob);
  ctx.fillStyle = `rgba(255,90,105,${0.55+0.35*pulse})`;
  ctx.beginPath();
  ctx.moveTo(0, 10); ctx.lineTo(-8, -4); ctx.lineTo(8, -4); ctx.closePath();
  ctx.fill();
  ctx.fillRect(-3, -10, 6, 8);

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
  const rad=Math.max(cw,ch)*0.62;
  const g=ctx.createRadialGradient(px,py,rad*0.3, px,py,rad);
  g.addColorStop(0,'rgba(0,0,0,0)');
  g.addColorStop(0.6,'rgba(2,5,8,0.12)');
  g.addColorStop(1,'rgba(1,3,5,0.38)');
  ctx.fillStyle=g; ctx.fillRect(0,0,cw,ch);
  // warm torch tint
  const g2=ctx.createRadialGradient(px,py,0,px,py,rad*0.6);
  g2.addColorStop(0,'rgba(0,255,136,0.06)');
  g2.addColorStop(1,'rgba(0,255,136,0)');
  ctx.fillStyle=g2; ctx.fillRect(0,0,cw,ch);
}
function drawVignette(){
  const g=ctx.createRadialGradient(cw/2,ch/2,Math.min(cw,ch)*0.4,cw/2,ch/2,Math.max(cw,ch)*0.8);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.28)');
  ctx.fillStyle=g; ctx.fillRect(0,0,cw,ch);
}

// ---- minimap (top-right) ----
// Shows the room/corridor layout, the player's position + facing, the
// nearest visible enemies, and the stairs. When the stairs are far outside
// the minimap's own little view window, a directional arrow at the edge
// points toward them so the player always has a "which way do I go" cue.
const MM = { size:108, pad:12, top:78 }; // top clears the HP/XP bars + stat row
function getMinimapMetrics(){
  // Smaller on narrow/portrait phones — 108px was dominating the screen.
  if(portrait && cw < 480) return { size:78, pad:10, top:74 };
  return MM;
}
function drawMinimap(){
  const d = G.dun; if(!d) return;
  const { size, pad, top } = getMinimapMetrics();
  const mx = cw - pad - size, my = top;
  const cellPx = size / Math.max(d.W, d.H);

  ctx.save();
  // panel background
  ctx.fillStyle = 'rgba(4,8,10,0.62)';
  ctx.strokeStyle = 'rgba(0,255,136,.32)'; ctx.lineWidth = 1;
  ctx.fillRect(mx, my, size, size);
  ctx.strokeRect(mx+0.5, my+0.5, size-1, size-1);

  // clip to panel so nothing draws outside the rounded box
  ctx.beginPath(); ctx.rect(mx, my, size, size); ctx.clip();

  // explored floor tiles (subtle), only within a radius of the player so it
  // reads as "fog of war" rather than spoiling the whole floor layout
  const visR = 11; // tiles
  const ptx = (G.player.x/TILE)|0, pty=(G.player.y/TILE)|0;
  ctx.fillStyle = 'rgba(0,255,136,.16)';
  for(let ty=0; ty<d.H; ty++){
    for(let tx=0; tx<d.W; tx++){
      if(d.grid[ty][tx]===0) continue;
      if(!isTileVisited(d,tx,ty)) continue;
      if(Math.hypot(tx-ptx,ty-pty) > visR) continue;
      ctx.fillRect(mx+tx*cellPx, my+ty*cellPx, Math.max(1,cellPx), Math.max(1,cellPx));
    }
  }

  // lift dot
  const stx = mx + (d.stairsPx.x/TILE)*cellPx, sty = my + (d.stairsPx.y/TILE)*cellPx;
  ctx.fillStyle = '#ff4a5e';
  ctx.beginPath(); ctx.arc(stx, sty, 3, 0, 7); ctx.fill();

  // golden key dot (only if it's on this floor and not yet picked up)
  if(G.key && !G.key.taken && !G.key._pendingPlacement && G.key.depth===G.depth){
    const kx = mx + (G.key.x/TILE)*cellPx, ky = my + (G.key.y/TILE)*cellPx;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(kx, ky, 3, 0, 7); ctx.fill();
  }

  // nearby enemy dots
  ctx.fillStyle = '#ff5d54';
  for(const e of G.enemies){
    if(e.dead) continue;
    if(Math.hypot(e.x/TILE-ptx, e.y/TILE-pty) > visR) continue;
    const ex = mx + (e.x/TILE)*cellPx, ey = my + (e.y/TILE)*cellPx;
    ctx.beginPath(); ctx.arc(ex, ey, e.isBoss?3.5:2, 0, 7); ctx.fill();
  }

  // player dot + facing wedge
  const px = mx + ptx*cellPx, py = my + pty*cellPx;
  const ang = G.player.facing>0 ? 0 : Math.PI;
  ctx.translate(px, py); ctx.rotate(ang);
  ctx.fillStyle = '#00ff88';
  ctx.beginPath(); ctx.moveTo(5,0); ctx.lineTo(-4,-3.5); ctx.lineTo(-4,3.5); ctx.closePath(); ctx.fill();
  ctx.restore();

  // directional arrow to stairs, shown at the panel edge facing their
  // direction — most useful once you've moved away from the start room
  ctx.save();
  const ddx = d.stairsPx.x - G.player.x, ddy = d.stairsPx.y - G.player.y;
  const ddist = Math.hypot(ddx,ddy);
  if(ddist > TILE*6){
    const ang2 = Math.atan2(ddy,ddx);
    const cx = mx+size/2, cy = my+size/2, r = size/2 - 9;
    const ax = cx + Math.cos(ang2)*r, ay = cy + Math.sin(ang2)*r;
    ctx.translate(ax, ay); ctx.rotate(ang2);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.moveTo(7,0); ctx.lineTo(-5,-5); ctx.lineTo(-5,5); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  const remaining = G.enemies.filter(e=>!e.dead && (e.arch.isUndead || e.isBoss)).length;
  ctx.fillStyle = remaining ? 'rgba(255,209,102,.72)' : 'rgba(0,255,136,.78)';
  ctx.font = '9px "Share Tech Mono"';
  ctx.textAlign = 'center';
  ctx.fillText(remaining ? `${remaining} HOSTILES` : 'LIFT UNLOCKED', mx+size/2, my+size+12);
  ctx.restore();
}

// ---- update ----
function update(dt){
  if(Outdoor.active()){
    // Always keep ticking Outdoor.update() while active (as long as no
    // cutscene is stealing the frame) — outdoor.js already withholds
    // movement input on its own during phase==='arrival' (it returns
    // before ever reading input.left/right). Gating the call itself here
    // used to also freeze the arrival dialogue's own advance timer, since
    // that timer only ticks inside Outdoor.update() — leaving the player
    // stuck on the first speech line forever, unable to move even after.
    if(!csActive) Outdoor.update(dt, input);
    return;
  }
  if(!G||G.paused||G.over) return;
  G.time+=dt;
  const p=G.player;
  if(G.action.cd>0) G.action.cd-=dt;
  if(G.ultiFlash>0) G.ultiFlash-=dt;
  if(G.combo && G.combo.t>0) G.combo.t-=dt;
  checkRoomDiscovery();
  // nearest VISIBLE alive enemy (drives auto-attack + camera + ulti).
  // "Visible" = standing in a tile the player has actually explored — an
  // elite/boss sitting in an unvisited room behind the fog-of-war should
  // never be able to trigger an ulti offer the player can't even see.
  let nearest=null, nd=1e9;
  for(const e of G.enemies){
    if(e.dead||e.spawnT>0) continue;
    if(!isEntityVisibleToPlayer(G.dun, e)) continue;
    const d=Math.hypot(e.x-p.x,e.y-p.y); if(d<nd){ nd=d; nearest=e; }
  }
  G._nd=nd;
  // nearest unbroken non-interactive decoration (auto-smash targets only)
  let nearDecor=null, ndd=1e9;
  for(const o of G.decor){ if(o.broken||o.interactive) continue;
    const d=Math.hypot(o.x-p.x,o.y-p.y); if(d<ndd){ ndd=d; nearDecor=o; } }
  // AUTO-ATTACK: enemies first, then nearby breakables
  const enemyInRange = nearest && nd < (76+nearest.r);
  const decorInRange = nearDecor && ndd < (54+nearDecor.r);
  if(p.atkCd<=0 && !p.attacking){
    if(enemyInRange){
      const dx=nearest.x-p.x, dy=nearest.y-p.y, m=Math.hypot(dx,dy)||1;
      p.facing=dx>=0?1:-1; p._lastMove={x:dx/m,y:dy/m}; p.startAttack();
    }
    else if(decorInRange){
      const dx=nearDecor.x-p.x, dy=(nearDecor.y-nearDecor.h*0.35)-p.y, m=Math.hypot(dx,dy)||1;
      p.facing=dx>=0?1:-1; p._lastMove={x:dx/m,y:dy/m}; p.startAttack();
    }
  }
  if(input.attack) p.startAttack();          // manual (desktop)
  if(G.paused) return;
  p.update(dt, input, G.dun);
  if(p.takeSwingFx()) spark(p.x+p.facing*30, p.y-10, '#eafff5', 8, 100);
  hitTest();
  updateProjectiles(dt);
  // Action button (NULL_STRIKE / OPEN) — recomputed AFTER hitTest() so a
  // killing blow landed this frame is already reflected (e.dead=true)
  // before we decide whether the button should show NULL_STRIKE; otherwise
  // a boss that's about to die from this frame's hit could still flash the
  // button a frame later than it visually died. Non-blocking — never pauses.
  updateActionButton(nearest, nd);
  for(const e of G.enemies){
    e.update(dt, p, G.dun);
    if(e.takeSwingFx()) spark(e.x+e.facing*e.r, e.y-e.r*0.4, e.elite?'#ffd166':'#ff8a7a', 10, 90);
  }
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
  // lift: standing near it opens the floor-select popup (once per approach,
  // not every frame, so it doesn't re-open while standing still after closing it)
  const distToLift = Math.hypot(p.x-G.dun.stairsPx.x, p.y-G.dun.stairsPx.y);
  if(distToLift < TILE*0.85){
    if(!G._liftPrompted && !G.paused){ G._liftPrompted=true; openLiftMenu(); }
  } else { G._liftPrompted = false; }
  // golden key pickup: walk within range of it on the floor it's currently on
  if(!G.key.taken && G.key.depth===G.depth && !G.key._pendingPlacement){
    const dk = Math.hypot(p.x-G.key.x, p.y-G.key.y);
    if(dk < TILE*0.6){
      G.key.taken = true; G.inventory.keys += 1;
      spark(G.key.x, G.key.y-10, '#ffd166', 26, 200);
      log('⚷ Golden Key found! Stored in your inventory.', 'reward');
      updateHUD();
    }
  }
  // ambient dust / null motes — light enough for mobile but keeps scenes alive
  const moteChance = portrait ? 0.10 : 0.16;
  if(Math.random()<moteChance){ const a=Math.random()*Math.PI*2,r=60+Math.random()*120;
    const danger = nearest && nd<170;
    G.particles.push({x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r,vx:0,vy:-8,life:1.2,max:1.2,
      color:danger?'rgba(255,80,90,.22)':'rgba(0,255,136,.25)',r:1}); }
  updateCam();
}

// ---- loop ----
let last=0;
function frame(t){
  if(destroyed) return;
  const dt=Math.min(0.05,(t-last)/1000||0); last=t;
  // update()/render() used to run unguarded: if either threw, this
  // function would abort BEFORE reaching requestAnimationFrame(frame)
  // below, and the whole game would freeze on that exact frame forever
  // (the browser just never gets asked to schedule another one). Wrapping
  // them means a one-off bug in game logic or drawing shows up as a
  // console error and, at worst, a skipped/glitched frame — never a full
  // stuck screen.
  try{
    // Hit-stop: skip logic tick while freeze is active (visual still runs)
    const fx = window.NS_FX;
    if (fx && fx.HitStop.tick(dt)) {
      render();
    } else {
      update(dt); render();
    }
  } catch(err){
    console.error('frame() failed, continuing loop', err);
  }
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
  updateInventoryPanel();
}
function updateInventoryPanel(){
  if(!G) return; const p=G.player;
  const hpFill=$('invHpFill'), hpText=$('invHpText'), xpFill=$('invXpFill'), xpText=$('invXpText');
  if(hpFill){ hpFill.style.width=(p.hp/p.maxHp*100)+'%'; }
  if(hpText){ hpText.textContent=`${Math.ceil(p.hp)}/${p.maxHp}`; }
  if(xpFill){ xpFill.style.width=(p.xp/p.xpForNext()*100)+'%'; }
  if(xpText){ xpText.textContent=`${p.xp}/${p.xpForNext()}`; }
  const tab = G._invTab || 'loot';
  const burnSum=$('burnSummary'), burnBtn=$('burnConfirm');
  if(tab==='equipment'){
    renderEquipmentPanel('invItems');
    if(burnSum) burnSum.style.display='none';
    if(burnBtn) burnBtn.style.display='none';
  } else {
    renderStashPanel('invItems','invEmpty',{readonly:false, filter:tab});
    if(burnSum) burnSum.style.display='';
    if(burnBtn) burnBtn.style.display='';
  }
  persistStashSnapshot();
}
// Mirror the player's current (unburned) stash into localStorage so the
// out-of-game Rewards screen (components/game/RewardsScreen.tsx) can show
// "items not yet burned" even though it renders outside this live canvas
// session and has no direct access to the G.inventory object. Keyed per
// wallet so it doesn't leak between accounts on a shared device.
function persistStashSnapshot(){
  if(!G || !WALLET_ADDRESS || typeof localStorage==='undefined') return;
  try{
    const itemEntries = Object.values(G.inventory.items||{}).map(e=>({
      id: e.item.id, name: e.item.name, rarity: e.item.rarity, color: e.item.color,
      icon: e.item.icon, qty: e.qty, burnValue: e.item.burnValue,
    }));
    const snapshot = { items: itemEntries, updatedAt: Date.now() };
    localStorage.setItem('nullstate-stash-'+WALLET_ADDRESS.toLowerCase(), JSON.stringify(snapshot));
  }catch(e){ /* localStorage unavailable/full — non-critical, just skip */ }
}
// Generic stash renderer, reused for both the player's own inventory panel
// (#invItems) and the read-only reference panel inside the container window
// (#containerPlayerItems, opts.readonly:true — no selection, no burn bar).
// Non-readonly rows now have TWO independent interactions:
//   - tap the item body (icon/name)  -> openItemZoom() -> instant single BURN
//   - tap the small circle in the corner (.inv-item-select) -> toggleBurnQueue()
//     -> adds/removes from the multi-select queue for "BURN SELECTED" below.
// They're separate hit targets (checkbox uses stopPropagation) so neither
// flow interferes with the other.
function renderStashPanel(targetId, emptyId, opts){
  opts=opts||{};
  const host=$(targetId), empty=emptyId?$(emptyId):null;
  if(!host || !G) return;
  host.classList.remove('equip-mode');
  host.querySelectorAll('.equip-row,.equip-slotline').forEach(n=>n.remove());
  host.querySelectorAll('.inv-item').forEach(n=>n.remove());
  const keyCount = G.inventory.keys||0;
  const relicCount = G.inventory.relics||0;
  const shardCount = G.inventory.shards||0;
  const itemEntries = Object.values(G.inventory.items||{});
  const anything = keyCount+relicCount+shardCount+itemEntries.length>0;
  // The grid itself is always shown as a fixed 5x5 (25-slot) layout, filled
  // out with empty placeholder cells — see fillGridPlaceholders(). The
  // "nothing here yet" text is redundant with a visibly empty grid, so it
  // only appears now if the grid host itself is missing from the DOM.
  if(empty) empty.style.display='none';
  let rowCount=0;
  const addRow=(id,iconSrc,name,count)=>{
    if(count<=0) return;
    const row=document.createElement('div'); row.className='inv-item'; row.dataset.id=id;
    row.innerHTML=`<img class="inv-item-icon" src="${iconSrc}" alt="${name}" draggable="false"><span class="inv-item-name">${name}</span><span class="inv-item-count">×${count}</span>`;
    host.appendChild(row);
    rowCount++;
  };
  addRow('goldkey','/sprites/items/golden_key.png','Golden Key', opts.filter==='food'?0:keyCount);
  addRow('relic','/sprites/items/relic.png','Relic', opts.filter==='food'?0:relicCount);
  addRow('shard','/sprites/items/shard.png','Null Shard', opts.filter==='food'?0:shardCount);
  for(const entry of itemEntries){
    const it=entry.item;
    const isFoodItem = !!(window.NS_MARKET && NS_MARKET.isFood(it.id));
    if(opts.filter==='food' && !isFoodItem) continue;
    if(opts.filter==='loot' && isFoodItem) continue;
    const row=document.createElement('div');
    row.className='inv-item'; row.dataset.id=it.id;
    row.style.borderColor=it.color;
    const queued = !opts.readonly && G.burnQueue.has(it.id);
    if(queued) row.classList.add('queued');
    const selectHtml = opts.readonly ? '' : `<span class="inv-item-select${queued?' checked':''}" data-select-id="${it.id}"></span>`;
    row.innerHTML=selectHtml+
      `<img class="inv-item-icon" src="${it.icon}" alt="${it.name}" draggable="false">`+
      `<span class="inv-item-name" style="color:${it.color}">${it.name}</span>`+
      `<span class="inv-item-count">×${entry.qty}</span>`+
      `<span class="inv-item-value">${it.burnValue.toFixed(3)}</span>`;
    // Non-readonly (#invItems, the player's own stash): tapping the item
    // body (icon/name/count/value) opens the zoom overlay for an instant
    // single-item BURN. The small corner checkbox (.inv-item-select) is a
    // SEPARATE hit target that toggles the item in/out of the multi-select
    // burn queue, so "BURN SELECTED" below keeps working independently of
    // the zoom flow. The readonly reference panel inside #containerWindow
    // (#containerPlayerItems) intentionally gets no click handler at all —
    // it's just a "what's already in your stash" reference while looting.
    if(!opts.readonly){
      row.addEventListener('click', (ev)=>{
        if(ev.target.closest('.inv-item-select')) return; // handled separately below
        openItemZoom({mode:'stash', itemId:it.id});
      });
      const selectEl=row.querySelector('.inv-item-select');
      if(selectEl){
        selectEl.addEventListener('click', (ev)=>{ ev.stopPropagation(); toggleBurnQueue(it.id); });
      }
    }
    host.appendChild(row);
    rowCount++;
  }
  fillGridPlaceholders(host, Math.max(0, (opts.gridSlots||GRID_SLOT_COUNT)-rowCount));
  if(!opts.readonly) updateBurnBar();
}
function toggleBurnQueue(itemId){
  if(G.burnQueue.has(itemId)) G.burnQueue.delete(itemId);
  else G.burnQueue.add(itemId);
  renderStashPanel('invItems','invEmpty',{readonly:false});
}
function updateBurnBar(){
  const bar=$('burnSummary'), btn=$('burnConfirm');
  if(!bar || !btn) return;
  const ids=[...G.burnQueue].filter(id=>G.inventory.items[id]);
  if(!ids.length){
    bar.textContent='Select items to send to the weekly burn pool.';
    btn.disabled=true;
    return;
  }
  let total=0, count=0;
  for(const id of ids){ const e=G.inventory.items[id]; total+=e.item.burnValue*e.qty; count+=e.qty; }
  bar.textContent=`${count} item(s) selected · ${(Math.round(total*1000)/1000).toFixed(3)} USDm`;
  btn.disabled=false;
}
// Burn the currently-queued items. Does NOT credit p.celo/p.usdm instantly —
// burns now feed the weekly reward pool (see NullStateReward.sol /
// /api/burn/record), so the player's claimable balance only updates once
// they claim the weekly pool (ClaimWeeklyWidget). This just clears the
// items from the local stash (optimistic) and reports the burn to the app
// shell via a CustomEvent that DungeonGameWrapper.tsx listens for.
function confirmBurn(){
  if(!G || !G.burnQueue.size) return;
  const items=[]; let totalValue=0;
  for(const id of [...G.burnQueue]){
    const entry=G.inventory.items[id]; if(!entry) continue;
    items.push({ id, name:entry.item.name, rarity:entry.item.rarity, qty:entry.qty, burnValue:entry.item.burnValue,
      icon:entry.item.icon, color:entry.item.color });
    totalValue += entry.item.burnValue*entry.qty;
    delete G.inventory.items[id];
  }
  G.burnQueue.clear();
  if(items.length){
    window.dispatchEvent(new CustomEvent('nullstate-items-burned', {
      detail: { wallet: WALLET_ADDRESS, items, totalValue: Math.round(totalValue*1000)/1000, timestamp: Date.now() }
    }));
    log(`◆ ${items.length} item(s) sent to the weekly burn pool.`, 'reward');
  }
  updateInventoryPanel();
}

// ---- item zoom overlay (Task 2: replaces per-slot instant-take / burn-queue
// toggle with a single "tap slot -> zoom -> confirm action" step) ----
// ctx shapes:
//   {mode:'container-loot', slotId, item, qty}  -> shows TAKE
//   {mode:'stash', itemId}                      -> shows BURN
function openItemZoom(ctx){
  const overlay=$('itemZoom'); if(!overlay || !G) return;
  const icon=$('itemZoomIcon'), name=$('itemZoomName'), qtyEl=$('itemZoomQty'),
    valEl=$('itemZoomValue'), takeBtn=$('itemZoomTake'), burnBtn=$('itemZoomBurn');
  let item, qty;
  if(ctx.mode==='container-loot'){
    item=ctx.item; qty=ctx.qty;
  } else if(ctx.mode==='stash'){
    const entry=G.inventory.items[ctx.itemId]; if(!entry) return;
    item=entry.item; qty=entry.qty;
  } else return;
  if(icon){ icon.src=item.icon; icon.alt=item.name; }
  if(name){ name.textContent=item.name; name.style.color=item.color||''; }
  if(qtyEl) qtyEl.textContent=`×${qty}`;
  if(valEl) valEl.textContent=`${item.burnValue.toFixed(3)} USDm each`;
  // Food items (loot ids in NS_MARKET.FOOD_RANGES) get an EAT action on the
  // TAKE button instead of hiding it; they can still be burned too.
  const isFoodItem = ctx.mode==='stash' && window.NS_MARKET && NS_MARKET.isFood(item.id);
  if(takeBtn){
    if(ctx.mode==='container-loot'){ takeBtn.classList.remove('hidden'); takeBtn.textContent='TAKE'; }
    else if(isFoodItem){ const pct=Math.round(NS_MARKET.foodHealFraction(item.rarity)*100);
      takeBtn.classList.remove('hidden'); takeBtn.textContent='EAT +'+pct+'% HP'; }
    else { takeBtn.classList.add('hidden'); }
  }
  if(burnBtn) burnBtn.classList.toggle('hidden', ctx.mode!=='stash');
  G._zoomCtx=ctx;
  overlay.classList.remove('hidden');
}
function closeItemZoom(){
  const overlay=$('itemZoom'); if(overlay) overlay.classList.add('hidden');
  if(G) G._zoomCtx=null;
}
function onItemZoomTake(){
  if(!G || !G._zoomCtx) return;
  if(G._zoomCtx.mode==='container-loot'){ takeContainerSlot(G._zoomCtx.slotId); closeItemZoom(); return; }
  if(G._zoomCtx.mode==='stash'){ eatFoodItem(G._zoomCtx.itemId); closeItemZoom(); return; }
}
function onItemZoomBurn(){
  if(!G || !G._zoomCtx || G._zoomCtx.mode!=='stash') return;
  burnSingleItem(G._zoomCtx.itemId);
  closeItemZoom();
}
// Burns exactly one stash entry (all of its qty) immediately — no queue,
// no multi-select. Mirrors confirmBurn()'s event shape/dispatch exactly
// (same 'nullstate-items-burned' CustomEvent) so it lands in Rewards
// History the same way a queued burn would, just with a single-item array.
function burnSingleItem(itemId){
  if(!G) return;
  const entry=G.inventory.items[itemId]; if(!entry) return;
  const items=[{ id:itemId, name:entry.item.name, rarity:entry.item.rarity, qty:entry.qty, burnValue:entry.item.burnValue,
    icon:entry.item.icon, color:entry.item.color }];
  const totalValue=entry.item.burnValue*entry.qty;
  delete G.inventory.items[itemId];
  G.burnQueue.delete(itemId);
  window.dispatchEvent(new CustomEvent('nullstate-items-burned', {
    detail: { wallet: WALLET_ADDRESS, items, totalValue: Math.round(totalValue*1000)/1000, timestamp: Date.now() }
  }));
  log(`◆ ${entry.item.name} sent to the weekly burn pool.`, 'reward');
  updateInventoryPanel();
}
// ======================================================================
//  MARKETPLACE EQUIPMENT + FOOD  (Phase 2 engine wiring)
// ----------------------------------------------------------------------
//  Equipment is PERMANENT and offchain-owned (see marketplace-items.js /
//  Firebase). applyEquipment() adds/removes the equipped gear's bonuses as a
//  DELTA on top of the player's current stats, so it never clobbers level-up
//  or relic gains. Weapon = flat atk bonus (+ behavior handled in hitTest);
//  armor = % Max HP multiplier.
// ======================================================================
function applyEquipment(p){
  if(!p) return;
  const eq = (G && G.equipment) ? G.equipment.equipped : { mainhand:null, body:null };
  const M  = window.NS_MARKET;
  const w  = (M && eq.mainhand) ? M.getEquipment(eq.mainhand) : null;
  const a  = (M && eq.body)     ? M.getEquipment(eq.body)     : null;

  const prev = p._equipDelta || { atk:0, hpMul:1 };
  // 1) remove the previously-applied equipment delta
  p.atkDmg -= prev.atk;
  const baseMaxNoArmor = Math.round(p.maxHp / (prev.hpMul || 1));
  // 2) compute + apply new delta
  const atkBonus = w ? (w.effect.atkBonus || 0) : 0;
  const hpMul    = a ? (1 + (a.effect.hpBonus || 0)) : 1;
  p.atkDmg += atkBonus;
  const oldMax = p.maxHp;
  const newMax = Math.max(1, Math.round(baseMaxNoArmor * hpMul));
  p.maxHp = newMax;
  if(newMax > oldMax) p.hp = Math.min(newMax, p.hp + (newMax - oldMax)); // armor grants the extra HP
  else p.hp = Math.min(p.hp, newMax);
  p._equipDelta = { atk:atkBonus, hpMul:hpMul };
  // exposed to entities.js draw() for FX flavor / intensity (Phase 5 polish)
  p._fxTier = w ? (w.fxTier || 1) : 1;
  p._weaponBehavior = w ? (w.effect.behavior || null) : null;
  // Phase 5.3 Task 5: gear VISUALS (separate from the stat deltas above).
  // eq.mainhand/eq.body are item ids, same ones LPC_ARMOR/LPC_WEAPON in
  // assets.js are keyed by — see drawLPCComposite() in entities.js.
  p.equippedArmorId = eq.body || null;
  p.equippedWeaponId = eq.mainhand || null;
}
function equipItem(id){
  if(!G || !window.NS_MARKET) return false;
  const item = NS_MARKET.getEquipment(id); if(!item) return false;
  if(!G.equipment.owned.includes(id)) return false; // must own it first
  G.equipment.equipped[item.slot] = id;
  applyEquipment(G.player);
  if(typeof updateHUD==='function') updateHUD();
  if(typeof updateInventoryPanel==='function') updateInventoryPanel();
  if(typeof window.NS_saveEquipment==='function') window.NS_saveEquipment(G.equipment);
  return true;
}
function unequipSlot(slot){
  if(!G || !G.equipment.equipped[slot]) return;
  G.equipment.equipped[slot] = null;
  applyEquipment(G.player);
  if(typeof updateHUD==='function') updateHUD();
  if(typeof updateInventoryPanel==='function') updateInventoryPanel();
  if(typeof window.NS_saveEquipment==='function') window.NS_saveEquipment(G.equipment);
}
function setOwnedEquipment(list){
  if(!G) return;
  G.equipment.owned = Array.isArray(list) ? list.slice() : [];
  if(typeof updateInventoryPanel==='function') updateInventoryPanel();
}
// Eat a food loot item (heal % of Max HP by rarity, consume one).
function eatFoodItem(itemId){
  if(!G) return;
  const entry = G.inventory.items[itemId]; if(!entry) return;
  const p = G.player;
  const frac = window.NS_MARKET ? NS_MARKET.foodHealFraction(entry.item.rarity) : 0.03;
  const heal = Math.max(1, Math.round(p.maxHp * frac));
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + heal);
  const gained = Math.round(p.hp - before);
  lootText(p.x, p.y-30, '+'+gained+' HP', '#3dff88');
  spark(p.x, p.y-14, '#3dff88', 16, 150);
  const name = entry.item.name;
  entry.qty -= 1;
  if(entry.qty <= 0){ delete G.inventory.items[itemId]; G.burnQueue.delete(itemId); }
  if(A && A.pickup) A.pickup();
  log('Ate '+name+' \u2014 +'+gained+' HP', 'reward');
  if(typeof updateHUD==='function') updateHUD();
  updateInventoryPanel();
}
// Public API for the React shell / Marketplace UI (Phase 4) to drive equipment.
window.NS_EQUIP = {
  equip: equipItem,
  unequip: unequipSlot,
  setOwned: setOwnedEquipment,
  apply: applyEquipment,
  eat: eatFoodItem,
  get: function(){ return G ? G.equipment : null; },
};

// Equipment tab renderer — owned gear list with Equip/Unequip, plus the
// currently-equipped weapon/armor summary. Renders into #invItems (switched
// to single-column via the .equip-mode class).
function renderEquipmentPanel(targetId){
  const host=$(targetId); if(!host || !G) return;
  host.classList.add('equip-mode');
  host.querySelectorAll('.inv-item,.equip-row,.equip-slotline').forEach(n=>n.remove());
  const M=window.NS_MARKET; const eq=G.equipment;
  const w = (eq.equipped.mainhand && M) ? M.getEquipment(eq.equipped.mainhand) : null;
  const a = (eq.equipped.body && M) ? M.getEquipment(eq.equipped.body) : null;
  const slotLine=document.createElement('div'); slotLine.className='equip-slotline';
  slotLine.innerHTML =
    `<div class="equip-slot"><span class="equip-slot-k">\u2694 WEAPON</span><span class="equip-slot-v">${w?w.name:'\u2014 empty'}</span></div>`+
    `<div class="equip-slot"><span class="equip-slot-k">\u26e8 ARMOR</span><span class="equip-slot-v">${a?a.name:'\u2014 empty'}</span></div>`;
  host.appendChild(slotLine);
  const owned = (eq.owned||[]);
  if(!owned.length){
    const e=document.createElement('div'); e.className='equip-row equip-empty';
    e.textContent='No gear owned yet \u2014 visit the Marketplace to buy weapons & armor.';
    host.appendChild(e); return;
  }
  for(const id of owned){
    const it = M ? M.getEquipment(id) : null; if(!it) continue;
    const on = eq.equipped[it.slot]===id;
    const stat = it.type==='armor' ? `+${Math.round((it.effect.hpBonus||0)*100)}% HP`
                                   : `+${it.effect.atkBonus||0} ATK`;
    const row=document.createElement('div'); row.className='equip-row'+(on?' equipped':'');
    row.innerHTML =
      `<img class="equip-icon" src="${it.sprite}" alt="${it.name}" draggable="false" onerror="this.classList.add('missing')">`+
      `<div class="equip-info"><span class="equip-name">${it.name}</span>`+
      `<span class="equip-stat">${stat} \u00b7 ${it.type}</span></div>`+
      `<button class="equip-btn${on?' on':''}" data-equip="${id}">${on?'UNEQUIP':'EQUIP'}</button>`;
    host.appendChild(row);
  }
  host.querySelectorAll('[data-equip]').forEach(btn=>{
    btn.addEventListener('click',(ev)=>{
      ev.stopPropagation();
      const id=btn.getAttribute('data-equip'); const it=M?M.getEquipment(id):null; if(!it) return;
      if(G.equipment.equipped[it.slot]===id) unequipSlot(it.slot); else equipItem(id);
    });
  });
}
function setInvTab(tab){
  if(!G) return;
  G._invTab = tab;
  document.querySelectorAll('.inv-tab').forEach(b=>b.classList.toggle('active', b.getAttribute('data-tab')===tab));
  updateInventoryPanel();
}

function onInvToggle(){
  const panel=$('invPanel');
  panel.classList.toggle('hidden');
  if(!panel.classList.contains('hidden')) setInvTab(G && G._invTab ? G._invTab : 'loot');
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
let csLines=[], csIdx=0, csDone=null, csActive=false;
function cutscene(lines,onDone){
  G&&(G.paused=true);
  csLines=lines; csIdx=0; csDone=onDone||null; csActive=true;
  $('story').classList.remove('hidden');
  renderCS();
}
function renderCS(){ $('storyText').textContent=csLines[csIdx]; }
function onStoryNext(){
  csIdx++;
  if(csIdx>=csLines.length){
    $('story').classList.add('hidden');
    csActive=false;
    if(G) G.paused=false;
    const cb=csDone; csDone=null; if(cb) cb();
  } else renderCS();
}

// ---- tutorial (animated how-to-play, shown once before the first bunker) ----
const TUTORIAL_SLIDES = [
  { key:'move',   text:"Drag the stick to move. NULL_STATE plays itself otherwise — your hero attacks on its own the moment an enemy gets close." },
  { key:'attack', text:"That's it for combat — just stay close. No attack button to mash. Walk into trouble, your blade does the rest." },
  { key:'clear',  text:"Every hostile on a floor has to fall before the lift will take you deeper. Clear the floor — the lift unlocks the moment the last one drops." },
  { key:'ulti',   text:"Run is going badly, or a boss is in your face? A NULL_STRIKE prompt appears — sign it to channel real on-chain force into one devastating hit." },
];
let tutIdx = 0, tutDone = null;
function showTutorial(onDone){
  G&&(G.paused=true);
  tutIdx = 0; tutDone = onDone||null;
  $('tutorial').classList.remove('hidden');
  renderTutorial();
}
function renderTutorial(){
  const slide = TUTORIAL_SLIDES[tutIdx];
  $('tutorialText').textContent = slide.text;
  document.querySelectorAll('.ns-game-root .tut-slide').forEach(el=>{
    el.classList.toggle('hidden', el.dataset.slide!==slide.key);
  });
  document.querySelectorAll('.ns-game-root .tut-dot').forEach(el=>{
    el.classList.toggle('active', Number(el.dataset.i)===tutIdx);
  });
  $('tutorialNext').textContent = tutIdx>=TUTORIAL_SLIDES.length-1 ? '▾ let\'s go' : '▾ next';
}
function onTutorialNext(){
  tutIdx++;
  if(tutIdx>=TUTORIAL_SLIDES.length){
    $('tutorial').classList.add('hidden');
    if(G) G.paused=false;
    const cb=tutDone; tutDone=null; if(cb) cb();
  } else renderTutorial();
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
      `<div class="ds"><b>${p.celo.toFixed(2)}</b><span>USDm RECLAIMED</span></div>`;
    $('death').classList.remove('hidden');
    
    // [v0] Emit custom event with player stats for contract update
    window.dispatchEvent(new CustomEvent('nullstate-player-death', {
      detail: {
        xp: p.xp,
        level: p.level,
        kills: p.kills
      }
    }));
  },650);
}
function onRevive(){
  $('death').classList.add('hidden');
  if(!G){ newGame(selectedChar); updateHUD(); return; }
  const deathDepth = G.depth;
  const p = G.player;
  // Reset vitals only — floor progress, kills already made, decor already
  // broken, and any key already in the inventory are all preserved.
  p.hp = p.maxHp;
  p.iframe = 1.2;
  G.over = false;
  // Golden key rule: if it was never picked up, it relocates to a fresh
  // random floor and that floor's cached placement is cleared so it gets
  // re-rolled the next time that floor is (re)entered. If it WAS already
  // picked up, it just stays in the inventory — nothing to do.
  if(!G.key.taken){
    const newDepth = 1 + (Math.random()*Math.max(1,G.maxDepthReached)|0);
    G.key.depth = newDepth;
    G.key._pendingPlacement = true; // resolved lazily next time that floor is entered/re-entered
  }
  showLoadingTransition(() => {
    descend(deathDepth);
    cutscene(['You claw your way back from the NULL, gasping on the floor where you fell…'], ()=>updateHUD());
    updateHUD();
  }, ()=>{}, 'THE CHAIN PULLS YOU BACK…');
}



// ---- title / char select ----
let selectedChar='knight';
// Campaign progress — survives across dungeon sessions (unlike G, which is
// torn down and rebuilt each time newGame() runs for a fresh bunker).
let campaignActIndex = 0;
let campaignReturningFromBunker = false;
// draw a character preview at a CONSISTENT on-screen height by detecting the
// sprite's alpha bounding box (frame 0) and normalizing — so male & female match.
function drawPreview(elId, cfg){
  // knight now renders through the LPC compositor (see drawLPCPreview
  // below) so the char-select thumbnail can never drift out of sync with
  // the in-dungeon LPC hero — was previously always drawing the OLD
  // Pixel Crawler knight_idle sprite here regardless of useLPCHero,
  // which is what the stale comment above drawLPCComposite() in
  // entities.js already claimed was true but the code didn't actually do
  // (flagged as "drawPreview still gear-unaware" in NEXT-SESSION-PROMPT-v7,
  // fixed this session). rogue/wizzard have no LPC sheets yet, so they
  // keep using the original alpha-bbox-normalize path unchanged below.
  const A = window.NS_ASSETS;
  if(elId==='prevKnight' && A && A.LPC_HERO && A.img(A.LPC_HERO.idle.src)){
    drawLPCPreview(elId);
    return;
  }
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
// Knight-only LPC preview path. Mirrors the old function's alpha-bbox
// normalization (so knight/rogue/wizzard thumbnails all land at the same
// visual height in the char-select box) but measures the LPC BODY_male
// down-facing idle frame instead of the old knight sheet, then draws
// through the SAME drawLPCComposite() used by in-dungeon Player.draw() —
// no armor/weapon passed (opts.armorId/weaponId omitted) since no gear is
// equipped yet at char-select, before a run has even started.
function drawLPCPreview(elId){
  const host = $(elId);
  const A = window.NS_ASSETS;
  if(!host || !A || !A.LPC_HERO) return;
  const hero = A.LPC_HERO;
  const idleCfg = hero.idle;
  const im = A.img(idleCfg.src);
  if(!im) return;
  const {fw,fh} = idleCfg;
  const rows = idleCfg.rows||1;
  const dirIndex = 2; // down-facing, matches Player's default _lpcDir
  const row = rows>1 ? dirIndex : 0;
  const off=document.createElement('canvas'); off.width=fw; off.height=fh;
  const oc=off.getContext('2d'); oc.drawImage(im, 0,row*fh,fw,fh, 0,0,fw,fh);
  let data;
  try{ data=oc.getImageData(0,0,fw,fh).data; }catch(e){ return; }
  let minY=fh,maxY=0,found=false;
  for(let y=0;y<fh;y++)for(let x=0;x<fw;x++){
    if(data[(y*fw+x)*4+3]>24){ found=true; if(y<minY)minY=y; if(y>maxY)maxY=y; }
  }
  if(!found){ minY=0; maxY=fh-1; }
  const cH=maxY-minY+1;
  const BOX=88, TARGET=74, s=TARGET/cH;
  const dh=fh*s;
  const c=document.createElement('canvas'); c.width=BOX; c.height=BOX;
  const g=c.getContext('2d'); g.imageSmoothingEnabled=false;
  // drawLPCComposite already computes the sprite's top edge as cy-dh*foot
  // internally, so cy itself just needs to be the desired FEET baseline —
  // BOX-6, matching the old normalize path's bottom margin. (Passing
  // (BOX-6)+dh*foot here was double-applying the foot offset and pushed
  // the whole sprite below the visible 88px box — caught via a Playwright
  // canvas-pixel measurement that came back empty.)
  const cx=BOX/2, cy=BOX-6;
  drawLPCComposite(g, cx, cy, s, dirIndex, 0, { animKey:'idle', attacking:false, foot:hero.foot, alpha:1 });
  host.innerHTML=''; host.appendChild(c);
  host.style.cssText=`width:${BOX}px;height:${BOX}px;`;
}
function paintPreview(){
  drawPreview('prevKnight', HERO.knight);
  drawPreview('prevRogue', HERO.rogue);
  drawPreview('prevWizzard', HERO.wizzard);
}
function onCharBtn(e){
  const b=e.currentTarget;
  document.querySelectorAll('.ns-game-root .char-btn').forEach(x=>x.classList.remove('selected'));
  b.classList.add('selected'); selectedChar=b.dataset.char;
}
// (sound toggle now lives in the React Settings modal — see toggleSound() in the public API)
async function onStart(){
  A.start();
  $('startBtn').textContent='ENTERING…'; $('startBtn').disabled=true;
  // By the time the player has picked a character the full asset preload
  // kicked off at the very start of boot() has almost always finished
  // already; this only actually waits on a slow connection, and shows
  // "ENTERING…" instead of an unexplained pause. Falls back to calling
  // preloadAll() directly (loadImg caches by src, so this is cheap/no-op
  // for anything already loaded) on the off chance boot() hasn't reached
  // that line yet — belt-and-suspenders so gameplay can never start before
  // monster/decor art is ready.
  try{ await (_fullPreloadPromise || preloadAll()); }catch(e){}
  if(destroyed) return;
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');

  if (SAVED_SESSION) {
    enterSavedSession();
    return;
  }

  campaignActIndex = 0;
  campaignReturningFromBunker = false;
  enterOutdoorAct(campaignActIndex, false);
}

// Exact resume: skip the outdoor walk entirely, drop the player back into
// the bunker floor they saved on. Single-use — clear it now so a page
// reload without saving again can't replay this snapshot. Shared by the
// manual DESCEND flow (onStart) and the auto-resume "Continue" flow (boot).
function enterSavedSession(){
  selectedChar = SAVED_SESSION.charKey || selectedChar;
  campaignActIndex = SAVED_SESSION.campaignActIndex || 0;
  const snap = SAVED_SESSION;
  SAVED_SESSION = null;
  if (atkBtn) atkBtn.classList.remove('hidden');
  newGame(selectedChar, snap);
  cutscene(['You pick up right where you left off…'], () => updateHUD());
}

// ---- campaign / outdoor flow ----
function enterOutdoorAct(actIndex, resumeAtDoor){
  const heroCfg = HERO[selectedChar];
  Outdoor.enter(actIndex, CAMPAIGN, {
    heroCfg, charKey: selectedChar, resumeAtDoor, canvasWidth: cw,
    onReachDoor: onOutdoorReachedDoor,
  });
  if(atkBtn) atkBtn.classList.add('hidden');
}
function onOutdoorReachedDoor(){
  const act = CAMPAIGN[campaignActIndex];
  const isFirstBunker = campaignActIndex===0;
  showLoadingTransition(() => {
    Outdoor.exit();
    newGame(selectedChar);
    if(atkBtn) atkBtn.classList.remove('hidden');
    cutscene(act.preBunker, ()=>{
      updateHUD();
      if(isFirstBunker) showTutorial(()=>updateHUD());
    });
  }, ()=>{ if(G) G.paused=false; updateHUD(); }, `DESCENDING INTO ${act.title}…`);
}
// Called when the final boss (floor 5) of the current act's bunker falls —
// see onEnemyKilled(). Returns the player to THIS SAME act's outdoor scene
// (near the bunker door, not from the start of the strip) and plays the
// post-bunker dialog there. From that point the player is free to walk
// right again — which now advances to the NEXT act instead of re-entering
// this bunker (see enterOutdoorAct's resumeAtDoor + the "already cleared"
// door-trigger branch below).
function onActBunkerCleared(){
  const act = CAMPAIGN[campaignActIndex];
  showLoadingTransition(() => {
    G = null;
    Outdoor.enter(campaignActIndex, CAMPAIGN, {
      heroCfg: HERO[selectedChar], charKey: selectedChar, canvasWidth: cw,
      resumeAtDoor: true, // skip arrival speech bubbles, this act was already greeted
      bunkerCleared: true, // door now advances to the next act instead of re-entering
      onReachDoor: onOutdoorAdvanceToNextAct,
    });
  }, () => { cutscene(act.postBunker, ()=>{}); }, 'RETURNING TO THE SURFACE…');
}
function onOutdoorAdvanceToNextAct(){
  const finishedAct = CAMPAIGN[campaignActIndex];
  showLoadingTransition(() => {
    Outdoor.exit();
    campaignActIndex++;
    if(campaignActIndex >= CAMPAIGN.length){
      // Act I complete — no further acts authored yet. Hold here; the
      // campaign continues simply by appending new entries to CAMPAIGN
      // later, with no other code changes required.
      campaignActIndex = CAMPAIGN.length-1;
      enterOutdoorAct(campaignActIndex, true);
      return;
    }
    enterOutdoorAct(campaignActIndex, false);
  }, ()=>{}, `LEAVING ${finishedAct.title}…`);
}


// ---- attach DOM listeners (called in mount) ----
function attach(){
  winOn('resize', resize);
  winOn('keydown', onKeyDown);
  winOn('keyup', onKeyUp);
  // Safety net for the auto-resumed "Continue" flow (see boot()): that path
  // starts the run without the player ever clicking a DESCEND button, so
  // there's no guaranteed user-gesture for A.start() to ride on and the
  // browser's autoplay policy may leave the AudioContext suspended. Resume
  // it on the player's very first touch/click/keypress instead, same as any
  // other "tap to unmute" pattern.
  winOn('pointerdown', () => A.start(), { once: true });
  winOn('keydown', () => A.start(), { once: true });
  cv.addEventListener('mousedown', ()=>{ input.attack=1; });
  cv.addEventListener('mouseup', ()=>{ input.attack=0; });
  $('storyNext').addEventListener('click', onStoryNext);
  $('tutorialNext').addEventListener('click', onTutorialNext);
  $('reviveBtn').addEventListener('click', onRevive);
  $('actionBtn').addEventListener('click', onActionBtnClick);
  $('containerClose').addEventListener('click', closeContainerWindow);
  $('containerTakeAll').addEventListener('click', takeAllContainerSlots);
  $('burnConfirm').addEventListener('click', confirmBurn);
  $('itemZoomTake').addEventListener('click', onItemZoomTake);
  $('itemZoomBurn').addEventListener('click', onItemZoomBurn);
  $('itemZoomClose').addEventListener('click', closeItemZoom);
  document.querySelectorAll('.ns-game-root .char-btn').forEach(b=>b.addEventListener('click', onCharBtn));
  $('startBtn').addEventListener('click', onStart);
  $('invBtn').addEventListener('click', onInvToggle);
  $('invClose').addEventListener('click', onInvToggle);
  document.querySelectorAll('.inv-tab').forEach(b=>b.addEventListener('click', ()=>setInvTab(b.getAttribute('data-tab'))));
  $('liftCancel').addEventListener('click', onLiftCancel);
}

// debug hook (harmless; used for automated testing)
window.__NS = { get G(){ return G; },
  spawnNear(){ if(!G) return; const a=ARCHETYPES[0];
    G.enemies.push(new Enemy(a, G.player.x+50, G.player.y, G.depth, false)); },
  spawnElite(){ if(!G) return; const a=ARCHETYPES[0];
    G.enemies.push(new Enemy(a, G.player.x+120, G.player.y, G.depth, false, true)); },
  addDecor(t){ if(!G) return; G.decor.push(new Decor(t||'vase', G.player.x+40, G.player.y)); },
  onEnemyKilled, // debug-only: lets tests exercise act-completion without a full attack simulation
  get campaignActIndex(){ return campaignActIndex; } };

// ---- boot ----
// Full-game asset load (every monster/decor/background sprite) kept as a
// module-level promise so onStart() can await it directly if the player
// hits DESCEND before it's finished — see below.
//
// IMPORTANT: this is kicked off synchronously, as the very first thing
// boot() does, BEFORE the `await preloadHeroPreviews()` below. If it were
// assigned only after that await (as a prior version of this code did),
// there'd be a window — however small — where a player who hits DESCEND
// before boot() finishes preloading hero previews would find
// _fullPreloadPromise still null, skip the wait in onStart() entirely, and
// enter the dungeon before monster/decor art has loaded. Since a missing
// sprite draws as nothing rather than an error (see Anim.draw in
// entities.js), that showed up as the character (or other entities)
// silently vanishing from screen rather than any visible loading state.
let _fullPreloadPromise = null;
async function boot(){
  resize();
  $('titleLore').textContent=Story.title;
  setupTouch();
  _fullPreloadPromise = preloadAll();

  // "Continue" from the React Main Menu passes a saved bunker snapshot in
  // via mount({ savedSession }) — see DungeonGame.tsx. Previously this only
  // shortened what happened AFTER the player sat through the full
  // character-select/DESCEND title screen, which is why Continue still
  // forced players to re-pick a character every time even though the pick
  // was discarded a moment later in favor of the saved charKey. Now, when a
  // saved session exists, skip that screen entirely and drop the player
  // straight back into the exact bunker they left.
  if (SAVED_SESSION) {
    $('title').classList.add('hidden');
    $('hud').classList.remove('hidden');
    try { await _fullPreloadPromise; } catch(e) {}
    if (destroyed) return;
    rafId = requestAnimationFrame(frame);
    A.start(); // may be silently blocked by autoplay policy here since
               // there was no dedicated click right before this — see the
               // one-time pointerdown/keydown fallback registered in attach()
    enterSavedSession();
    return;
  }

  // Load ONLY the 3 hero idle sprites first so the character-select
  // previews appear almost immediately, instead of waiting on the full
  // preload above (all monsters, dungeon décor, backgrounds — several MB)
  // before the player even sees a hero. loadImg() caches by src, so this
  // doesn't re-fetch anything preloadAll() is already fetching.
  await preloadHeroPreviews();
  try{ await preloadLPCHero(); }catch(e){}
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
  WALLET_ADDRESS = opts.walletAddress || null;
  INITIAL_STATS = opts.initialStats || null;
  SAVED_SESSION = opts.savedSession || null;
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

// True once the player is actually inside a bunker run (not on the title
// screen or walking the outdoor overworld) — used by the React Settings
// modal to decide whether "Save Game" has anything to save.
function isInDungeon(){
  return !!(G && !G.over);
}

// Exact off-chain snapshot of the current bunker run. See applyRestoredState()
// for the matching restore path. Deliberately does NOT include the floor's
// generated layout/enemy positions (dungeon gen isn't seeded) — only the
// player's logical progress, so a resumed floor is regenerated fresh but the
// character, level, and inventory carry over exactly.
function getSaveSnapshot(){
  if(!isInDungeon()) return null;
  const p = G.player;
  return {
    charKey: selectedChar,
    campaignActIndex,
    depth: G.depth,
    maxDepthReached: G.maxDepthReached,
    xp: p.xp, level: p.level, kills: p.kills, celo: p.celo,
    hp: p.hp,
    inventory: {
      keys: G.inventory.keys, relics: G.inventory.relics, shards: G.inventory.shards,
      // Serialize the item stash as {id: qty} — the item's full definition
      // (name/rarity/icon/burnValue) is deterministic from its id via
      // NS_ITEMS.getItem(), so only id+qty need to survive a save/restore.
      items: Object.fromEntries(Object.entries(G.inventory.items||{}).map(([id,e])=>[id,e.qty])),
    },
    key: { depth: G.key.depth, taken: G.key.taken },
    savedAt: Date.now(),
  };
}

function toggleSound(){ return A.toggleMute(); }
function isSoundMuted(){ return A.muted; }
function setMusicVolume(v){ return A.setMusicVolume(v); }
function getMusicVolume(){ return A.musicVolume; }
function toggleSfx(){ return A.toggleSfx(); }
function isSfxEnabled(){ return A.sfxEnabled; }
// Called from DungeonGame.tsx whenever wagmi's wallet address changes
// (connect/disconnect/account switch) after the engine has already mounted,
// so nullstate-items-burned events always carry the CURRENT address.
function setWalletAddress(addr){ WALLET_ADDRESS = addr || null; }

return { mount, unmount, isInDungeon, getSaveSnapshot, toggleSound, isSoundMuted,
         setMusicVolume, getMusicVolume, toggleSfx, isSfxEnabled, setWalletAddress };
})();
