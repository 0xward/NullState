'use client'

import { useEffect, useState } from 'react'

// Boot splash (owner request): whenever the app is opened, show a deep-black
// screen with the NULL STATE logo, a short play-to-earn jargon line, and a
// smooth white loading bar for 2.5s — THEN reveal the page underneath.
//
// Lives in the root layout so it covers any entry route (landing, /game deep
// link from MiniPay, etc.). It renders on top of {children}; the page loads
// normally behind it and is simply revealed when the splash fades out. The
// logo is a 39KB webp (public/brand/nullstate-logo.webp, compressed from the
// 2.7MB source) and is centred with object-fit so it fits both a tall phone
// and a wide desktop without distortion — the image's own dark background
// blends into the black fill on every aspect ratio.
const HOLD_MS = 2500
const FADE_MS = 500
// Show the splash only ONCE per browser session. Clicking "Launch Game" on the
// landing is a full navigation to /game, which reloads the document and would
// otherwise replay the splash — the owner only wants it at the very start.
// sessionStorage resets when the app/tab is opened fresh, so a new open still
// shows it; internal navigations within the same session don't.
const SEEN_KEY = 'ns-splash-seen'

export default function SplashScreen() {
  const [phase, setPhase] = useState<'show' | 'fading' | 'gone'>('show')

  useEffect(() => {
    let alreadySeen = false
    try {
      alreadySeen = sessionStorage.getItem(SEEN_KEY) === '1'
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* storage blocked — just show it, no worse than before */
    }
    if (alreadySeen) {
      setPhase('gone')
      return
    }
    const t1 = setTimeout(() => setPhase('fading'), HOLD_MS)
    const t2 = setTimeout(() => setPhase('gone'), HOLD_MS + FADE_MS)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  if (phase === 'gone') return null

  return (
    <div
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
          Crack the vault. Earn real stablecoin.
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
