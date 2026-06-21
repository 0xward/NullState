/* ============================================================
   NULL_STATE :: OUTDOOR  (side-scroll narrative scenes between bunkers)
   ------------------------------------------------------------
   A lightweight second "mode" alongside the dungeon: a static
   background, the player sprite walking left/right only (no
   up/down, no dungeon collision grid), speech-bubble lines on
   arrival, and a dialog-box beat right before the bunker door.
   Reuses the same Anim/Player rendering primitives as the dungeon
   so the character reads identically in both modes.
   ============================================================ */
window.NS_OUTDOOR = (function(){
  const { Anim } = window.NS_ENT;

  // World is a simple 1D strip: x in [0, WORLD_W]. The bunker door sits
  // near the right edge; walking into its trigger zone advances the act.
  const WORLD_W = 1400;
  const DOOR_X = WORLD_W - 160;
  const GROUND_Y_FRAC = 0.82; // player's feet, as a fraction of canvas height

  let state = null; // null when not in an outdoor scene

  function enter(actIndex, campaign, opts){
    const act = campaign[actIndex];
    state = {
      act, actIndex, campaign,
      heroCfg: opts.heroCfg, charKey: opts.charKey,
      x: opts.resumeAtDoor ? DOOR_X-90 : 80, facing: 1, walking: false,
      anim: new Anim(),
      phase: opts.resumeAtDoor ? 'free' : 'arrival', // 'arrival' -> speech bubbles play first
      arrivalIdx: 0, arrivalT: 0,
      bubble: null, bubbleT: 0,
      doorTriggered: false,
      bunkerCleared: !!opts.bunkerCleared,
      onReachDoor: opts.onReachDoor, // callback into game.js to start the dark transition into the bunker (or to the next act, if bunkerCleared)
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

    // free walk — left/right only
    let mx = (input.right?1:0) - (input.left?1:0);
    s.walking = mx!==0;
    if(mx!==0) s.facing = mx;
    const sp = 150;
    s.x = Math.max(20, Math.min(WORLD_W-20, s.x + mx*sp*dt));

    if(s.walking){ s.anim.loop=true; s.anim.set(s.heroCfg.walk,'walk'); }
    else { s.anim.loop=true; s.anim.set(s.heroCfg.idle,'idle'); }
    s.anim.update(dt);

    if(!s.doorTriggered && s.x > DOOR_X){
      s.doorTriggered = true;
      s.onReachDoor && s.onReachDoor();
    }
  }

  function render(ctx, cw, ch, bgImg){
    if(!state) return;
    const s = state;
    // camera: keep the player roughly centered, clamped to world bounds
    const camX = Math.max(cw/2, Math.min(WORLD_W-cw/2, s.x));
    const offsetX = cw/2 - camX;

    // background — drawn to cover the canvas height, repeated/clamped
    // horizontally isn't needed since the world is a fixed short strip
    // narrower than most backgrounds are wide at this scale; we just
    // scale the image to cover and let it pan with offsetX capped above.
    if(bgImg){
      const scale = Math.max(cw/bgImg.width, ch/bgImg.height);
      const dw = bgImg.width*scale, dh = bgImg.height*scale;
      const bgPanX = (offsetX*0.35); // subtle parallax: background moves slower than the player
      ctx.drawImage(bgImg, (cw-dw)/2 + bgPanX*0, (ch-dh)/2, dw, dh);
    } else {
      ctx.fillStyle = '#0a1410'; ctx.fillRect(0,0,cw,ch);
    }
    // ground shadow strip so the character doesn't look like it's floating
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(0, ch*GROUND_Y_FRAC+18, cw, ch*(1-GROUND_Y_FRAC));

    const px = s.x + offsetX, py = ch*GROUND_Y_FRAC;

    // bunker door marker near the right edge of the world
    const doorScreenX = DOOR_X + offsetX;
    if(doorScreenX > -80 && doorScreenX < cw+80){
      ctx.save();
      ctx.translate(doorScreenX, py);
      ctx.fillStyle = '#1a2430'; ctx.fillRect(-22,-58,44,58);
      ctx.fillStyle = '#0e1620'; ctx.fillRect(-16,-50,32,50);
      ctx.fillStyle = 'rgba(0,255,136,.5)'; ctx.fillRect(-16,-50,32,2);
      ctx.restore();
      if(!s.doorTriggered && s.phase==='free'){
        ctx.save();
        ctx.globalAlpha = 0.6+0.3*Math.sin(performance.now()/300);
        ctx.fillStyle = '#00ff88'; ctx.font='11px "Share Tech Mono"'; ctx.textAlign='center';
        ctx.fillText(s.bunkerCleared ? '▸ keep walking ▸' : '▸ walk to the bunker ▸', doorScreenX, py-72);
        ctx.restore();
      }
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

  return { enter, exit, active, isBlockingInput, currentBgKey, update, render, WORLD_W, DOOR_X };
})();
