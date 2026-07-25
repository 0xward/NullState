'use client'

import { useState } from 'react'
import { useWallet } from '@/lib/WalletProvider'
import { maskAddress } from '@/lib/addressMask'
import { PlayerProfile } from '@/lib/contract'

// ─── World-Map Hub (Phase 1 — behind a feature flag) ─────────────────────────
// A game-style landing that REPLACES MainMenu when enabled (?hub=1 or
// NEXT_PUBLIC_WORLDMAP_HUB=1). It is a pure UI-layer swap: it takes the exact
// same props as MainMenu and calls the SAME handlers, so every downstream
// screen (Marketplace, Rewards, Crafting, the game, …) is untouched.
//
// Visual reference: docs/WORLD-MAP-HUB-PLAN.md + the published mock (v5).
// Assets live in public/worldmap/ (map-bg.webp, hatch.webp, icons/*).
//
// SCOPE (Phase 1): map backdrop + side-rails wired to real handlers + a MASUK
// (Continue / New Game) action + an overflow ≡ MENU that keeps the MiniPay-
// required Support / Terms / Privacy links reachable from the first screen.
// DEFERRED (Phase 2): per-bunker node lock/cleared state (needs campaign
// progress data). (Phase 3): the Daily Run gacha. Those are intentionally not
// faked here — no wrong states, no fake currency values.

interface WorldMapHubProps {
  onContinueGame: (profile: PlayerProfile) => void
  onNewGame: () => void
  onLeaderboard: () => void
  onRewards: () => void
  onReferral: () => void
  onMintPass: () => void
  onMarketplace: () => void
  onCrafting: () => void
  onHowToPlay: () => void
  playerProfile: PlayerProfile | null
  isLoadingProfile: boolean
}

const MAP = '/worldmap/map-bg.webp'
const IC = (n: string) => `/worldmap/icons/${n}.png`

function RailBtn({
  icon,
  label,
  onClick,
  hot = false,
  badge,
}: {
  icon: string
  label: string
  onClick: () => void
  hot?: boolean
  badge?: string
}) {
  return (
    <button
      onClick={onClick}
      className="relative block w-[52px] text-center"
      style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.7))' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={icon}
        alt={label}
        width={46}
        height={46}
        style={{
          width: 46,
          height: 46,
          display: 'block',
          margin: '0 auto',
          imageRendering: 'pixelated',
          filter: hot ? 'drop-shadow(0 0 7px rgba(255,207,77,.65))' : undefined,
        }}
      />
      <span
        className="block font-mono uppercase"
        style={{ fontSize: 8, letterSpacing: '.3px', color: '#e2efe9', marginTop: 1, textShadow: '0 1px 2px #000' }}
      >
        {label}
      </span>
      {badge && (
        <span
          className="absolute font-mono font-extrabold"
          style={{
            top: -2, right: 3, minWidth: 15, height: 15, padding: '0 3px', fontSize: 8,
            background: badge === 'SOON' ? '#7a5a1f' : '#ff5a6a', color: badge === 'SOON' ? '#ffcf4d' : '#fff',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid #000',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

export default function WorldMapHub({
  onContinueGame,
  onNewGame,
  onLeaderboard,
  onRewards,
  onReferral,
  onMintPass,
  onMarketplace,
  onCrafting,
  onHowToPlay,
  playerProfile,
  isLoadingProfile,
}: WorldMapHubProps) {
  const { realAddress } = useWallet()
  const hasSave = !!playerProfile?.isRegistered
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  const primaryAction = () => {
    if (hasSave) onContinueGame(playerProfile!)
    else onNewGame()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden ns-fade-in" style={{ background: '#060b09' }}>
      {/* Map background — cover so it fills the screen (fog edges crop off) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${MAP})`,
          backgroundSize: 'cover',
          backgroundPosition: '50% 42%',
          filter: 'brightness(1.12) contrast(1.06) saturate(1.05)',
        }}
        aria-hidden="true"
      />
      {/* Vignette for legibility of the chrome */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 66% at 50% 42%, transparent 58%, rgba(3,7,5,.5) 100%),' +
            'linear-gradient(0deg, rgba(4,8,6,.92) 3%, transparent 20%),' +
            'linear-gradient(180deg, rgba(4,8,6,.55), transparent 12%)',
        }}
        aria-hidden="true"
      />

      {/* ── HUD: player badge (top-left) ── */}
      <div className="absolute" style={{ top: 10, left: 10, zIndex: 6 }}>
        <div
          className="flex items-center gap-2"
          style={{ background: 'rgba(6,12,9,.66)', border: '1px solid rgba(57,255,154,.25)', padding: '5px 9px 5px 5px', borderRadius: 4 }}
        >
          <div
            className="flex items-center justify-center font-mono font-bold"
            style={{ width: 30, height: 30, background: '#0c1a14', border: '2px solid #0a3d24', color: '#39ff9a', fontSize: 13 }}
          >
            ✕
          </div>
          <div className="font-mono leading-none">
            <span style={{ display: 'block', fontSize: 11, color: '#fff', fontWeight: 700 }}>
              {hasSave ? `LV ${playerProfile!.level}` : 'WALKER'}
            </span>
            <span style={{ fontSize: 8, color: '#8ea89d', letterSpacing: '.5px' }}>
              {hasSave ? playerProfile!.username.toUpperCase() : 'NEW SIGNAL'}
            </span>
          </div>
        </div>
      </div>

      {/* ── ≡ MENU button (top-right) ── */}
      <button
        onClick={() => setMenuOpen(true)}
        className="absolute font-mono uppercase"
        style={{
          top: 12, right: 12, zIndex: 6, minHeight: 30, padding: '5px 9px', fontSize: 9, letterSpacing: '1px',
          color: '#cfe0d8', background: 'rgba(6,12,9,.72)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 3,
        }}
      >
        ≡ MENU
      </button>

      {/* ── LEFT rail: come back & earn ── */}
      <div className="absolute flex flex-col gap-2" style={{ top: 92, left: 6, zIndex: 6 }}>
        <RailBtn icon={IC('daily')} label="Daily" hot badge="SOON" onClick={() => showToast('Daily Run — segera hadir 🔜')} />
        <RailBtn icon={IC('rewards')} label="Rewards" onClick={onRewards} />
        <RailBtn icon={IC('pass')} label="Pass" onClick={onMintPass} />
        <RailBtn icon={IC('invite')} label="Invite" onClick={onReferral} />
      </div>

      {/* ── RIGHT rail: build & spend ── */}
      <div className="absolute flex flex-col gap-2" style={{ top: 92, right: 6, zIndex: 6 }}>
        <RailBtn icon={IC('shop')} label="Shop" onClick={onMarketplace} />
        <RailBtn icon={IC('craft')} label="Craft" onClick={onCrafting} />
      </div>

      {/* ── Central entry pin (hatch) ── */}
      <div className="absolute" style={{ left: '40%', top: '49%', transform: 'translate(-50%,-50%)', zIndex: 5, textAlign: 'center' }}>
        <button onClick={primaryAction} aria-label={hasSave ? 'Continue' : 'New Game'}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/worldmap/hatch.webp"
            alt=""
            width={54}
            height={54}
            className="ns-hatch-bob"
            style={{ width: 54, height: 54, imageRendering: 'pixelated', filter: 'drop-shadow(0 0 10px rgba(57,255,154,.8)) drop-shadow(0 3px 4px rgba(0,0,0,.7))' }}
          />
        </button>
      </div>

      {isLoadingProfile && (
        <p
          className="absolute font-mono animate-pulse"
          style={{ left: '50%', top: '62%', transform: 'translateX(-50%)', zIndex: 6, fontSize: 10, letterSpacing: '2px', color: 'rgba(255,255,255,.6)' }}
        >
          loading player profile…
        </p>
      )}

      {/* ── Bottom action bar: MASUK ── */}
      <div
        className="absolute left-0 right-0 flex items-end gap-3"
        style={{ bottom: 0, zIndex: 7, padding: '14px 14px 20px', background: 'linear-gradient(0deg,#060d0a 38%,rgba(6,13,10,.55) 80%,transparent)' }}
      >
        <div className="flex-1 font-mono min-w-0">
          <span style={{ display: 'block', fontSize: 12, color: '#fff', letterSpacing: '.5px', fontWeight: 700, textShadow: '0 1px 3px #000' }}>
            {hasSave ? `${playerProfile!.username.toUpperCase()} · LV ${playerProfile!.level}` : 'NULLSTATE // BUNKER PROTOCOL'}
          </span>
          <span style={{ fontSize: 9, color: '#8ea89d' }}>
            {hasSave ? 'Lanjutkan penurunanmu ke dalam bunker' : 'Mulai turun ke dalam bunker'}
          </span>
        </div>
        <button
          onClick={primaryAction}
          className="font-mono font-bold uppercase"
          style={{
            minHeight: 44, fontSize: 14, letterSpacing: '2px', color: '#04140c', background: '#39ff9a',
            padding: '12px 22px', border: '3px solid #0a3d24',
            boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.4), 0 0 18px rgba(57,255,154,.5)',
          }}
        >
          {hasSave ? 'MASUK ▸' : 'MULAI ▸'}
        </button>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="absolute font-mono"
          style={{
            left: '50%', bottom: 96, transform: 'translateX(-50%)', zIndex: 9, fontSize: 11, letterSpacing: '.5px',
            color: '#04140c', background: '#ffcf4d', padding: '8px 14px', borderRadius: 4, whiteSpace: 'nowrap',
            boxShadow: '0 4px 14px rgba(0,0,0,.5)',
          }}
        >
          {toast}
        </div>
      )}

      {/* ── ≡ MENU overlay (New Game / Leaderboard / How to Play + legal) ── */}
      {menuOpen && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ zIndex: 20, background: 'rgba(4,8,6,.86)', backdropFilter: 'blur(2px)' }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="w-full flex flex-col items-center"
            style={{ maxWidth: 320, padding: '0 24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="w-full text-center" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { label: hasSave ? 'New Game (reset)' : 'New Game', fn: onNewGame, danger: hasSave },
                { label: 'Leaderboard', fn: onLeaderboard },
                { label: 'How to Play', fn: onHowToPlay },
              ].map((it) => (
                <button
                  key={it.label}
                  onClick={() => { setMenuOpen(false); it.fn() }}
                  className="block w-full font-mono uppercase"
                  style={{
                    minHeight: 44, padding: '8px', fontSize: 16, letterSpacing: '3px',
                    color: it.danger ? '#ff8a3d' : 'rgba(255,255,255,.86)',
                    background: 'transparent', border: '1px solid transparent',
                  }}
                >
                  {it.label}
                </button>
              ))}
            </nav>

            {/* MiniPay requirement: Support / Terms / Privacy reachable here */}
            <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
              <a href="https://t.me/nullstate_id" rel="noopener noreferrer" className="inline-flex items-center font-mono uppercase no-underline" style={{ minHeight: 44, padding: '0 8px', fontSize: 10, letterSpacing: '2px', color: 'rgba(255,255,255,.5)' }}>Support</a>
              <span style={{ color: 'rgba(255,255,255,.3)' }} aria-hidden="true">·</span>
              <a href="/terms" className="inline-flex items-center font-mono uppercase no-underline" style={{ minHeight: 44, padding: '0 8px', fontSize: 10, letterSpacing: '2px', color: 'rgba(255,255,255,.5)' }}>Terms</a>
              <span style={{ color: 'rgba(255,255,255,.3)' }} aria-hidden="true">·</span>
              <a href="/privacy" className="inline-flex items-center font-mono uppercase no-underline" style={{ minHeight: 44, padding: '0 8px', fontSize: 10, letterSpacing: '2px', color: 'rgba(255,255,255,.5)' }}>Privacy</a>
            </div>

            <p className="mt-5 font-mono" style={{ fontSize: 9, letterSpacing: '2px', color: 'rgba(255,255,255,.4)' }}>
              {realAddress ? maskAddress(realAddress) : 'Guest Mode'}
            </p>

            <button
              onClick={() => setMenuOpen(false)}
              className="mt-6 font-mono uppercase"
              style={{ minHeight: 44, padding: '8px 18px', fontSize: 11, letterSpacing: '2px', color: '#8ea89d', border: '1px solid rgba(255,255,255,.14)', borderRadius: 3, background: 'transparent' }}
            >
              ✕ Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
