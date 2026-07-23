'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

// Boot splash (owner request): the deep-black NULL STATE logo screen with a
// play-to-earn line and a 2.5s white loading bar, shown ONLY at the very start.
//
// Two guards keep it to the very first open and nowhere else:
//  1. ROUTE — it only ever renders on the landing ('/') and the game route
//     ('/game'). Docs, Terms and Privacy structurally never render it, so
//     navigating to those pages can NEVER flash the splash, regardless of
//     caching or SSR. This is the real fix for "loading still shows on Terms/
//     Privacy/Docs".
//  2. SESSION — once shown, a sessionStorage flag suppresses it for the rest of
//     the session, so Launch Game (/ -> /game full navigation) doesn't replay
//     it. A tiny read-only script in the head (app/layout.tsx) also adds
//     `ns-splash-seen` to <html> so CSS can hide it before first paint on that
//     second load, avoiding even a one-frame flash.
//
// Logo: 39KB webp (public/brand/nullstate-logo.webp), centred with object-fit
// so it fits a tall phone and a wide desktop; its dark backdrop blends to black.
const HOLD_MS = 2500
const FADE_MS = 500
const SEEN_KEY = 'ns-splash-seen'

export default function SplashScreen() {
  const pathname = usePathname()
  const onSplashRoute = pathname === '/' || pathname === '/game' || (pathname?.startsWith('/game/') ?? false)
  const [phase, setPhase] = useState<'show' | 'fading' | 'gone'>('show')

  useEffect(() => {
    if (!onSplashRoute) { setPhase('gone'); return }
    let seen = false
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1'
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch { /* storage blocked — just show it */ }
    if (seen) { setPhase('gone'); return }
    const t1 = setTimeout(() => setPhase('fading'), HOLD_MS)
    const t2 = setTimeout(() => setPhase('gone'), HOLD_MS + FADE_MS)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [onSplashRoute])

  if (!onSplashRoute || phase === 'gone') return null

  return (
    <div
      id="ns-splash-root"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        padding: 24,
        opacity: phase === 'fading' ? 0 : 1,
        pointerEvents: phase === 'fading' ? 'none' : 'auto',
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      <style>{`@keyframes nsSplashBar{from{width:0%}to{width:100%}}@keyframes nsSplashIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>

      {/* Logo — responsive, keeps the dark-grid backdrop which blends to black */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/nullstate-logo.webp"
        alt="NULL STATE"
        style={{
          width: 'min(80vw, 460px)',
          height: 'auto',
          objectFit: 'contain',
          animation: 'nsSplashIn 0.5s ease both',
        }}
      />

      {/* Jargon */}
      <div style={{ textAlign: 'center', animation: 'nsSplashIn 0.6s 0.15s ease both' }}>
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 13,
            letterSpacing: 5,
            fontWeight: 700,
            color: '#4dffa6',
            textShadow: '0 0 14px rgba(0,255,136,0.45)',
          }}
        >
          PLAY TO EARN
        </div>
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 10,
            letterSpacing: 2,
            marginTop: 6,
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          Crack the vault. Earn real USDT.
        </div>
      </div>

      {/* Smooth white loading bar — fills over the hold duration */}
      <div
        style={{
          width: 'min(60vw, 220px)',
          height: 3,
          marginTop: 4,
          borderRadius: 3,
          background: 'rgba(255,255,255,0.14)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: '0%',
            background: '#fff',
            borderRadius: 3,
            boxShadow: '0 0 10px rgba(255,255,255,0.7)',
            animation: `nsSplashBar ${HOLD_MS}ms linear forwards`,
          }}
        />
      </div>
    </div>
  )
}
