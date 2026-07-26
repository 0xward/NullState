'use client'

import { useEffect } from 'react'
import { MusicButton, useMusic } from '@/components/MusicController'

// ─── Landing hero ────────────────────────────────────────────────────────────
// Rebuilt 2026-07: the previous version read as a token/trading landing page —
// a neon glow orb over a data grid, a wordmark in a geometric sans, and a row of
// badges saying EARN REAL USDT / CELO MAINNET / MINIPAY NATIVE. Every one of
// those is a fintech signal. Someone arriving from a share link had no way to
// tell this was a pixel dungeon crawler until they pressed a button.
//
// What it is now: an outdoor scene from the game as the backdrop, dimmed and
// softened so it reads as atmosphere rather than a screenshot, the real logo,
// and two buttons. The game shows itself instead of describing itself.
//
// The 851KB background video is gone entirely — visuals AND audio. Music now
// comes from the engine's own synthesised bed (see components/MusicController),
// which is 21KB of code instead of most of a megabyte of stream, and is the
// same music the game plays, so the landing page and the dungeon no longer
// sound like two different products.

// An outdoor scene from the game rather than the world map: the map is the
// screen a player lands on AFTER pressing PLAY, so using it here spent the
// reveal before they had started. The treeline is also simply a better
// backdrop — depth, a horizon, and room for type to sit in the dark.
const BACKDROP = '/backgrounds/forest.webp'
const LOGO = '/logo-hero.webp'

export default function HeroSection() {
  // Shared with the world map and the dungeon: one music preference for the
  // whole product, stored in lib/gameSettings.
  const { muted, toggle } = useMusic()

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <section className="relative h-[100dvh] w-full flex flex-col items-center justify-center text-center px-6 overflow-hidden">
      {/* Backdrop: a real outdoor scene from the game, pushed back with
          brightness + blur so the type on top of it stays readable and it never
          competes for attention. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BACKDROP} alt="" aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: 'brightness(.46) saturate(.85) blur(2px)', transform: 'scale(1.06)' }}
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

      <MusicButton muted={muted} onToggle={toggle} style={{ position: 'fixed', top: 68, right: 16, zIndex: 60 }} />

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

        <div
          className="flex gap-3 items-center justify-center flex-wrap mt-9"
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
