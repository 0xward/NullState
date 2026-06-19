/* ============================================================
   NULL_STATE :: AUDIO ENGINE  (Web Audio synthesized)
   - Calming evolving ambient pad loop (dungeon-ish)
   - SFX: attack, hit, enemy death, levelup, descend, pickup, hurt
   ============================================================ */
const Audio = (() => {
  let ctx = null;
  let master = null, musicGain = null, sfxGain = null;
  let started = false, muted = false;
  let padTimer = null;

  // soft reverb via convolver (synthetic impulse)
  let reverb = null;
  function makeReverb(seconds = 2.6, decay = 2.4) {
    const rate = ctx.sampleRate, len = rate * seconds;
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    const c = ctx.createConvolver(); c.buffer = buf; return c;
  }

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    reverb = makeReverb();
    const revGain = ctx.createGain(); revGain.gain.value = 0.32;
    reverb.connect(revGain); revGain.connect(master);

    musicGain = ctx.createGain(); musicGain.gain.value = 0.0; // fade in
    musicGain.connect(master); musicGain.connect(reverb);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.85;
    sfxGain.connect(master); sfxGain.connect(reverb);
  }

  // ---- ambient music: slow minor pad arpeggio + drone ----
  // A minor-ish calm set
  const SCALE = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; // A C D E G A C
  function padNote(freq, t, dur, vol) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    const g = ctx.createGain(), f = ctx.createBiquadFilter();
    o1.type = 'triangle'; o2.type = 'sine';
    o1.frequency.value = freq; o2.frequency.value = freq * 2.003; // slight detune shimmer
    f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.6;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o1.connect(g); o2.connect(g); g.connect(f); f.connect(musicGain);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  function drone(freq, t, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = 320;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 2);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(f); f.connect(musicGain);
    o.start(t); o.stop(t + dur + 0.1);
  }

  let step = 0;
  function scheduleBar() {
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    // arpeggio of 4 soft notes spread over ~6.4s
    const base = SCALE[step % SCALE.length];
    drone(110, t, 7.0);
    for (let i = 0; i < 4; i++) {
      const n = SCALE[(step + i * 2) % SCALE.length];
      padNote(n, t + i * 1.6, 2.6, 0.12);
    }
    // occasional high shimmer
    if (Math.random() < 0.5) padNote(SCALE[6] * 2, t + 3.2, 3.0, 0.05);
    step++;
  }
  function startMusic() {
    if (padTimer) return;
    scheduleBar();
    padTimer = setInterval(scheduleBar, 6400);
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(muted ? 0 : 0.5, ctx.currentTime + 4);
  }

  // ---- SFX helpers ----
  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function noise(dur) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = buf; return s;
  }

  function attack() {
    if (!ctx) return; const t = ctx.currentTime;
    // whoosh
    const n = noise(0.22), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(420, t + 0.2);
    env(g, t, 0.01, 0.2, 0.5); n.connect(f); f.connect(g); g.connect(sfxGain); n.start(t); n.stop(t + 0.25);
    // blade ring
    const o = ctx.createOscillator(), g2 = ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(640, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    env(g2, t, 0.005, 0.13, 0.18); o.connect(g2); g2.connect(sfxGain); o.start(t); o.stop(t + 0.16);
  }
  function hit() {
    if (!ctx) return; const t = ctx.currentTime;
    const n = noise(0.16), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1400; env(g, t, 0.005, 0.14, 0.55);
    n.connect(f); f.connect(g); g.connect(sfxGain); n.start(t); n.stop(t + 0.18);
    const o = ctx.createOscillator(), g2 = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.14);
    env(g2, t, 0.005, 0.14, 0.4); o.connect(g2); g2.connect(sfxGain); o.start(t); o.stop(t + 0.18);
  }
  function hurt() {
    if (!ctx) return; const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
    env(g, t, 0.005, 0.26, 0.3); o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.3);
  }
  function enemyDeath() {
    if (!ctx) return; const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.45);
    f.type = 'lowpass'; f.frequency.setValueAtTime(2000, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.4);
    env(g, t, 0.01, 0.45, 0.3); o.connect(f); f.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.5);
    const n = noise(0.4), gn = ctx.createGain(); env(gn, t, 0.01, 0.4, 0.2);
    n.connect(gn); gn.connect(sfxGain); n.start(t); n.stop(t + 0.42);
  }
  function pickup() {
    if (!ctx) return; const t = ctx.currentTime;
    [880, 1320].forEach((fr, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = fr;
      env(g, t + i * 0.06, 0.005, 0.18, 0.22); o.connect(g); g.connect(sfxGain);
      o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.2);
    });
  }
  function levelup() {
    if (!ctx) return; const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((fr, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = fr;
      env(g, t + i * 0.09, 0.01, 0.3, 0.25); o.connect(g); g.connect(sfxGain);
      o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.32);
    });
  }
  function descend() {
    if (!ctx) return; const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(440, t); o.frequency.exponentialRampToValueAtTime(110, t + 1.0);
    env(g, t, 0.02, 1.0, 0.3); o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 1.1);
  }

  function breakProp(){
    if(!ctx) return; const t=ctx.currentTime;
    const n=noise(0.22), g=ctx.createGain(), f=ctx.createBiquadFilter();
    f.type='highpass'; f.frequency.value=900; env(g,t,0.005,0.2,0.5);
    n.connect(f); f.connect(g); g.connect(sfxGain); n.start(t); n.stop(t+0.24);
    [520,330].forEach((fr,i)=>{ const o=ctx.createOscillator(),gg=ctx.createGain();
      o.type='triangle'; o.frequency.setValueAtTime(fr,t); o.frequency.exponentialRampToValueAtTime(fr*0.5,t+0.12);
      env(gg,t+i*0.02,0.005,0.12,0.18); o.connect(gg); gg.connect(sfxGain); o.start(t+i*0.02); o.stop(t+0.16);});
  }
  function ultiBlast(){
    if(!ctx) return; const t=ctx.currentTime;
    // charge swell
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type='sawtooth'; o.frequency.setValueAtTime(110,t); o.frequency.exponentialRampToValueAtTime(880,t+0.35);
    env(g,t,0.2,0.45,0.3); o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.5);
    // impact
    const t2=t+0.36;
    const n=noise(0.5), gn=ctx.createGain(), f=ctx.createBiquadFilter();
    f.type='lowpass'; f.frequency.setValueAtTime(4000,t2); f.frequency.exponentialRampToValueAtTime(200,t2+0.45);
    env(gn,t2,0.005,0.5,0.6); n.connect(f); f.connect(gn); gn.connect(sfxGain); n.start(t2); n.stop(t2+0.52);
    [330,440,550].forEach((fr,i)=>{ const oo=ctx.createOscillator(),gg=ctx.createGain();
      oo.type='square'; oo.frequency.setValueAtTime(fr,t2); oo.frequency.exponentialRampToValueAtTime(fr*0.4,t2+0.4);
      env(gg,t2+i*0.03,0.005,0.4,0.22); oo.connect(gg); gg.connect(sfxGain); oo.start(t2+i*0.03); oo.stop(t2+0.45);});
  }

  function start() { // call on first user gesture
    init();
    if (ctx.state === 'suspended') ctx.resume();
    if (!started) { started = true; startMusic(); }
  }
  function toggleMute() {
    muted = !muted;
    if (musicGain) musicGain.gain.linearRampToValueAtTime(muted ? 0 : 0.5, ctx.currentTime + 0.3);
    if (sfxGain) sfxGain.gain.value = muted ? 0 : 0.85;
    return muted;
  }
  return { start, toggleMute, attack, hit, hurt, enemyDeath, pickup, levelup, descend,
           breakProp, ultiBlast,
           get muted(){return muted;} };
})();
window.Audio2 = Audio;
