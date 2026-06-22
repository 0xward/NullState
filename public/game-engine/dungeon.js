/* ============================================================
   NULL_STATE :: DUNGEON  (bunker-style grid generator)
   tile: 0=wall(void) 1=floor 2=stairs-down 3=door
   ------------------------------------------------------------
   Bunker layout instead of organic rooms+wide-zigzag-corridors:
   - Rooms are squarish, grid-aligned rectangles (Last Day on
     Earth bunker vibe: boxy cells, not free-form caves).
   - Rooms connect through a single straight 1-tile corridor per
     connection, with a door tile where the corridor meets each
     room's wall ring. No more 2-tile-wide diagonal corridors
     that blend straight into the room interior.
   - Every room keeps a full wall ring on all 4 sides except at
     its door openings.
   - The whole generation is wrapped in a connectivity check: if
     any room ends up unreachable from the start room (which can
     happen if a corridor's straight path gets blocked by another
     room), the floor is regenerated from scratch — cheap to do
     since it's all synchronous, and far simpler than patching
     partial corridors after the fact.
   ============================================================ */
const TILE = 40; // world units per tile

function tryMakeDungeon(depth){
  const W = 42 + Math.min(depth*2, 22);
  const H = 32 + Math.min(depth*2, 16);
  const g = Array.from({length:H},()=>new Array(W).fill(0));
  const rooms = [];
  const target = 6 + Math.min(depth, 7);
  let tries = 0;

  while(rooms.length < target && tries < 500){
    tries++;
    const rw = 5 + (Math.random()*4|0);          // 5-8 tiles
    const rh = 5 + (Math.random()*4|0);          // 5-8 tiles (close to rw -> boxy)
    const rx = 2 + (Math.random()*(W-rw-4)|0);
    const ry = 2 + (Math.random()*(H-rh-4)|0);
    const r = { x:rx, y:ry, w:rw, h:rh, cx:(rx+rw/2)|0, cy:(ry+rh/2)|0, id:rooms.length, visited:false, doors:[] };
    let overlap=false;
    for(const o of rooms){
      if(rx-2 < o.x+o.w+2 && rx+rw+2 > o.x-2 && ry-2 < o.y+o.h+2 && ry+rh+2 > o.y-2){ overlap=true; break; }
    }
    if(overlap) continue;
    rooms.push(r);
    for(let y=ry; y<ry+rh; y++) for(let x=rx; x<rx+rw; x++) g[y][x]=1;
  }
  if(rooms.length < 3) return null; // too sparse, retry generation entirely

  const doors = [];
  const inBounds=(x,y)=> x>=0&&y>=0&&x<W&&y<H;

  // Straight 1-tile corridor between two points that are already aligned
  // on one axis (caller guarantees this — see connect()). Carves through
  // ANY tile in the way (including other rooms' walls) so connectivity is
  // guaranteed; the post-generation flood-fill check catches the rare case
  // where this still isn't enough and triggers a full regeneration instead
  // of trying to patch it.
  function carveStraight(ax,ay,bx,by){
    let x=ax,y=ay;
    while(true){
      if(inBounds(x,y) && g[y][x]===0) g[y][x]=1;
      if(x===bx && y===by) break;
      x += Math.sign(bx-x);
      y += Math.sign(by-y);
    }
  }

  // Pick a door point on room's wall ring, on the side facing (tx,ty),
  // and the corridor-start tile just outside that door.
  function doorTowards(room, tx, ty){
    const dx = tx-room.cx, dy = ty-room.cy;
    let dpx, dpy, outx, outy, side;
    if(Math.abs(dx) >= Math.abs(dy)){
      if(dx>=0){ dpx=room.x+room.w; outx=dpx+1; side='E'; } else { dpx=room.x-1; outx=dpx-1; side='W'; }
      dpy = Math.max(room.y+1, Math.min(room.y+room.h-2, room.cy));
      outy = dpy;
    } else {
      if(dy>=0){ dpy=room.y+room.h; outy=dpy+1; side='S'; } else { dpy=room.y-1; outy=dpy-1; side='N'; }
      dpx = Math.max(room.x+1, Math.min(room.x+room.w-2, room.cx));
      outx = dpx;
    }
    return { doorX:dpx, doorY:dpy, outX:outx, outY:outy, side };
  }

  function connect(roomA, roomB){
    const dA = doorTowards(roomA, roomB.cx, roomB.cy);
    const dB = doorTowards(roomB, roomA.cx, roomA.cy);
    if(!inBounds(dA.doorX,dA.doorY) || !inBounds(dB.doorX,dB.doorY)) return;
    g[dA.doorY][dA.doorX]=3;
    g[dB.doorY][dB.doorX]=3;
    roomA.doors.push({x:dA.doorX,y:dA.doorY,side:dA.side});
    roomB.doors.push({x:dB.doorX,y:dB.doorY,side:dB.side});
    doors.push({x:dA.doorX,y:dA.doorY,side:dA.side,roomA:roomA.id,roomB:roomB.id});
    doors.push({x:dB.doorX,y:dB.doorY,side:dB.side,roomA:roomA.id,roomB:roomB.id});
    // corridor: go from just-outside-A, axis-align, then to just-outside-B
    let cx=dA.outX, cy=dA.outY;
    if(inBounds(cx,cy) && g[cy][cx]===0) g[cy][cx]=1;
    // move to share one coordinate with B's outside point, then straight in
    if(cx===dB.outX || cy===dB.outY){
      carveStraight(cx,cy, dB.outX,dB.outY);
    } else {
      // bend once: travel along the axis the door faces first
      const midX = (dA.outX!==dA.doorX) ? cx : dB.outX; // if A's door faces E/W, keep A's x first
      const midY = (dA.outY!==dA.doorY) ? cy : dB.outY;
      carveStraight(cx,cy, midX,midY);
      carveStraight(midX,midY, dB.outX,dB.outY);
    }
    if(inBounds(dB.outX,dB.outY) && g[dB.outY][dB.outX]===0) g[dB.outY][dB.outX]=1;
  }

  for(let i=1;i<rooms.length;i++) connect(rooms[i-1], rooms[i]);

  const start = rooms[0];
  const last = rooms[rooms.length-1];
  g[last.cy][last.cx] = 2;
  start.visited = true;

  // connectivity check via flood fill from the start room's center
  const seen = Array.from({length:H},()=>new Array(W).fill(false));
  const stack=[[start.cx,start.cy]];
  while(stack.length){
    const [x,y]=stack.pop();
    if(!inBounds(x,y) || seen[y][x] || g[y][x]===0) continue;
    seen[y][x]=true;
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  for(const r of rooms){ if(!seen[r.cy][r.cx]) return null; } // disconnected -> caller retries

  const spawns=[];
  for(let i=1;i<rooms.length;i++){
    const r=rooms[i];
    const n = 1 + Math.min((Math.random()* (1+depth/3))|0, 3);
    for(let k=0;k<n;k++){
      spawns.push({
        x:(r.x + 0.5 + Math.random()*(r.w-1))*TILE,
        y:(r.y + 0.5 + Math.random()*(r.h-1))*TILE,
      });
    }
  }

  function roomAt(tx,ty){
    for(const r of rooms){
      if(tx>=r.x && tx<r.x+r.w && ty>=r.y && ty<r.y+r.h) return r;
    }
    return null;
  }
  const doorBySpot = {};
  for(const dr of doors) doorBySpot[dr.x+','+dr.y] = dr;
  function doorAt(tx,ty){ return doorBySpot[tx+','+ty] || null; }

  return {
    W,H,grid:g,rooms,doors,
    startPx:{x:(start.cx+0.5)*TILE, y:(start.cy+0.5)*TILE},
    stairsPx:{x:(last.cx+0.5)*TILE, y:(last.cy+0.5)*TILE},
    spawns,
    isWall(px,py){
      const tx=(px/TILE)|0, ty=(py/TILE)|0;
      if(tx<0||ty<0||tx>=W||ty>=H) return true;
      return g[ty][tx]===0;
    },
    roomAt,
    doorAt,
    pxW:W*TILE, pxH:H*TILE,
  };
}

function makeDungeon(depth){
  for(let attempt=0; attempt<25; attempt++){
    const d = tryMakeDungeon(depth);
    if(d) return d;
  }
  // Extremely unlikely fallback: a single big safe room rather than
  // ever failing to produce a floor at all.
  const W=20,H=16;
  const g = Array.from({length:H},()=>new Array(W).fill(1));
  for(let x=0;x<W;x++){ g[0][x]=0; g[H-1][x]=0; }
  for(let y=0;y<H;y++){ g[y][0]=0; g[y][W-1]=0; }
  g[H-2][W-2]=2;
  const room={x:1,y:1,w:W-2,h:H-2,cx:(W/2)|0,cy:(H/2)|0,id:0,visited:true,doors:[]};
  return {
    W,H,grid:g,rooms:[room],doors:[],
    startPx:{x:TILE*2,y:TILE*2}, stairsPx:{x:(W-2.5)*TILE,y:(H-2.5)*TILE},
    spawns:[{x:TILE*(W/2),y:TILE*(H/2)}],
    isWall(px,py){ const tx=(px/TILE)|0,ty=(py/TILE)|0; if(tx<0||ty<0||tx>=W||ty>=H) return true; return g[ty][tx]===0; },
    roomAt(){ return room; },
    doorAt(){ return null; },
    pxW:W*TILE, pxH:H*TILE,
  };
}
window.NS_DUNGEON={makeDungeon,TILE};
