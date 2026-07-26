'use client'

import { useEffect, useRef, useState } from 'react'

// ─── Landing hero ────────────────────────────────────────────────────────────
// Rebuilt 2026-07: the previous version read as a token/trading landing page —
// a neon glow orb over a data grid, a wordmark in a geometric sans, and a row of
// badges saying EARN REAL USDT / CELO MAINNET / MINIPAY NATIVE. Every one of
// those is a fintech signal. Someone arriving from a share link had no way to
// tell this was a pixel dungeon crawler until they pressed a button.
//
// What it is now: the game's OWN world map as the backdrop, dimmed and softened
// so it reads as atmosphere rather than a screenshot (the owner's word was
// "disamarkan" — obscured), the knight standing on it, the real logo, and two
// buttons. The game shows itself instead of describing itself.
//
// The 851KB background video is gone from the visual layer. It stays as the
// music source but is now fetched ONLY when someone actually turns music on —
// previously every visitor downloaded it whether or not they ever heard it,
// which on a metered connection in the markets this game targets is most of a
// megabyte spent on nothing.

const MAP = '/worldmap/map-bg.webp'
const LOGO = '/logo-hero.webp'

export default function HeroSection() {
  const audioRef = useRef<HTMLVideoElement>(null)
  // Music stays off until asked for. The tap is also the user gesture browsers
  // require before audio may start, so there is no autoplay race to lose.
  const [musicOn, setMusicOn] = useState(false)
  // Set once music has been requested; until then the <video> has no <source>
  // and nothing is fetched.
  const [audioWanted, setAudioWanted] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const v = audioRef.current
    if (!v) return
    v.muted = !musicOn
    if (musicOn) v.play().catch(() => { /* gesture race — the next tap retries */ })
    else v.pause()
  }, [musicOn, audioWanted])

  const toggleMusic = () => {
    setAudioWanted(true)
    setMusicOn(prev => {
      const next = !prev
      try { localStorage.setItem('ns-landing-music', next ? '1' : '0') } catch { /* storage off */ }
      return next
    })
  }

  return (
    <section className="relative h-[100dvh] w-full flex flex-col items-center justify-center text-center px-6 overflow-hidden">
      {/* Backdrop: the world map the game actually opens on, pushed back with
          brightness + blur so the type on top of it stays readable and it never
          competes for attention. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MAP} alt="" aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: 'brightness(.34) saturate(.8) blur(3px)', transform: 'scale(1.06)' }}
      />

      {/* Drifting cloud banks. Two layers at different sizes and speeds moving
          in opposite directions, which is what stops a loop from reading as one
          repeating texture sliding past. Pure CSS gradients — no image, no JS,
          nothing extra to download — and they stop entirely under
          prefers-reduced-motion. */}
      <span className="ns-hero-cloud" aria-hidden="true" />
      <span className="ns-hero-cloud ns-hero-cloud-b" aria-hidden="true" />

      {/* Vignette — same treatment as the in-game map, so arriving at the game
          feels like the same place rather than a different product. Sits ABOVE
          the clouds so they stay a suggestion at the edges rather than
          something competing with the logo. */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(120% 70% at 50% 42%, transparent 42%, rgba(3,7,5,.86) 100%),' +
            'linear-gradient(0deg, #050b08 4%, transparent 34%),' +
            'linear-gradient(180deg, rgba(4,8,6,.8), transparent 22%)',
        }}
      />

      {/* Audio-only. No <source> until the toggle is pressed. */}
      <video ref={audioRef} loop playsInline preload="none" className="hidden" aria-hidden="true">
        {audioWanted && <source src="/video/hero-bg.mp4" type="video/mp4" />}
      </video>

      <button
        onClick={toggleMusic}
        aria-label={musicOn ? 'Mute music' : 'Play music'}
        className="fixed z-[60] flex items-center justify-center border transition-colors duration-200"
        style={{
          top: 68, right: 16, width: 40, height: 40,
          borderColor: 'rgba(57,255,154,0.35)',
          background: 'rgba(4,8,6,0.72)',
          color: musicOn ? '#4dffa6' : 'rgba(255,255,255,0.55)',
          clipPath: 'polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)',
        }}
      >
        {musicOn ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        )}
      </button>

      <div className="relative z-[2] flex w-full flex-col items-center">

        <p
          className="font-mono uppercase mb-5"
          style={{ fontSize: 10, letterSpacing: '5px', color: '#4e8f74', animation: 'fadeUp .6s .1s both' }}
        >
          {'// PIXEL DUNGEON CRAWLER'}
        </p>

        {/* 840px source for a 420px max display: exactly 2x, so a DPR-2 phone
            and a 1x desktop both get a clean downscale. The first pass shipped
            a 640px file, which meant the browser resampled an already-resampled
            image and the logo's pixel-art edges went soft. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO}
          alt="NullState"
          width={840} height={318}
          className="w-[min(78vw,420px)] h-auto"
          style={{ animation: 'fadeUp .6s .25s both', filter: 'drop-shadow(0 4px 22px rgba(0,0,0,.85))' }}
        />

        <p
          className="font-mono uppercase mt-2 max-w-[320px] sm:max-w-none"
          style={{ fontSize: 11, letterSpacing: '2.5px', color: '#8ea89d', animation: 'fadeUp .6s .45s both' }}
        >
          Crawl the bunkers. Crack the vault. Earn real USDT.
        </p>

        {/* The knight from the game, at 4x so the pixels stay square. He is the
            single clearest signal that this is a game and not a dashboard, so
            he sits between the promise and the button rather than off to one
            side — the eye passes over him on the way to PLAY. */}
        <span
          aria-hidden="true"
          className="ns-hero-knight mt-2"
          style={{ animation: 'fadeUp .6s .6s both' }}
        />

        <div
          className="flex gap-3 items-center justify-center flex-wrap mt-2"
          style={{ animation: 'fadeUp .6s .8s both' }}
        >
          <a
            href="/game"
            className="font-mono font-bold uppercase no-underline inline-flex items-center justify-center"
            style={{
              minHeight: 52, minWidth: 168, fontSize: 16, letterSpacing: '3px',
              color: '#04140c', background: '#39ff9a',
              border: '3px solid #0a3d24',
              boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.4), 0 0 22px rgba(57,255,154,.45)',
            }}
          >
            PLAY
          </a>
          <a
            href="/docs"
            className="font-mono uppercase no-underline inline-flex items-center justify-center"
            style={{
              minHeight: 52, minWidth: 168, fontSize: 12, letterSpacing: '2.5px',
              color: '#8ea89d', background: 'rgba(6,12,9,.72)',
              border: '2px solid rgba(255,255,255,.16)',
            }}
          >
            LEARN MORE
          </a>
        </div>

        <p
          className="font-mono uppercase mt-7"
          style={{ fontSize: 9, letterSpacing: '2px', color: '#4e6b5e', animation: 'fadeUp .6s 1s both' }}
        >
          Free to play · Built for MiniPay
        </p>
      </div>
    </section>
  )
}
