/* ============================================================
   NULL_STATE :: DUNGEON  (procedural room+corridor generator)
   tile: 0=wall(void) 1=floor 2=stairs-down
   ============================================================ */
const TILE = 40; // world units per tile

function makeDungeon(depth){
  const W = 40 + Math.min(depth*2, 24);
  const H = 30 + Math.min(depth*2, 18);
  const g = Array.from({length:H},()=>new Array(W).fill(0));
  const rooms = [];
  const target = 6 + Math.min(depth, 8);
  let tries = 0;
  while(rooms.length < target && tries < 400){
    tries++;
    const rw = 4 + (Math.random()*7|0);
    const rh = 4 + (Math.random()*6|0);
    const rx = 1 + (Math.random()*(W-rw-2)|0);
    const ry = 1 + (Math.random()*(H-rh-2)|0);
    const r = {x:rx,y:ry,w:rw,h:rh,cx:(rx+rw/2)|0,cy:(ry+rh/2)|0};
    let overlap=false;
    for(const o of rooms){
      if(rx-1 < o.x+o.w+1 && rx+rw+1 > o.x-1 && ry-1 < o.y+o.h+1 && ry+rh+1 > o.y-1){overlap=true;break;}
    }
    if(overlap) continue;
    rooms.push(r);
    for(let y=ry;y<ry+rh;y++) for(let x=rx;x<rx+rw;x++) g[y][x]=1;
  }
  // connect rooms in order with L corridors
  for(let i=1;i<rooms.length;i++){
    const a=rooms[i-1], b=rooms[i];
    let x=a.cx, y=a.cy;
    const carve=(x,y)=>{ if(g[y]&&g[y][x]!==undefined){g[y][x]=g[y][x]||1; g[y][x]=1; if(g[y][x+1]!==undefined)g[y][x]=1;} };
    if(Math.random()<0.5){
      for(;x!==b.cx;x+=Math.sign(b.cx-x)){g[y][x]=1; if(g[y+1])g[y+1][x]=1;}
      for(;y!==b.cy;y+=Math.sign(b.cy-y)){g[y][x]=1; if(g[y][x+1]!==undefined)g[y][x+1]=1;}
    }else{
      for(;y!==b.cy;y+=Math.sign(b.cy-y)){g[y][x]=1; if(g[y][x+1]!==undefined)g[y][x+1]=1;}
      for(;x!==b.cx;x+=Math.sign(b.cx-x)){g[y][x]=1; if(g[y+1])g[y+1][x]=1;}
    }
  }
  const start = rooms[0];
  const last = rooms[rooms.length-1];
  g[last.cy][last.cx] = 2; // stairs

  // spawn points = floor centers of rooms except start
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
  return {
    W,H,grid:g,rooms,
    startPx:{x:(start.cx+0.5)*TILE, y:(start.cy+0.5)*TILE},
    stairsPx:{x:(last.cx+0.5)*TILE, y:(last.cy+0.5)*TILE},
    spawns,
    isWall(px,py){
      const tx=(px/TILE)|0, ty=(py/TILE)|0;
      if(tx<0||ty<0||tx>=W||ty>=H) return true;
      return g[ty][tx]===0;
    },
    pxW:W*TILE, pxH:H*TILE,
  };
}
window.NS_DUNGEON={makeDungeon,TILE};
