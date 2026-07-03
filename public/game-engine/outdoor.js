/* ============================================================
   NULL_STATE :: OUTDOOR  (side-scroll narrative scenes between bunkers)
   ------------------------------------------------------------
   A lightweight second "mode" alongside the dungeon: a static
   background, the player sprite walking left/right only (no
   up/down, no dungeon collision grid, NO camera scroll — the
   playable area is exactly the screen width), speech-bubble
   lines on arrival, and a glowing right-arrow trail guiding the
   player to the right edge of the screen, which is where the
   scene ends (no in-world door object — reaching the edge itself
   triggers the transition). Reuses the same Anim/Player rendering
   primitives as the dungeon so the character reads identically
   in both modes.
   ============================================================ */
window.NS_OUTDOOR = (function(){
  const { Anim } = window.NS_ENT;

  const GROUND_Y_FRAC = 0.5; // player's feet, as a fraction of canvas height — vertical middle of the screen
  const EDGE_MARGIN = 36; // how close to the literal screen edge the player can walk before being clamped/triggering the exit

  let state = null; // null when not in an outdoor scene

  function enter(actIndex, campaign, opts){
    const act = campaign[actIndex];
    state = {
      act, actIndex, campaign,
      heroCfg: opts.heroCfg, charKey: opts.charKey,
      // x is a SCREEN-space position (0..cw), not world-space — there is
      // no camera to scroll, the screen width IS the walkable strip.
      xFrac: opts.resumeAtDoor ? 0.78 : 0.12, // fraction of screen width, resolved to pixels in render()/update()
      facing: 1, walking: false,
      anim: new Anim(),
      phase: opts.resumeAtDoor ? 'free' : 'arrival', // 'arrival' -> speech bubbles play first
      arrivalIdx: 0, arrivalT: 0,
      bubble: null, bubbleT: 0,
      edgeTriggered: false,
      bunkerCleared: !!opts.bunkerCleared,
      onReachDoor: opts.onReachDoor, // callback into game.js to start the dark transition into the bunker (or to the next act, if bunkerCleared)
      lastCw: opts.canvasWidth || 360, // updated each render call; seeded from the real canvas width so there's no incorrect-width frame before the first render
    };
    state.anim.set(state.heroCfg.idle, 'idle');
    if(state.phase==='arrival') showNextArrival();
  }
  function exit(){ state = null; }
  function active(){ return !!state; }
  function currentBgKey(){ return state ? state.act.bg : null; }
  function isBlockingInput(){ return state && state.phase==='arrival'; }

  function showNextArrival(){
    const lines = state.act.arrival;
    if(state.arrivalIdx >= lines.length){
      state.phase = 'free';
      state.bubble = null;
      return;
    }
    state.bubble = lines[state.arrivalIdx];
    state.bubbleT = 2.6 + Math.min(2.5, lines[state.arrivalIdx].length*0.045);
    state.arrivalIdx++;
  }

  function update(dt, input){
    if(!state) return;
    const s = state;

    if(s.phase==='arrival'){
      s.bubbleT -= dt;
      s.anim.set(s.heroCfg.idle,'idle'); s.anim.update(dt);
      if(s.bubbleT<=0) showNextArrival();
      return;
    }

    // free walk — left/right only, in literal screen pixels (no camera)
    let mx = (input.right?1:0) - (input.left?1:0);
    s.walking = mx!==0;
    if(mx!==0) s.facing = mx;
    const sp = 150;
    const cw = s.lastCw;
    let px = s.xFrac*cw + mx*sp*dt;
    px = Math.max(EDGE_MARGIN, Math.min(cw-EDGE_MARGIN, px));
    s.xFrac = px/cw;

    if(s.walking){ s.anim.loop=true; s.anim.set(s.heroCfg.walk,'walk'); }
    else { s.anim.loop=true; s.anim.set(s.heroCfg.idle,'idle'); }
    s.anim.update(dt);

    // Reaching the literal edge triggers the transition immediately (the
    // normal path). As a safety net against any floating-point/timing edge
    // case that could keep px just shy of the exact boundary forever, also
    // track how long the player has been sitting in a wide "near edge"
    // band and force the transition after a couple of seconds there —
    // guarantees the player can never get permanently stuck unable to
    // enter the bunker.
    const nearEdge = px >= cw-EDGE_MARGIN-40;
    if(!s.edgeTriggered && nearEdge){
      s.nearEdgeT = (s.nearEdgeT||0) + dt;
      if(px >= cw-EDGE_MARGIN || s.nearEdgeT >= 2.0){
        s.edgeTriggered = true;
        s.onReachDoor && s.onReachDoor();
      }
    } else {
      s.nearEdgeT = 0;
    }
  }

  function render(ctx, cw, ch, bgImg){
    if(!state) return;
    const s = state;
    s.lastCw = cw;
    const px = s.xFrac*cw, py = ch*GROUND_Y_FRAC;

    // background — scaled to cover the canvas, no panning (static, since
    // there's no camera scroll in this redesign).
    if(bgImg){
      const scale = Math.max(cw/bgImg.width, ch/bgImg.height);
      const dw = bgImg.width*scale, dh = bgImg.height*scale;
      ctx.drawImage(bgImg, (cw-dw)/2, (ch-dh)/2, dw, dh);
    } else {
      ctx.fillStyle = '#0a1410'; ctx.fillRect(0,0,cw,ch);
    }
    // ground shadow strip so the character doesn't look like it's floating
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(0, py+18, cw, ch-py-18);

    // animated glowing right-arrow trail guiding the player toward the
    // right edge of the screen — replaces the old in-world door marker.
    if(!s.edgeTriggered && s.phase==='free'){
      drawArrowTrail(ctx, px, py, cw);
    }

    // player shadow + sprite
    ctx.save(); ctx.globalAlpha=0.35; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(px, py+6, 18, 6, 0, 0, 7); ctx.fill(); ctx.restore();
    s.anim.draw(ctx, px, py, s.heroCfg.scale, s.facing<0, s.heroCfg.foot, 1);

    // speech bubble above the player's head (arrival beats)
    if(s.bubble){
      drawSpeechBubble(ctx, px, py - 86, s.bubble, cw);
    }
  }

  // A trail of 3 chevron arrows between the player and the right edge of
  // the screen, pulsing/animating in sequence to read as "this way ->".
  function drawArrowTrail(ctx, px, py, cw){
    const rightEdge = cw - EDGE_MARGIN;
    const trailStart = px + 50;
    if(trailStart >= rightEdge - 20) return; // too close to the edge, arrows would overlap the player
    const count = 3;
    const span = rightEdge - trailStart;
    const t = performance.now()/1000;
    ctx.save();
    for(let i=0;i<count;i++){
      const baseX = trailStart + (span/count)*i + (span/count)*0.5;
      const pulse = (Math.sin(t*2.2 - i*0.8)+1)/2; // staggered pulse, travels left->right over time
      const alpha = 0.25 + pulse*0.55;
      const ax = baseX, ay = py;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#00ff88';
      ctx.beginPath();
      ctx.moveTo(ax-9, ay-11);
      ctx.lineTo(ax+5, ay);
      ctx.lineTo(ax-9, ay+11);
      ctx.lineTo(ax-3, ay);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSpeechBubble(ctx, x, y, text, cw){
    ctx.save();
    ctx.font = '12px "Share Tech Mono"';
    const maxW = Math.min(280, cw*0.7);
    const words = text.split(' ');
    const lines = []; let cur='';
    for(const w of words){
      const test = cur ? cur+' '+w : w;
      if(ctx.measureText(test).width > maxW && cur){ lines.push(cur); cur=w; }
      else cur = test;
    }
    if(cur) lines.push(cur);
    const lineH = 16, padX=12, padY=10;
    const boxW = Math.min(maxW, Math.max(...lines.map(l=>ctx.measureText(l).width))) + padX*2;
    const boxH = lines.length*lineH + padY*2;
    let bx = x - boxW/2; bx = Math.max(8, Math.min(cw-boxW-8, bx));
    const by = y - boxH;
    ctx.fillStyle = 'rgba(6,10,13,.88)';
    ctx.strokeStyle = 'rgba(0,255,136,.35)'; ctx.lineWidth=1;
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 6); else ctx.rect(bx,by,boxW,boxH);
    ctx.fill(); ctx.stroke();
    // little pointer tail toward the player
    ctx.beginPath();
    ctx.moveTo(x-6, by+boxH); ctx.lineTo(x+6, by+boxH); ctx.lineTo(x, by+boxH+8); ctx.closePath();
    ctx.fillStyle='rgba(6,10,13,.88)'; ctx.fill();
    ctx.fillStyle = '#cfeede'; ctx.textAlign='left'; ctx.textBaseline='top';
    lines.forEach((l,i)=> ctx.fillText(l, bx+padX, by+padY+i*lineH));
    ctx.restore();
  }

  return { enter, exit, active, isBlockingInput, currentBgKey, update, render };
})();
