'use client'

import { useEffect, useState } from 'react'
import { useWallet } from '@/lib/WalletProvider'
import { maskAddress } from '@/lib/addressMask'
import { PlayerProfile } from '@/lib/contract'
import { loadGameSession, loadGameSessionDraft } from '@/lib/gameSessionService'

// ─── World-Map Hub (Phase 1+2 — behind a feature flag) ───────────────────────
// A game-style landing that REPLACES MainMenu when enabled (?hub=1 or
// NEXT_PUBLIC_WORLDMAP_HUB=1). Pure UI-layer swap: same props as MainMenu,
// same handlers, so every downstream screen is untouched.
//
// Design rules taken from how shipped world-map games actually behave
// (Last Day on Earth's global map, standard mobile level-select):
//   1. The map ART already draws the five bunker doors. We do NOT paint another
//      door on top — we HIGHLIGHT the one that's yours with a ground-anchored
//      ring, so it reads as a place on the map instead of a floating sticker.
//   2. Tapping a node NEVER travels immediately. It selects, and the bottom bar
//      shows that bunker's name/state (and, when locked, the requirement).
//      A second, explicit tap on ENTER is what starts the run.
//   3. Locked places stay visible under drifting fog with a padlock — shown,
//      not hidden, with the requirement spelled out.
//   4. Cleared places get a ✓ stamp and sit dimmed.
//
// Node coordinates are in MAP-NATIVE percentages and live inside a wrapper that
// keeps the map's own aspect ratio, so markers stay glued to the painted doors
// on every screen size (a plain background-cover would drift per device).
//
// All user-facing copy is English, matching the rest of the game's UI.

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

// The five campaign bunkers, positioned over the doors painted into the map art.
// `act` is the engine's 0-based campaignActIndex (campaignActIndex===4 is
// "THE LAST LIGHT" — see public/game-engine/game.js).
const NODES = [
  { act: 0, name: 'TREELINE BUNKER', x: 35, y: 11 },
  { act: 1, name: 'SUNKEN FIELD', x: 64, y: 33 },
  { act: 2, name: 'FROSTLINE BUNKER', x: 38, y: 49 },
  { act: 3, name: 'HOLLOW MARKET', x: 60, y: 66 },
  { act: 4, name: 'THE LAST LIGHT', x: 45, y: 80 },
] as const

type NodeState = 'cleared' | 'active' | 'locked'

function RailBtn({
  icon, label, onClick, hot = false, badge,
}: {
  icon: string; label: string; onClick: () => void; hot?: boolean; badge?: string
}) {
  return (
    <button onClick={onClick} className="relative block w-[52px] text-center" style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.7))' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={icon} alt={label} width={46} height={46}
        style={{
          width: 46, height: 46, display: 'block', margin: '0 auto', imageRendering: 'pixelated',
          filter: hot ? 'drop-shadow(0 0 7px rgba(255,207,77,.65))' : undefined,
        }}
      />
      <span className="block font-mono uppercase" style={{ fontSize: 8, letterSpacing: '.3px', color: '#e2efe9', marginTop: 1, textShadow: '0 1px 2px #000' }}>
        {label}
      </span>
      {badge && (
        <span
          className="absolute font-mono font-extrabold"
          style={{
            top: -2, right: 3, minWidth: 15, height: 15, padding: '0 3px', fontSize: 8,
            background: badge === 'SOON' ? '#7a5a1f' : '#ff5a6a',
            color: badge === 'SOON' ? '#ffcf4d' : '#fff',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #000',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

export default function WorldMapHub({
  onContinueGame, onNewGame, onLeaderboard, onRewards, onReferral,
  onMintPass, onMarketplace, onCrafting, onHowToPlay,
  playerProfile, isLoadingProfile,
}: WorldMapHubProps) {
  const { realAddress, address } = useWallet()
  const hasSave = !!playerProfile?.isRegistered
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Which bunker the player is currently in, from the saved run. The local
  // draft answers instantly (localStorage); the Firestore copy then corrects it
  // if the player continued on another device. Defaults to bunker 1.
  const [currentAct, setCurrentAct] = useState(0)
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (!address) return
    let alive = true
    const apply = (act: number | undefined) => {
      if (!alive || typeof act !== 'number' || !isFinite(act)) return
      const clamped = Math.min(NODES.length - 1, Math.max(0, Math.floor(act)))
      setCurrentAct(clamped)
      setSelected(clamped)
    }
    apply(loadGameSessionDraft(address)?.campaignActIndex)
    loadGameSession(address).then((s) => apply(s?.campaignActIndex)).catch(() => {})
    return () => { alive = false }
  }, [address])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  const stateOf = (act: number): NodeState =>
    act < currentAct ? 'cleared' : act === currentAct ? 'active' : 'locked'

  const sel = NODES[selected]
  const selState = stateOf(sel.act)
  const canEnter = selState === 'active'

  // The engine resumes at the saved act, so ENTER is only offered on the active
  // bunker. Re-entering a cleared bunker would need an engine entry point that
  // doesn't exist yet — we say so instead of pretending.
  const enterLabel = selState === 'active' ? (hasSave ? 'ENTER ▸' : 'START ▸')
    : selState === 'cleared' ? 'CLEARED' : 'LOCKED'
  const subline = selState === 'active'
    ? (hasSave ? `Bunker ${sel.act + 1} · Continue your descent` : `Bunker ${sel.act + 1} · Begin your descent`)
    : selState === 'cleared' ? `Bunker ${sel.act + 1} · Already cleared`
      : `Locked · Clear ${NODES[sel.act - 1]?.name ?? 'the previous bunker'} first`

  const startRun = () => {
    if (!canEnter) return
    if (hasSave) onContinueGame(playerProfile!)
    else onNewGame()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden ns-fade-in" style={{ background: '#060b09' }}>
      {/* Map layer — keeps the art's own aspect ratio so node markers stay glued
          to the painted doors regardless of screen size (see .ns-hub-map). */}
      <div className="ns-hub-map">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={MAP} alt="" aria-hidden="true"
          style={{ width: '100%', height: '100%', display: 'block', filter: 'brightness(1.12) contrast(1.06) saturate(1.05)' }}
        />

        {NODES.map((n, i) => {
          const st = stateOf(n.act)
          const isSel = i === selected
          return (
            <button
              key={n.act}
              onClick={() => setSelected(i)}
              aria-label={`${n.name} — ${st}`}
              className="absolute"
              style={{
                left: `${n.x}%`, top: `${n.y}%`, transform: 'translate(-50%,-50%)',
                width: 62, height: 62, zIndex: 4, background: 'none', border: 'none', padding: 0,
              }}
            >
              {/* LOCKED — drifting fog over the painted door + padlock */}
              {st === 'locked' && (
                <>
                  <span className="ns-hub-fog" aria-hidden="true" />
                  <span className="ns-hub-fog ns-hub-fog-b" aria-hidden="true" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={IC('lock')} alt="" aria-hidden="true"
                    style={{
                      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                      width: 26, height: 26, imageRendering: 'pixelated', opacity: .92,
                      filter: 'grayscale(.35) brightness(.95) drop-shadow(0 2px 3px rgba(0,0,0,.8))',
                    }}
                  />
                </>
              )}

              {/* CLEARED — a small stamp beside the door */}
              {st === 'cleared' && (
                <span
                  aria-hidden="true"
                  className="absolute font-mono font-extrabold"
                  style={{
                    left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                    width: 20, height: 20, borderRadius: '50%', fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#04140c', background: '#39ff9a', opacity: .9,
                    boxShadow: '0 0 8px rgba(57,255,154,.55), 0 1px 3px rgba(0,0,0,.8)',
                  }}
                >
                  ✓
                </span>
              )}

              {/* ACTIVE — ground-anchored ring + a chevron nodding above it */}
              {st === 'active' && (
                <>
                  <span className="ns-hub-ring" aria-hidden="true" />
                  <span className="ns-hub-chev" aria-hidden="true">▼</span>
                </>
              )}

              {/* Selection outline (any state) */}
              {isSel && (
                <span
                  aria-hidden="true"
                  className="absolute"
                  style={{
                    left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                    width: 54, height: 54, border: '1px solid rgba(255,255,255,.55)', borderRadius: 4,
                    boxShadow: '0 0 0 1px rgba(0,0,0,.6)',
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Vignette so the chrome stays legible over the art */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 66% at 50% 42%, transparent 58%, rgba(3,7,5,.5) 100%),' +
            'linear-gradient(0deg, rgba(4,8,6,.92) 3%, transparent 20%),' +
            'linear-gradient(180deg, rgba(4,8,6,.6), transparent 13%)',
        }}
        aria-hidden="true"
      />

      {/* ── Player plate (top-left) — same pixel language as the rail icons ── */}
      <div className="absolute ns-hub-plate" style={{ top: 10, left: 10, zIndex: 6 }}>
        <div className="flex items-center gap-2">
          <span className="ns-hub-avatar font-mono">✕</span>
          <span className="font-mono leading-none">
            <span style={{ display: 'block', fontSize: 11, color: '#fff', fontWeight: 700, letterSpacing: '.5px' }}>
              {hasSave ? playerProfile!.username.toUpperCase() : 'WALKER'}
            </span>
            <span style={{ display: 'block', fontSize: 8.5, color: '#39ff9a', letterSpacing: '1px', marginTop: 2 }}>
              {hasSave ? `LV ${playerProfile!.level}` : 'NEW SIGNAL'}
            </span>
          </span>
        </div>
      </div>

      {/* ── ≡ MENU (top-right) ── */}
      <button
        onClick={() => setMenuOpen(true)}
        className="absolute font-mono uppercase"
        style={{
          top: 12, right: 12, zIndex: 6, minHeight: 32, padding: '6px 10px', fontSize: 9, letterSpacing: '1px',
          color: '#cfe0d8', background: 'rgba(6,12,9,.72)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 3,
        }}
      >
        ≡ MENU
      </button>

      {/* ── LEFT rail: come back & earn ── */}
      <div className="absolute flex flex-col gap-2" style={{ top: 92, left: 6, zIndex: 6 }}>
        <RailBtn icon={IC('daily')} label="Daily" hot badge="SOON" onClick={() => showToast('Daily Run — coming soon')} />
        <RailBtn icon={IC('rewards')} label="Rewards" onClick={onRewards} />
        <RailBtn icon={IC('pass')} label="Pass" onClick={onMintPass} />
        <RailBtn icon={IC('invite')} label="Invite" onClick={onReferral} />
      </div>

      {/* ── RIGHT rail: build & spend ── */}
      <div className="absolute flex flex-col gap-2" style={{ top: 92, right: 6, zIndex: 6 }}>
        <RailBtn icon={IC('shop')} label="Shop" onClick={onMarketplace} />
        <RailBtn icon={IC('craft')} label="Craft" onClick={onCrafting} />
      </div>

      {isLoadingProfile && (
        <p
          className="absolute font-mono animate-pulse"
          style={{ left: '50%', bottom: 108, transform: 'translateX(-50%)', zIndex: 6, fontSize: 10, letterSpacing: '2px', color: 'rgba(255,255,255,.6)' }}
        >
          loading player profile…
        </p>
      )}

      {/* ── Bottom bar: selected bunker + explicit ENTER (never auto-travels) ── */}
      <div
        className="absolute left-0 right-0 flex items-end gap-3"
        style={{ bottom: 0, zIndex: 7, padding: '14px 14px 20px', background: 'linear-gradient(0deg,#060d0a 38%,rgba(6,13,10,.55) 80%,transparent)' }}
      >
        <div className="flex-1 font-mono min-w-0">
          <span style={{ display: 'block', fontSize: 12.5, color: '#fff', letterSpacing: '.5px', fontWeight: 700, textShadow: '0 1px 3px #000' }}>
            {sel.name}
          </span>
          <span style={{ fontSize: 9, color: selState === 'locked' ? '#c9a24a' : '#8ea89d' }}>{subline}</span>
        </div>
        <button
          onClick={startRun}
          disabled={!canEnter}
          className="font-mono font-bold uppercase"
          style={{
            minHeight: 44, fontSize: 14, letterSpacing: '2px',
            color: canEnter ? '#04140c' : 'rgba(255,255,255,.45)',
            background: canEnter ? '#39ff9a' : 'rgba(20,32,26,.9)',
            padding: '12px 22px',
            border: canEnter ? '3px solid #0a3d24' : '3px solid rgba(255,255,255,.12)',
            boxShadow: canEnter ? 'inset 2px 2px 0 rgba(255,255,255,.4), 0 0 18px rgba(57,255,154,.5)' : 'none',
            cursor: canEnter ? 'pointer' : 'not-allowed',
          }}
        >
          {enterLabel}
        </button>
      </div>

      {toast && (
        <div
          className="absolute font-mono"
          style={{
            left: '50%', bottom: 100, transform: 'translateX(-50%)', zIndex: 9, fontSize: 11, letterSpacing: '.5px',
            color: '#04140c', background: '#ffcf4d', padding: '8px 14px', borderRadius: 4, whiteSpace: 'nowrap',
            boxShadow: '0 4px 14px rgba(0,0,0,.5)',
          }}
        >
          {toast}
        </div>
      )}

      {/* ── ≡ MENU overlay ── */}
      {menuOpen && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ zIndex: 20, background: 'rgba(4,8,6,.88)' }}
          onClick={() => setMenuOpen(false)}
        >
          <div className="w-full flex flex-col items-center" style={{ maxWidth: 320, padding: '0 24px' }} onClick={(e) => e.stopPropagation()}>
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
                    color: it.danger ? '#ff8a3d' : 'rgba(255,255,255,.86)', background: 'transparent', border: '1px solid transparent',
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
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
