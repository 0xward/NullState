'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePublicClient } from 'wagmi'
import { useWallet, CELO_CHAIN_ID } from '@/lib/WalletProvider'
import { PlayerProfile } from '@/lib/contract'
import { loadGameSession, saveGameSession, clearGameSession } from '@/lib/gameSessionService'
import { recordRunKills } from '@/lib/leaderboardService'
import SettingsModal from './SettingsModal'
import SaveConfirmModal from './SaveConfirmModal'

// ─────────────────────────────────────────────────────────────────────────────
// DungeonGame — real-time canvas dungeon crawler (NULL_STATE // THE FORSAKEN
// DEPTHS) ported into the Next.js app. The proven vanilla-JS engine lives in
// /public/game-engine/* and exposes window.NullStateGame.{mount,unmount}. The
// engine's on-chain NULL_STRIKE is bridged to the existing wagmi wallet so the
// whole app uses ONE wallet system (RainbowKit / MiniPay / MetaMask on Celo).
// ─────────────────────────────────────────────────────────────────────────────

// Cache-busting build tag. Bump NEXT_PUBLIC_BUILD_ID (set automatically by
// Vercel to the deployment/commit id) so the CDN and the browser always
// treat the engine files as new after a deploy, instead of reusing a stale
// cached copy of /game-engine/*.js (these are static public/ files and do
// NOT get the automatic content-hash that Next.js applies to its own bundles).
const BUILD_TAG =
  process.env.NEXT_PUBLIC_BUILD_ID ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  'dev'

const ENGINE_SCRIPTS = [
  '/game-engine/audio.js',
  '/game-engine/assets.js',
  '/game-engine/story.js',
  '/game-engine/story_campaign.js',
  '/game-engine/dungeon.js',
  '/game-engine/props.js',
  '/game-engine/entities.js',
  '/game-engine/outdoor.js',
  '/game-engine/game.js',
].map(src => `${src}?v=${BUILD_TAG}`)

// Load the engine scripts exactly once, in order.
let enginePromise: Promise<void> | null = null
function loadEngine(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if ((window as any).NullStateGame) return Promise.resolve()
  if (enginePromise) return enginePromise

  enginePromise = ENGINE_SCRIPTS.reduce<Promise<void>>((chain, src) => {
    return chain.then(
      () =>
        new Promise<void>((resolve, reject) => {
          const existing = document.querySelector(`script[data-ns-engine="${src}"]`)
          if (existing) return resolve()
          const s = document.createElement('script')
          s.src = src
          s.async = false
          s.dataset.nsEngine = src
          s.onload = () => resolve()
          s.onerror = () => reject(new Error('Failed to load ' + src))
          document.body.appendChild(s)
        })
    )
  }, Promise.resolve())

  return enginePromise
}

const clampU32 = (n: number) => Math.max(0, Math.min(4294967295, Math.round(n || 0)))
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const isNoWallet = (e: any) => {
  const m = (e?.message || e?.shortMessage || '').toString().toLowerCase()
  return (
    e?.message === 'NO_WALLET' ||
    m.includes('not connected') ||
    m.includes('no wallet') ||
    m.includes('connector') ||
    m.includes('no injected')
  )
}

interface DungeonGameProps {
  playerProfile: PlayerProfile | null
  setPlayerUsername: (username: string) => Promise<{ success: boolean; username: string }>
}

export default function DungeonGame({ playerProfile, setPlayerUsername }: DungeonGameProps) {
  const wallet = useWallet()
  const publicClient = usePublicClient({ chainId: CELO_CHAIN_ID })
  const router = useRouter()

  const [showSettings, setShowSettings] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [soundMuted, setSoundMuted] = useState(false)
  const [musicVolume, setMusicVolume] = useState(0.75)
  const [sfxEnabled, setSfxEnabled] = useState(true)
  const [sessionStats, setSessionStats] = useState<{ depth: number; kills: number } | null>(null)

  const refreshSessionStats = () => {
    const NSG = (window as any).NullStateGame
    if (!NSG || typeof NSG.getSaveSnapshot !== 'function') {
      setSessionStats(null)
      return null
    }
    const snap = NSG.getSaveSnapshot()
    setSessionStats(snap ? { depth: snap.depth, kills: snap.kills } : null)
    return snap
  }

  const handleSaveGame = async (): Promise<boolean> => {
    const NSG = (window as any).NullStateGame
    const addr = wallet.address
    if (!NSG || !addr) return false
    const snap = NSG.getSaveSnapshot?.()
    if (!snap) return false
    const ok = await saveGameSession(addr, snap)
    // Kill count is otherwise only folded into the leaderboard when the
    // player dies (on-chain executeAction -> recordRunKills, see
    // useContractPlayer.ts). A manual Save & Exit never triggers that
    // on-chain event, so without this the leaderboard's totalKills stayed
    // stuck at whatever it was after the last death, even though the run's
    // real kill count kept climbing. recordRunKills is dedup-safe (see
    // leaderboardService.ts) so calling it here plus later on death can't
    // double-count, and this never touches/loses the on-chain kill history.
    if (typeof snap.kills === 'number') {
      recordRunKills(addr, snap.kills)
    }
    return ok
  }

  const handleToggleSound = () => {
    const NSG = (window as any).NullStateGame
    const muted = NSG?.toggleSound?.()
    setSoundMuted(!!muted)
  }

  const handleMusicVolumeChange = (value: number) => {
    const NSG = (window as any).NullStateGame
    const applied = NSG?.setMusicVolume?.(value)
    setMusicVolume(typeof applied === 'number' ? applied : value)
  }

  const handleToggleSfx = () => {
    const NSG = (window as any).NullStateGame
    const enabled = NSG?.toggleSfx?.()
    setSfxEnabled(enabled !== undefined ? !!enabled : !sfxEnabled)
  }

  const handleOpenSettings = () => {
    refreshSessionStats()
    setShowSettings(true)
  }

  const handleExitClick = () => {
    refreshSessionStats()
    setShowExitConfirm(true)
  }

  const handleSaveAndExit = async () => {
    await handleSaveGame()
    router.push('/')
  }

  const handleExitWithoutSaving = () => {
    router.push('/')
  }

  // Keep the latest wallet/client in refs so the engine bridge always reads
  // current values (wagmi state changes between renders after connect()).
  const walletRef = useRef(wallet)
  const clientRef = useRef(publicClient)
  walletRef.current = wallet
  clientRef.current = publicClient

  useEffect(() => {
    let cancelled = false

    // ── TEMPORARY DEBUG OVERLAY ────────────────────────────────────────────
    // Phone-only testing, no DevTools access. This renders any console.error
    // (including the engine's own internal safety-net logs, e.g.
    // "frame() failed, continuing loop" / "showLoadingTransition: onDark
    // failed") plus any uncaught error/rejection directly on screen, so the
    // exact crash message is visible without a computer.
    // REMOVE THIS BLOCK once the bug is found — it's diagnostic only.
    const dbgBox = document.createElement('div')
    dbgBox.id = 'ns-debug-overlay'
    Object.assign(dbgBox.style, {
      position: 'fixed', left: '0', right: '0', bottom: '0',
      maxHeight: '40vh', overflowY: 'auto', zIndex: '99999',
      background: 'rgba(0,0,0,0.92)', color: '#5cff9d',
      font: '11px/1.4 monospace', padding: '8px', whiteSpace: 'pre-wrap',
      wordBreak: 'break-word', borderTop: '2px solid #5cff9d',
    } as CSSStyleDeclaration)
    dbgBox.textContent = '[debug overlay active — waiting for errors]'
    document.body.appendChild(dbgBox)
    const logToOverlay = (label: string, msg: string) => {
      const line = document.createElement('div')
      line.style.marginBottom = '6px'
      line.style.borderBottom = '1px solid rgba(92,255,157,0.25)'
      line.textContent = `[${new Date().toLocaleTimeString()}] ${label}: ${msg}`
      dbgBox.appendChild(line)
      dbgBox.scrollTop = dbgBox.scrollHeight
    }
    const origConsoleError = console.error
    console.error = (...args: any[]) => {
      logToOverlay('console.error', args.map(a => (a && a.stack) ? a.stack : String(a)).join(' '))
      origConsoleError.apply(console, args)
    }
    const onWinError = (e: ErrorEvent) => {
      logToOverlay('uncaught', `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`)
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      logToOverlay('unhandledrejection', String(e.reason && e.reason.stack || e.reason))
    }
    window.addEventListener('error', onWinError)
    window.addEventListener('unhandledrejection', onRejection)
    // ── END TEMPORARY DEBUG OVERLAY ─────────────────────────────────────────

    // Wait for a tx receipt (best-effort; never throws).
    const waitForTx = async (hash?: string) => {
      const client = clientRef.current
      if (!hash || !client) return
      try {
        await client.waitForTransactionReceipt({ hash: hash as `0x${string}` })
      } catch {
        /* ignore — surface failures via executeAction instead */
      }
    }

    // The chain bridge handed to the engine. Mirrors the original
    // NS_CHAIN.ultiTx({ damage, xp, killed, onStatus }) -> { ok, demo, hash }.
    const chain = {
      async ultiTx({
        damage,
        xp,
        killed,
        onStatus,
      }: {
        damage: number
        xp: number
        killed: boolean
        onStatus?: (s: string) => void
      }) {
        try {
          // 1) Ensure wallet connected
          if (!walletRef.current.isConnected) {
            onStatus?.('connecting')
            await walletRef.current.connect()
            // poll for connection (wagmi updates state across renders)
            let waited = 0
            while (!walletRef.current.isConnected && waited < 30000) {
              await wait(400)
              waited += 400
            }
            if (!walletRef.current.isConnected) {
              return { ok: true, demo: true, hash: null }
            }
          }

          // 2) Ensure the Walker is registered on-chain
          onStatus?.('registering')
          try {
            const player = await walletRef.current.readPlayer()
            if (!player || !player.exists) {
              const regHash = await walletRef.current.registerPlayer()
              await waitForTx(regHash)
            }
          } catch {
            /* registration read failed — attempt the action anyway */
          }

          // 3) Sign the NULL_STRIKE (executeAction, 0.01 CELO fee handled in provider)
          onStatus?.('signing')
          const hash = await walletRef.current.executeAction({
            actionType: 1,
            // NullState.sol requires damageDealt <= 150 and xpGained <= 200 —
            // clamp so a high-HP boss NULL_STRIKE can never revert on-chain.
            damageDealt: Math.min(150, clampU32(damage)),
            damageReceived: 0,
            xpGained: Math.min(200, Math.max(0, Math.round(xp || 0))),
            enemyKilled: !!killed,
          })

          onStatus?.('pending')
          await waitForTx(hash)
          return { ok: true, demo: false, hash }
        } catch (e) {
          if (isNoWallet(e)) return { ok: true, demo: true, hash: null }
          throw e
        }
      },
    }

    // Block the browser's native pull-to-refresh / overscroll gesture while
    // the game is mounted. The CSS (overscroll-behavior + touch-action on
    // .ns-game-root) handles most cases, but some Android Chrome versions
    // still trigger pull-to-refresh from a touchmove that starts outside
    // any touch-action:none element, so this is a JS-level backstop.
    // Passive:false is required for preventDefault() to actually take effect.
    const preventPullToRefresh = (e: TouchEvent) => {
      if (e.touches.length > 1) return // allow pinch gestures to pass through untouched
      const target = e.target as HTMLElement
      // These rely on native touch scrolling/dragging — the Settings modal
      // (scrollable panel + the volume <input type="range"> slider) was
      // missing here, which is why on touch browsers (mobile Chrome, and
      // especially in-app browsers like OKX Wallet / MiniPay that route ALL
      // touchmove through this same global listener) the settings popup
      // couldn't be scrolled and the volume slider felt stuck/janky: every
      // touchmove on top of it was being preventDefault()-ed before the
      // browser's native scroll/slider-drag handling ever got a chance to run.
      if (target.closest('.inv-panel, .lift-floor-list, .ns-settings-panel, .ns-settings-slider')) return
      e.preventDefault()
    }
    document.addEventListener('touchmove', preventPullToRefresh, { passive: false })

    loadEngine()
      .then(async () => {
        if (cancelled) return
        const NSG = (window as any).NullStateGame
        if (!NSG || typeof NSG.mount !== 'function') return

        const addr = walletRef.current.address
        let savedSession = null as any
        if (addr) {
          try {
            savedSession = await loadGameSession(addr)
            if (savedSession) {
              // Single-use: consume it now so a stale reload can't replay it.
              await clearGameSession(addr)
            }
          } catch {
            /* no saved session, or Firebase unreachable — fall through to a fresh run */
          }
        }
        if (cancelled) return

        NSG.mount({
          chain,
          initialStats: playerProfile
            ? { xp: playerProfile.xp, level: playerProfile.level }
            : null,
          savedSession,
        })
        setSoundMuted(!!NSG.isSoundMuted?.())
        // Engine's audio module already defaults musicVolume to 0.75 and sfx
        // to enabled, so just read them back to keep React state in sync
        // (rather than re-pushing 0.75 and clobbering anything the engine
        // itself decided at init).
        const vol = NSG.getMusicVolume?.()
        if (typeof vol === 'number') setMusicVolume(vol)
        const sfxOn = NSG.isSfxEnabled?.()
        if (sfxOn !== undefined) setSfxEnabled(!!sfxOn)
      })
      .catch(err => console.error('NullState engine failed to load:', err))

    // Silent best-effort auto-save whenever the tab is hidden or the page is
    // about to unload — covers users who close/switch away without using
    // the explicit Exit -> Save flow. No popup here; this is a safety net,
    // not the primary save path.
    const silentSave = () => {
      const NSG = (window as any).NullStateGame
      const addr = walletRef.current.address
      if (!NSG || !addr || typeof NSG.getSaveSnapshot !== 'function') return
      const snap = NSG.getSaveSnapshot()
      if (snap) {
        saveGameSession(addr, snap)
        if (typeof snap.kills === 'number') recordRunKills(addr, snap.kills)
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') silentSave()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    // pagehide/visibilitychange fire the write, but they don't guarantee it
    // finishes: an accidental refresh (pull-to-refresh, tapping reload in
    // OKX/MiniPay's in-app browser, etc.) can tear the page down mid-request
    // before Firestore's write ever reaches the network. beforeunload is
    // added as a second best-effort hook for browsers that give it a bit
    // more time than pagehide; neither can be made 100% reliable without a
    // sendBeacon-based server endpoint, so this is paired with the periodic
    // interval below, which keeps the saved snapshot from ever being more
    // than ~15s stale regardless of how the tab goes away.
    window.addEventListener('pagehide', silentSave)
    window.addEventListener('beforeunload', silentSave)
    const autosaveInterval = window.setInterval(silentSave, 15000)

    return () => {
      cancelled = true
      document.removeEventListener('touchmove', preventPullToRefresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', silentSave)
      window.removeEventListener('beforeunload', silentSave)
      window.clearInterval(autosaveInterval)
      const NSG = (window as any).NullStateGame
      if (NSG && typeof NSG.unmount === 'function') NSG.unmount()
      // ── TEMPORARY DEBUG OVERLAY cleanup ──
      console.error = origConsoleError
      window.removeEventListener('error', onWinError)
      window.removeEventListener('unhandledrejection', onRejection)
      dbgBox.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="ns-game-root">
      <div id="app">
        <canvas id="game" />

        {/* Back to site — intercepted so we can offer to save first */}
        <button
          type="button"
          className="ns-back"
          aria-label="Back to NullState home"
          onClick={handleExitClick}
        >
          ◂ EXIT
        </button>

        {/* HUD */}
        <div id="hud" className="hidden">
          <div className="hud-top">
            <div className="hud-left">
              <div className="bar-row">
                <span className="bar-label">HP</span>
                <div className="bar hp">
                  <div id="hpFill" className="bar-fill" />
                  <span id="hpText" className="bar-text">100/100</span>
                </div>
              </div>
              <div className="bar-row">
                <span className="bar-label">XP</span>
                <div className="bar xp">
                  <div id="xpFill" className="bar-fill" />
                  <span id="xpText" className="bar-text">0/200</span>
                </div>
              </div>
            </div>
            <div className="hud-right">
              <div className="stat"><span className="stat-k">LV</span><span id="lvl" className="stat-v">1</span></div>
              <div className="stat"><span className="stat-k">FLOOR</span><span id="floor" className="stat-v">1</span></div>
              <div className="stat"><span className="stat-k">KILLS</span><span id="kills" className="stat-v">0</span></div>
              <div className="stat"><span className="stat-k">CELO</span><span id="celo" className="stat-v">0.00</span></div>
            </div>
          </div>

          <div id="floorBanner" className="floor-banner" />

          <div id="log" className="log" />

          {/* Inventory button sits just under the canvas-drawn minimap
              (top-right) and toggles the inventory panel. */}
          <button id="invBtn" className="inv-btn" aria-label="Inventory">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 8V6.5a4 4 0 0 1 8 0V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <rect x="5" y="8" width="14" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M9 8v3.2a3 3 0 0 0 6 0V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <rect x="9.5" y="14" width="5" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          </button>

          {/* Settings button — progress, save game, username, sound, links */}
          <button
            type="button"
            className="ns-settings-trigger"
            aria-label="Settings"
            onClick={handleOpenSettings}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
                stroke="currentColor" strokeWidth="1.6"
              />
              <path
                d="M19.4 13.6c.05-.53.05-1.07 0-1.6l1.6-1.25a.6.6 0 0 0 .14-.77l-1.5-2.6a.6.6 0 0 0-.73-.26l-1.9.76a7.4 7.4 0 0 0-1.38-.8l-.29-2.02a.6.6 0 0 0-.6-.51h-3a.6.6 0 0 0-.6.51l-.29 2.02c-.5.2-.96.48-1.38.8l-1.9-.76a.6.6 0 0 0-.73.26l-1.5 2.6a.6.6 0 0 0 .14.77l1.6 1.25c-.05.53-.05 1.07 0 1.6l-1.6 1.25a.6.6 0 0 0-.14.77l1.5 2.6a.6.6 0 0 0 .73.26l1.9-.76c.42.32.88.6 1.38.8l.29 2.02a.6.6 0 0 0 .6.51h3a.6.6 0 0 0 .6-.51l.29-2.02c.5-.2.96-.48 1.38-.8l1.9.76a.6.6 0 0 0 .73-.26l1.5-2.6a.6.6 0 0 0-.14-.77l-1.6-1.25Z"
                stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
              />
            </svg>
          </button>
          <div id="invPanel" className="inv-panel hidden">
            <div className="inv-panel-head">
              <span>INVENTORY</span>
              <button id="invClose" className="inv-close" aria-label="Close">✕</button>
            </div>
            <div className="inv-vitals">
              <div className="inv-vital-row">
                <span className="bar-label">HP</span>
                <div className="bar hp"><div id="invHpFill" className="bar-fill" /><span id="invHpText" className="bar-text">100/100</span></div>
              </div>
              <div className="inv-vital-row">
                <span className="bar-label">XP</span>
                <div className="bar xp"><div id="invXpFill" className="bar-fill" /><span id="invXpText" className="bar-text">0/200</span></div>
              </div>
            </div>
            <div id="invItems" className="inv-items">
              <div className="inv-empty" id="invEmpty">No items yet — explore the depths.</div>
            </div>
          </div>

          <div id="touchControls" className="touch hidden">
            <div id="stick" className="stick"><div id="stickNub" className="nub" /></div>
            <button id="atkBtn" className="atk">⚔</button>
          </div>

          <div className="hint">WASD / Arrows · move&nbsp;&nbsp;·&nbsp;&nbsp;SPACE / J / Click · attack&nbsp;&nbsp;·&nbsp;&nbsp;E · interact</div>
        </div>

        {/* Lift floor-select popup (sibling of #hud, like the other overlays
            below, so it isn't subject to #hud's pointer-events:none) */}
        <div id="liftMenu" className="overlay hidden">
          <div className="lift-inner">
            <div className="logo" style={{fontSize:'22px'}}>LIFT</div>
            <div className="subtitle">// SELECT FLOOR</div>
            <div id="liftFloorList" className="lift-floor-list" />
            <button id="liftCancel" className="ghost-btn">▾ cancel</button>
          </div>
        </div>

        {/* Dark loading transition, used whenever the lift changes floors */}
        <div id="loadingFade" className="loading-fade hidden">
          <div id="loadingFadeText" className="loading-fade-text" />
        </div>

        {/* Title screen */}
        <div id="title" className="overlay">
          <div className="title-inner">
            <div className="logo">NULL_STATE</div>
            <div className="subtitle">// THE FORSAKEN DEPTHS</div>
            <p className="lore" id="titleLore" />
            <div className="char-select">
              <button className="char-btn selected" data-char="knight">
                <div className="char-prev" id="prevKnight" /><span>KNIGHT</span>
              </button>
              <button className="char-btn" data-char="rogue">
                <div className="char-prev" id="prevRogue" /><span>ROGUE</span>
              </button>
              <button className="char-btn" data-char="wizzard">
                <div className="char-prev" id="prevWizzard" /><span>WIZZARD</span>
              </button>
            </div>
            <button id="startBtn" className="big-btn">DESCEND ▾</button>
            <div className="title-foot">Death is permanent. The depths remember.</div>
          </div>
        </div>

        {/* Story / cutscene overlay */}
        <div id="story" className="overlay hidden">
          <div className="story-inner">
            <p id="storyText" className="story-text" />
            <button id="storyNext" className="ghost-btn">▾ continue</button>
          </div>
        </div>

        {/* Tutorial overlay — animated how-to-play, shown once before the
            first bunker. Each slide pairs a small animated visual demo
            with a short line of text, rather than a plain text popup. */}
        <div id="tutorial" className="overlay hidden">
          <div className="tutorial-inner">
            <div id="tutorialVisual" className="tutorial-visual">
              {/* slide 1: movement — animated virtual joystick demoing a circular drag */}
              <div className="tut-slide" data-slide="move">
                <div className="tut-stick-base">
                  <div id="tutStickNub" className="tut-stick-nub" />
                </div>
              </div>
              {/* slide 2: auto-attack — sword swing arc pulsing toward a target dot */}
              <div className="tut-slide hidden" data-slide="attack">
                <div className="tut-attack-demo">
                  <div className="tut-hero-dot" />
                  <div id="tutSwingArc" className="tut-swing-arc" />
                  <div className="tut-enemy-dot" />
                </div>
              </div>
              {/* slide 3: clear the floor — lock icon that unlocks */}
              <div className="tut-slide hidden" data-slide="clear">
                <div className="tut-lock-demo">
                  <div id="tutLockIcon" className="tut-lock-icon">🔒</div>
                  <div id="tutLiftGlow" className="tut-lift-glow" />
                </div>
              </div>
              {/* slide 4: ulti / NULL_STRIKE — pulsing lightning bolt */}
              <div className="tut-slide hidden" data-slide="ulti">
                <div className="tut-ulti-demo">
                  <div id="tutBolt" className="tut-bolt">⚡</div>
                  <div className="tut-hp-bar"><div id="tutHpFill" className="tut-hp-fill" /></div>
                </div>
              </div>
            </div>
            <p id="tutorialText" className="tutorial-text" />
            <div className="tutorial-dots">
              <span className="tut-dot" data-i="0" />
              <span className="tut-dot" data-i="1" />
              <span className="tut-dot" data-i="2" />
              <span className="tut-dot" data-i="3" />
            </div>
            <button id="tutorialNext" className="ghost-btn">▾ got it</button>
          </div>
        </div>

        {/* Ultimate / on-chain strike popup */}
        <div id="ulti" className="overlay hidden">
          <div className="ulti-inner">
            <div className="ulti-tag">⚡ NULL_STRIKE AVAILABLE</div>
            <div className="ulti-target" id="ultiTarget">ELITE</div>
            <p className="ulti-desc" id="ultiDesc">Sign an on-chain strike to channel the chain&apos;s wrath — devastating damage that leaves your foe near death.</p>
            <div className="ulti-fee">FEE <b>0.01 CELO</b> · Celo Mainnet</div>
            <div className="ulti-status" id="ultiStatus" />
            <div className="ulti-btns">
              <button id="ultiTx" className="big-btn">⚡ SIGN TX</button>
              <button id="ultiSkip" className="ghost-btn">SKIP ▾</button>
            </div>
            <div className="ulti-note" id="ultiNote" />
          </div>
        </div>

        {/* Death screen */}
        <div id="death" className="overlay hidden">
          <div className="death-inner">
            <div className="death-title">YOU DIED</div>
            <div id="deathSub" className="death-sub" />
            <div id="deathStats" className="death-stats" />
            <button id="reviveBtn" className="big-btn">RISE AGAIN ▾</button>
          </div>
        </div>
      </div>

      {/* React-managed overlays — kept as siblings of #app (which the vanilla
          engine owns) so they're untouched by the engine's own DOM writes. */}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        address={wallet.address}
        playerProfile={playerProfile}
        sessionStats={sessionStats}
        soundMuted={soundMuted}
        onToggleSound={handleToggleSound}
        musicVolume={musicVolume}
        onMusicVolumeChange={handleMusicVolumeChange}
        sfxEnabled={sfxEnabled}
        onToggleSfx={handleToggleSfx}
        onSaveGame={handleSaveGame}
        setPlayerUsername={setPlayerUsername}
      />
      <SaveConfirmModal
        open={showExitConfirm}
        canSave={!!sessionStats}
        onSaveAndExit={handleSaveAndExit}
        onExitWithoutSaving={handleExitWithoutSaving}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  )
}
