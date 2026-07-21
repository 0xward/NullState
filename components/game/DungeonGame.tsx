'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { attachLiveStatsBridge, subscribeLiveStats } from '@/lib/liveStatsBridge'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/lib/WalletProvider'
import { PlayerProfile } from '@/lib/contract'
import { loadGameSession, saveGameSession, clearGameSession, saveGameSessionDraft, clearGameSessionDraft } from '@/lib/gameSessionService'
import { recordRunKills, recordRunProgress } from '@/lib/leaderboardService'
import { GAME_CONFIG } from '@/lib/constants/game-config'
import SettingsModal from './SettingsModal'
import { LiveStatsProvider } from './LiveStatsProvider'
import SaveConfirmModal from './SaveConfirmModal'
import HudStatLine from './HudStatLine'

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
  '/game-engine/items.js',
  '/game-engine/marketplace-items.js',
  '/game-engine/props.js',
  '/game-engine/monster-config.js',
  '/game-engine/effects.js',
  '/game-engine/entities.js',
  '/game-engine/outdoor.js',
  '/game-engine/run-session.js',
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

interface DungeonGameProps {
  playerProfile: PlayerProfile | null
  setPlayerUsername: (username: string) => Promise<{ success: boolean; username: string }>
  // True when entered via "New Game" — see GameFlowManager.tsx. When true,
  // the mount effect below skips loadGameSession() entirely instead of
  // silently resuming whatever bunker was last saved.
  isNewRun?: boolean
}

export default function DungeonGame({ playerProfile, setPlayerUsername, isNewRun }: DungeonGameProps) {
  const wallet = useWallet()
  const router = useRouter()

  const [showSettings, setShowSettings] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  // Issue #2 fix: single source of truth for "is ANY full-screen overlay
  // open right now", used to hide TokenBalanceWidget instead of leaving it
  // floating on top of every modal. Covers both React-driven overlays
  // (showSettings gates SettingsModal; showExitConfirm gates both the
  // exit-confirm dialog AND SaveConfirmModal, which share the one flag) and
  // the vanilla-engine overlays (#invPanel, #containerWindow, #vaultWindow —
  // shown/hidden by game.js toggling a 'hidden' class, not React state) via
  // a MutationObserver watching those three DOM nodes. One gate, not
  // one-off checks scattered per modal.
  const [vanillaOverlayOpen, setVanillaOverlayOpen] = useState(false)
  const [soundMuted, setSoundMuted] = useState(false)
  const [musicVolume, setMusicVolume] = useState(0.75)
  const [sfxEnabled, setSfxEnabled] = useState(true)
  const [screenShakeEnabled, setScreenShakeEnabled] = useState(true)
  const [sessionStats, setSessionStats] = useState<{ depth: number; kills: number } | null>(null)
  // Phase 1 (Genius blueprint §2.6): out-of-energy modal state. Set by the
  // engine's energy bridge when a fresh bunker entry is denied; cleared on
  // successful refill or dismiss. `resetAt` drives the countdown line.
  const [energyModal, setEnergyModal] = useState<{ resetAt: number } | null>(null)
  const [energyBusy, setEnergyBusy] = useState(false)
  const [energyMsg, setEnergyMsg] = useState<string | null>(null)
  const [energyNow, setEnergyNow] = useState(Date.now())
  // Phase 2: banked Glitch Shard cache (ref, not state — read by the engine
  // via the materials bridge on its own repaint schedule, never re-renders React).
  const materialsRef = useRef<{ t1: number; t2: number; t3: number } | null>(null)
  // Phase 3 (blueprint §2.6): Drop-Rate Elixir. owned = unused elixirs,
  // activeUntil = ms epoch the 2x-drop buff expires. window.NS_DROPBUFF_UNTIL
  // (read by items.js rollItemDrop) is mirrored from activeUntil.
  const [elixir, setElixir] = useState<{ owned: number; activeUntil: number }>({ owned: 0, activeUntil: 0 })
  const [elixirModal, setElixirModal] = useState(false)
  const [elixirBusy, setElixirBusy] = useState(false)
  const [elixirMsg, setElixirMsg] = useState<string | null>(null)
  const [uiNow, setUiNow] = useState(Date.now())
  useEffect(() => {
    if (!energyModal) return
    const t = setInterval(() => setEnergyNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [energyModal])
  // 1Hz tick while an elixir buff is active or its modal is open (for the
  // countdown), otherwise idle.
  const elixirActive = elixir.activeUntil > uiNow
  useEffect(() => {
    if (!elixirActive && !elixirModal) return
    const t = setInterval(() => setUiNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [elixirActive, elixirModal])
  // Mirror the buff expiry into the engine global rollItemDrop() reads.
  useEffect(() => {
    ;(window as unknown as { NS_DROPBUFF_UNTIL?: number }).NS_DROPBUFF_UNTIL = elixir.activeUntil
  }, [elixir.activeUntil])

  const isDevWallet =
    !!wallet.address &&
    (process.env.NEXT_PUBLIC_DEV_TEST_WALLETS || '')
      .split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
      .includes(wallet.address.toLowerCase())

  const handleEnergyRefill = async () => {
    if (energyBusy) return
    const addr = walletRef.current.address
    if (!addr) return
    setEnergyBusy(true)
    setEnergyMsg(isDevWallet ? 'DEV: requesting free refill…' : 'Sending $1…')
    try {
      let txHash = ''
      if (!isDevWallet) {
        txHash = await walletRef.current.buyMarketplaceItem(1, 'USDm')
        setEnergyMsg('Payment sent — verifying on-chain…')
      }
      const res = await fetch('/api/energy/refill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isDevWallet ? { wallet: addr, devBypass: true } : { wallet: addr, txHash, token: 'USDm' },
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Refill failed')
      setEnergyMsg(null)
      setEnergyModal(null) // energy restored — walk back to the door to enter
    } catch (e: unknown) {
      setEnergyMsg(e instanceof Error ? e.message : 'Refill failed')
    } finally {
      setEnergyBusy(false)
    }
  }

  // Phase 3: refresh elixir state from the server (owned + active buff).
  const refreshElixir = useCallback(async () => {
    const addr = walletRef.current.address
    if (!addr) return
    try {
      const r = await fetch(`/api/elixir?wallet=${addr}`)
      const d = await r.json()
      if (r.ok && typeof d?.owned === 'number') {
        setElixir({ owned: d.owned, activeUntil: d.activeUntil || 0 })
      }
    } catch { /* offline — keep last known */ }
  }, [])

  const handleElixirBuy = async () => {
    if (elixirBusy) return
    const addr = walletRef.current.address
    if (!addr) return
    setElixirBusy(true)
    setElixirMsg(isDevWallet ? 'DEV: requesting free elixir…' : 'Sending $1…')
    try {
      let txHash = ''
      if (!isDevWallet) {
        txHash = await walletRef.current.buyMarketplaceItem(1, 'USDm')
        setElixirMsg('Payment sent — verifying on-chain…')
      }
      const res = await fetch('/api/elixir/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isDevWallet ? { wallet: addr, devBypass: true } : { wallet: addr, txHash, token: 'USDm' },
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Purchase failed')
      setElixir({ owned: data.owned ?? 0, activeUntil: data.activeUntil ?? 0 })
      setElixirMsg('✓ Elixir added — drink it to start the 2× drop buff.')
    } catch (e: unknown) {
      setElixirMsg(e instanceof Error ? e.message : 'Purchase failed')
    } finally {
      setElixirBusy(false)
    }
  }

  const handleElixirUse = async () => {
    if (elixirBusy) return
    const addr = walletRef.current.address
    if (!addr) return
    setElixirBusy(true)
    setElixirMsg('Drinking…')
    try {
      const res = await fetch('/api/elixir/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: addr }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Use failed')
      if (!data.ok) { setElixirMsg('No elixirs to drink — buy one first.'); return }
      setElixir({ owned: data.owned ?? 0, activeUntil: data.activeUntil ?? 0 })
      setElixirMsg('✦ Loot sharpens. 2× drop chance is active.')
    } catch (e: unknown) {
      setElixirMsg(e instanceof Error ? e.message : 'Use failed')
    } finally {
      setElixirBusy(false)
    }
  }

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
    // GUEST runs never touch the public leaderboard (owner: guests play + save
    // to Firebase but "tidak masuk leaderboard"). The bunker save itself above
    // still persists so a guest can Continue; only these leaderboard writes are
    // skipped.
    if (!wallet.isGuest) {
      if (typeof snap.kills === 'number') {
        recordRunKills(addr, snap.kills)
      }
      // Same reasoning applies to xp/level: combat and progression are now
      // fully off-chain (no executeAction / register() tx), so xp/level live
      // only in Firestore. recordRunProgress keeps the Rewards screen's
      // numbers (which read from useContractPlayer -> this same Firestore
      // doc) in sync with what the in-game HUD actually shows.
      if (typeof snap.xp === 'number' && typeof snap.level === 'number') {
        recordRunProgress(addr, snap.xp, snap.level)
      }
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

  const handleToggleScreenShake = () => {
    const NSG = (window as any).NullStateGame
    const enabled = NSG?.toggleScreenShake?.()
    setScreenShakeEnabled(enabled !== undefined ? !!enabled : !screenShakeEnabled)
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

  // Keep the latest wallet in a ref so the engine bridge always reads
  // current values (wagmi state changes between renders after connect()).
  const walletRef = useRef(wallet)
  walletRef.current = wallet

  // Keep the engine's WALLET_ADDRESS in sync so the 'nullstate-items-burned'
  // event always carries the correct address, even if the wallet connects
  // (or switches accounts) after the engine has already mounted.
  useEffect(() => {
    const NSG = (window as any).NullStateGame
    NSG?.setWalletAddress?.(wallet.address ?? null)
  }, [wallet.address])

  // Issue #2 fix: watch the three vanilla-engine overlay DOM nodes
  // (#invPanel, #containerWindow — e.g. the Rotten Armoire, #vaultWindow)
  // for their 'hidden' class flipping. game.js is the single place that
  // toggles that class open/closed already (openContainerWindow(),
  // toggleInventory(), openVaultWindow(), closeVaultWindow(), etc.) —
  // rather than teaching every one of those call sites to also update React
  // state, observe the DOM once here and derive one boolean from it.
  useEffect(() => {
    // Extended to cover every full-screen overlay the engine uses:
    // itemZoom (tap-to-inspect), liftMenu, death screen, story/tutorial,
    // title screen — all of which can appear while the POINT pill is rendered
    // and would otherwise be occluded by it.
    const ids = ['invPanel', 'containerWindow', 'vaultWindow', 'itemZoom', 'liftMenu', 'death', 'story', 'tutorial']
    const nodes = ids.map(id => document.getElementById(id)).filter((n): n is HTMLElement => !!n)
    if (nodes.length === 0) return

    const recompute = () => {
      const anyOpen = nodes.some(n => !n.classList.contains('hidden'))
      setVanillaOverlayOpen(anyOpen)
    }

    recompute()
    const observer = new MutationObserver(recompute)
    nodes.forEach(n => observer.observe(n, { attributes: true, attributeFilter: ['class'] }))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false

    // The chain bridge handed to the engine. NULL_STRIKE is now FREE
    // (Phase 0 — owner decision): the special is gated by an in-engine
    // cooldown instead of an on-chain fee, so this bridge is a no-op that
    // always resolves successfully. Kept only to satisfy the engine's
    // NS_CHAIN.ultiTx() -> { ok, demo, hash } contract at mount time.
    const chain = {
      async ultiTx() {
        return { ok: true, demo: true, hash: null }
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
      if (target.closest('.inv-panel-inner, .lift-floor-list, .ns-settings-panel, .ns-settings-slider')) return
      e.preventDefault()
    }
    document.addEventListener('touchmove', preventPullToRefresh, { passive: false })

    // Item #10 fix (Option C): holds the detach function returned by
    // attachLiveStatsBridge() once the engine mounts (see below), so the
    // cleanup at the bottom of this effect can tear it down cleanly.
    let detachLiveStatsBridge: (() => void) | null = null

    loadEngine()
      .then(async () => {
        if (cancelled) return
        const NSG = (window as any).NullStateGame
        if (!NSG || typeof NSG.mount !== 'function') return

        const addr = walletRef.current.address
        let savedSession = null as any
        if (addr) {
          if (isNewRun) {
            // Entered via "New Game" (GameFlowManager already asked for
            // confirmation if a save existed — see NewGameConfirmModal).
            // Deliberately skip loadGameSession() so this run always starts
            // from a clean Bunker 1, and proactively clear whatever's left
            // in Firestore so a later "Continue" can't resurrect a session
            // the player was already told would be discarded.
            try { await clearGameSession(addr) } catch { /* best-effort */ }
          } else {
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
          // Refresh the Marketplace "owned equipment" + "equipped slots"
          // caches from the server BEFORE the engine mounts. game.js's
          // newGame() reads these exact localStorage keys synchronously the
          // moment a run starts (see loadPersistedEquipment() in game.js) —
          // without this, a purchase/equip made on another device (or
          // before the reinstall wiped this HP's localStorage) wouldn't
          // show up in the dungeon's Inventory/Gear tab until the player
          // happened to open the Marketplace screen first. Equipped slots
          // are persisted server-side (Firebase, per wallet — see
          // /api/marketplace/equip) precisely so they survive a MiniPay
          // uninstall/reinstall the same way owned items already do; the
          // localStorage copy here is just an instant-read cache of that.
          // Best-effort: if this fails (offline, etc.) whatever's already
          // cached from a previous visit still applies.
          try {
            const res = await fetch(`/api/marketplace/owned?wallet=${addr}`)
            const data = await res.json()
            if (Array.isArray(data?.owned)) {
              localStorage.setItem(`nullstate-owned-${addr.toLowerCase()}`, JSON.stringify(data.owned))
            }
            if (data?.equipped) {
              localStorage.setItem(`nullstate-equipped-${addr.toLowerCase()}`, JSON.stringify(data.equipped))
            }
          } catch {
            /* offline / API unreachable — keep whatever's already cached */
          }
          // TASK #7 — resolve active Season-Pass status (on-chain hasPass) and
          // write the holder flag to localStorage BEFORE the engine mounts, so
          // game.js loadPersistedEquipment() grants the exclusive skin
          // synchronously on this run (mirrors the owned/equipped cache above).
          // The pass status is SHOWN to the player in the Settings modal, not
          // the HUD (owner: no pass badge in-game).
          try {
            const pr = await fetch(`/api/passsbt/perks?wallet=${addr}`)
            const pd = await pr.json()
            const holder = pr.ok && pd?.hasPass === true
            localStorage.setItem(`nullstate-pass-${addr.toLowerCase()}`, holder ? '1' : '0')
          } catch {
            /* offline — keep whatever flag is already cached */
          }
        }
        if (cancelled) return

        // Item #10 fix (Option C): attach the live-stats bridge right before
        // the engine mounts, so game.js's very first updateHUD() call (which
        // fires as part of NSG.mount -> newGame()/loadSession()) already has
        // a listener ready. Detached in this effect's cleanup below.
        detachLiveStatsBridge = attachLiveStatsBridge()

        NSG.mount({
          chain,
          initialStats: playerProfile
            ? { xp: playerProfile.xp, level: playerProfile.level }
            : null,
          savedSession,
          // Phase 1 energy bridge — server-authoritative spend at every
          // FRESH bunker entry. Fail-open by design: wallet-less mounts and
          // network/server errors return ok:true so connectivity can never
          // lock a player out of the game (the server still enforces the
          // real cap next time it's reachable).
          energy: {
            trySpend: async () => {
              const addr = walletRef.current.address
              if (!addr) return { ok: true }
              try {
                const r = await fetch('/api/energy/spend', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ wallet: addr }),
                })
                const d = await r.json()
                if (!r.ok) return { ok: true }
                return d
              } catch {
                return { ok: true }
              }
            },
            onExhausted: (state: { resetAt?: number }) => {
              setEnergyMsg(null)
              setEnergyModal({ resetAt: state?.resetAt || Date.now() + 24 * 3600 * 1000 })
            },
          },
          // Phase 2 materials bridge — banked Glitch Shard balance (cached in
          // a ref for the engine's inventory display) + end-of-run credit.
          materials: {
            banked: () => materialsRef.current,
            credit: async (payout: { t1: number; t2: number; t3: number }) => {
              const addr = walletRef.current.address
              if (!addr) return null
              try {
                const r = await fetch('/api/materials/credit', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ wallet: addr, ...payout }),
                })
                const d = await r.json()
                if (r.ok && d?.success) {
                  materialsRef.current = { t1: d.t1 || 0, t2: d.t2 || 0, t3: d.t3 || 0 }
                }
                return d
              } catch {
                return null
              }
            },
          },
        })
        // Seed the banked-materials cache (best-effort; display-only).
        {
          const addr = walletRef.current.address
          if (addr) {
            fetch(`/api/materials?wallet=${addr}`)
              .then(r => r.json())
              .then(d => {
                if (d && typeof d.t1 === 'number') {
                  materialsRef.current = { t1: d.t1, t2: d.t2 || 0, t3: d.t3 || 0 }
                }
              })
              .catch(() => { /* display-only cache — offline is fine */ })
            // Phase 4 — seed the wallet's weapon-evolution tiers into the engine
            // so an evolved weapon renders its extra ATK + tint/glow the moment
            // this run mounts (NS_EQUIP.setTiers re-applies equipment).
            fetch(`/api/weapons?wallet=${addr}`)
              .then(r => r.json())
              .then(d => {
                const tiers = d && d.tiers && typeof d.tiers === 'object' ? d.tiers : null
                if (tiers) {
                  const NS = (window as unknown as { NS_EQUIP?: { setTiers?: (m: Record<string, number>) => void } }).NS_EQUIP
                  NS?.setTiers?.(tiers)
                }
              })
              .catch(() => { /* offline — base tiers, non-critical */ })
            // Phase 8 — seed owned Premium Sector Blueprints so an owned act's
            // run spawns its guaranteed Glitch-Shard cache (NS_EQUIP.setBlueprints).
            fetch(`/api/blueprints?wallet=${addr}`)
              .then(r => r.json())
              .then(d => {
                const owned = d && Array.isArray(d.owned) ? d.owned : null
                if (owned) {
                  const NS = (window as unknown as { NS_EQUIP?: { setBlueprints?: (l: string[]) => void } }).NS_EQUIP
                  NS?.setBlueprints?.(owned)
                }
              })
              .catch(() => { /* offline — no bonus caches, non-critical */ })
            // TASK #7 — bridge active pass status into the engine so the
            // exclusive skin grant survives a live shop-owned push (setOwned)
            // and the Gear tab re-injects it. The pre-mount localStorage flag
            // already granted it for this run's initial load; this keeps the
            // engine's PASS_HOLDER flag in sync if hasPass resolved late.
            fetch(`/api/passsbt/perks?wallet=${addr}`)
              .then(r => r.json())
              .then(d => {
                const NS = (window as unknown as { NS_EQUIP?: { setPassHolder?: (v: boolean) => void } }).NS_EQUIP
                NS?.setPassHolder?.(d?.hasPass === true)
              })
              .catch(() => { /* offline — flag already applied from localStorage */ })
            refreshElixir() // Phase 3: seed elixir state + mirror the buff global
          }
        }
        NSG.setWalletAddress?.(walletRef.current.address ?? null)
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

    // ── Auto-save (Phase 1: event-driven, Firestore-write-frugal) ──────────
    // Old model: a blind setInterval(silentSave, 15000) wrote the bunker doc
    // AND both leaderboard docs every 15s for every active player. On
    // Firestore's free tier (20k writes/day) that capped us at ~80 concurrent
    // players/hour before writes silently started failing ("game mati diam-
    // diam"). New model:
    //   • Draft the snapshot to localStorage on EVERY meaningful change
    //     (cheap, instant, no quota) so a crash/refresh never loses progress.
    //   • Flush to Firestore only at moments that matter — floor up, level up,
    //     tab-hide/unload — coalesced through a short debounce, plus a slow
    //     60s safety net (was 15s). This lifts the ceiling to ~700-1000
    //     concurrent players/hour on the same free tier.
    const readSnapshot = () => {
      const NSG = (window as any).NullStateGame
      const addr = walletRef.current.address
      if (!NSG || !addr || typeof NSG.getSaveSnapshot !== 'function') return null
      const snap = NSG.getSaveSnapshot()
      return snap ? { addr, snap } : null
    }

    // Tracks whether the local draft has advanced past what's in Firestore,
    // so the slow safety net can skip the write when nothing has changed.
    let dirty = false

    // Cheap local draft — no network, no quota. Called liberally.
    const writeDraft = () => {
      const cur = readSnapshot()
      if (cur) { saveGameSessionDraft(cur.addr, cur.snap); dirty = true }
    }

    // The real network write: bunker snapshot + (for non-guests) leaderboard.
    const flushToFirestore = () => {
      const cur = readSnapshot()
      if (!cur) return
      const { addr, snap } = cur
      saveGameSession(addr, snap)
      clearGameSessionDraft(addr) // draft is now safely upstream
      dirty = false
      // Guests save their bunker but never enter the leaderboard.
      if (!walletRef.current.isGuest && typeof snap.kills === 'number') recordRunKills(addr, snap.kills)
      if (!walletRef.current.isGuest && typeof snap.xp === 'number' && typeof snap.level === 'number') {
        recordRunProgress(addr, snap.xp, snap.level)
      }
    }

    // Debounced flush — coalesces a burst of meaningful events (e.g. a
    // level-up on the same frame as a floor change) into one Firestore write.
    let flushTimer: number | null = null
    const scheduleFlush = () => {
      writeDraft() // capture immediately in case the page dies before the flush
      if (flushTimer !== null) return
      flushTimer = window.setTimeout(() => {
        flushTimer = null
        flushToFirestore()
      }, 2500)
    }

    // Immediate flush for page-teardown paths (tab hide / unload). Cancels any
    // pending debounce so we don't double-write.
    const flushNow = () => {
      if (flushTimer !== null) { window.clearTimeout(flushTimer); flushTimer = null }
      flushToFirestore()
    }

    // Drive flushes off the engine's live-stats announcements (emitted from
    // updateHUD() after every kill/level-up/floor-change/pickup). We only
    // spend a Firestore write when the FLOOR or LEVEL actually advances; every
    // other tick just refreshes the cheap local draft.
    let lastFloor = -1
    let lastLevel = -1
    const unsubscribeStats = subscribeLiveStats((s) => {
      const floorUp = lastFloor >= 0 && s.floor > lastFloor
      const levelUp = lastLevel >= 0 && s.level > lastLevel
      lastFloor = s.floor
      lastLevel = s.level
      if (floorUp || levelUp) scheduleFlush()
      else writeDraft()
    })

    // Death/respawn: fold the run into Firestore right away (the wrapper also
    // records leaderboard kills/xp on this event; this additionally persists
    // the bunker snapshot so "Continue" reflects where they fell).
    const onDeath = () => flushNow()
    window.addEventListener('nullstate-player-death', onDeath)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushNow()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    // pagehide/beforeunload are the teardown backstops for an accidental
    // refresh (pull-to-refresh, reload in OKX/MiniPay's in-app browser) that
    // would otherwise tear the page down before a write reaches the network.
    // The localStorage draft (written on every meaningful change above) is the
    // true belt-and-suspenders here — even if these flushes are cut off, the
    // draft survives the reload.
    window.addEventListener('pagehide', flushNow)
    window.addEventListener('beforeunload', flushNow)
    // Slow safety net (was 15s). Only writes when the draft has advanced
    // since the last flush — an idle player costs zero Firestore writes.
    const autosaveInterval = window.setInterval(() => { if (dirty) flushNow() }, 60000)

    return () => {
      cancelled = true
      document.removeEventListener('touchmove', preventPullToRefresh)
      unsubscribeStats()
      window.removeEventListener('nullstate-player-death', onDeath)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flushNow)
      window.removeEventListener('beforeunload', flushNow)
      if (flushTimer !== null) window.clearTimeout(flushTimer)
      window.clearInterval(autosaveInterval)
      if (detachLiveStatsBridge) detachLiveStatsBridge()
      const NSG = (window as any).NullStateGame
      if (NSG && typeof NSG.unmount === 'function') NSG.unmount()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    // Item #10 fix (Option C): everything rendered below — including
    // SettingsModal — can now call useLiveStats() to read the exact same
    // live xp/level/kills/floor numbers the canvas HUD is painting, instead
    // of a Firestore snapshot that only updates on death/save.
    <LiveStatsProvider>
    <div className="ns-game-root">
      <div id="app">
        <canvas id="game" />

        {/* HUD redesign (owner): the top-left "◂ EXIT" button was removed —
            Exit now lives INSIDE Settings, directly under Save Game (see
            SettingsModal's onExit). That frees the top-left corner so the
            HP/XP bars + the compact stat line can sit flush against it. */}

        {/* Compact stat line — "Point · Level · Floor · Kills", pinned top-left
            just under the bars. Replaces the old standalone POINT pill AND the
            oversized top-right LV/FLOOR/KILLS boxes. Fully unmounts (not just
            z-index'd behind) whenever ANY full-screen overlay is open —
            Settings, the exit-confirm dialog, the inventory panel, a loot
            container, or the weekly Vault — so it never overlaps them. */}
        <HudStatLine
          walletAddress={wallet.address}
          hidden={showSettings || showExitConfirm || vanillaOverlayOpen}
        />

        {/* Low-HP vignette — see #12. Opacity is driven entirely from
            game.js's updateHUD() (proportional to how far below the 20%
            HP threshold the player currently is), never by CSS alone, so
            it always matches the HP bar's own tier exactly. Sits above the
            canvas but below all interactive HUD controls (pointer-events
            stays off so it never blocks taps). */}
        <div id="hpVignette" className="hp-vignette" />

        {/* HUD */}
        <div id="hud" className="hidden">
          {/* HUD redesign (owner): only the HP/XP bars live here now, shifted
              hard into the top-left corner and cropped shorter. The old
              top-right LV/FLOOR/KILLS stat boxes were removed — those numbers
              are now in the compact React <HudStatLine> under the bars (the
              engine still emits them via the live-stats bridge). */}
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
          </div>

          <div id="floorBanner" className="floor-banner" />

          {/* Punch list #1 follow-up (v39b): compact English warning toast,
              shown every time Take/Take All hits an item's stack cap.
              Separate element from #floorBanner on purpose — that one is
              the big lore-y "FLOOR SECURED" banner, this is a small plain
              warning that fades in/out on its own (see showStashFullWarning
              in game.js). */}
          <div id="stashFullWarning" className="stash-full-warning" />

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
          {/* Phase 3 — Drop-Rate Elixir button. Sits under the settings gear
              in the same right-hand control cluster. Shows a live countdown
              badge while the 2× buff is active, or an owned-count badge when
              elixirs are stocked but not yet drunk. */}
          <button
            type="button"
            className="ns-elixir-trigger"
            aria-label="Drop-Rate Elixir"
            onClick={() => { setElixirModal(true); setElixirMsg(null); refreshElixir() }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 3h4M10 3v4.5L6.2 15a3 3 0 0 0 2.7 4.3h6.2a3 3 0 0 0 2.7-4.3L14 7.5V3"
                stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/>
              <path d="M7.4 13h9.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            {elixirActive ? (
              <span className="ns-elixir-badge ns-elixir-badge-timer">
                {(() => {
                  const ms = Math.max(0, elixir.activeUntil - uiNow)
                  const m = Math.floor(ms / 60000)
                  const s = Math.floor((ms % 60000) / 1000)
                  return `${m}:${String(s).padStart(2, '0')}`
                })()}
              </span>
            ) : elixir.owned > 0 ? (
              <span className="ns-elixir-badge">{elixir.owned}</span>
            ) : null}
          </button>
          {/* Inventory — a centered modal (like #containerWindow/#itemZoom)
              rather than a small corner panel, so it never sits under the
              minimap/settings gear and always has room to show a full,
              legible 5-column item grid. */}
          <div id="invPanel" className="overlay hidden">
            <div className="inv-panel-inner">
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
              {/* Phase 2: Glitch Shard strip (run + banked) — filled by
                  updateInventoryPanel() in game.js; hidden until any exist. */}
              <div id="invMaterials" className="inv-materials hidden" />
              <div className="inv-tabs">
                <button className="inv-tab active" data-tab="loot">LOOT</button>
                <button className="inv-tab" data-tab="food">FOOD</button>
                <button className="inv-tab" data-tab="equipment">GEAR</button>
              </div>
              <div id="invItems" className="inv-items">
                <div className="inv-empty" id="invEmpty">No items yet — explore the depths.</div>
              </div>
              <div id="burnSummary" className="burn-summary" />
              <button id="burnConfirm" className="big-btn burn-confirm" disabled>BURN SELECTED</button>
            </div>
          </div>

          <div id="touchControls" className="touch hidden">
            <div id="stick" className="stick"><div id="stickNub" className="nub" /></div>
            <button id="atkBtn" className="atk">⚔</button>
          </div>

          <div className="hint">WASD / Arrows · move&nbsp;&nbsp;·&nbsp;&nbsp;SPACE / J / Click · attack&nbsp;&nbsp;·&nbsp;&nbsp;E · interact</div>
        </div>

        {/* Phase 1 — OUT OF ENERGY modal. Shown when a fresh bunker entry is
            denied by /api/energy/spend. The free path (wait for the 24h
            window) is always shown side-by-side with the paid refill, per
            the blueprint's "tempting, not predatory" guardrail. */}
        {energyModal && (
          <div className="overlay" style={{ zIndex: 40 }}>
            <div className="lift-inner" style={{ textAlign: 'center' }}>
              <div className="logo" style={{ fontSize: '20px' }}>OUT OF ENERGY</div>
              <div className="subtitle">// THE DEPTHS DEMAND REST</div>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: '#cfeede', margin: '14px 0 4px' }}>
                You&apos;ve used your {GAME_CONFIG.energy.freeRunsPerDay} free runs.
              </p>
              <p style={{ fontSize: 13, color: '#ffd166', margin: '0 0 14px' }}>
                Free energy restores in{' '}
                <b>
                  {(() => {
                    const ms = Math.max(0, energyModal.resetAt - energyNow)
                    const h = Math.floor(ms / 3600000)
                    const m = Math.floor((ms % 3600000) / 60000)
                    return `${h}h ${String(m).padStart(2, '0')}m`
                  })()}
                </b>
              </p>
              {energyMsg && (
                <p style={{ fontSize: 12, color: '#9df5cf', margin: '0 0 10px' }}>{energyMsg}</p>
              )}
              <button
                className="big-btn"
                style={{ width: '100%' }}
                disabled={energyBusy}
                onClick={handleEnergyRefill}
              >
                ⚡ REFILL +{GAME_CONFIG.energy.refillRuns} — ${GAME_CONFIG.energy.refillPriceUSD}
              </button>
              <button
                className="ghost-btn"
                style={{ marginTop: 10 }}
                disabled={energyBusy}
                onClick={() => { setEnergyModal(null); setEnergyMsg(null) }}
              >
                ▾ wait for free energy
              </button>
            </div>
          </div>
        )}

        {/* Phase 3 — DROP-RATE ELIXIR modal. Drink an owned elixir to start
            the 30-min 2× drop buff, or buy one for $1. The free path (playing
            without the buff) is inherent — this only sweetens loot, never
            gates it — so no "wait" CTA is needed here. */}
        {elixirModal && (
          <div className="overlay" style={{ zIndex: 40 }}>
            <div className="lift-inner" style={{ textAlign: 'center' }}>
              <div className="logo" style={{ fontSize: '20px' }}>DROP-RATE ELIXIR</div>
              <div className="subtitle">// SHARPEN THE LOOT</div>
              {elixirActive ? (
                <p style={{ fontSize: 13, color: '#b46bff', margin: '14px 0 4px' }}>
                  ✦ Buff active —{' '}
                  <b>
                    {(() => {
                      const ms = Math.max(0, elixir.activeUntil - uiNow)
                      const m = Math.floor(ms / 60000)
                      const s = Math.floor((ms % 60000) / 1000)
                      return `${m}:${String(s).padStart(2, '0')}`
                    })()}
                  </b>{' '}
                  left
                </p>
              ) : (
                <p style={{ fontSize: 13, lineHeight: 1.6, color: '#cfeede', margin: '14px 0 4px' }}>
                  Doubles your chance at rarer loot for {GAME_CONFIG.elixir.durationMin} minutes.
                </p>
              )}
              <p style={{ fontSize: 12, color: '#9db4c4', margin: '0 0 12px' }}>
                In stock: <b style={{ color: '#eafff5' }}>{elixir.owned}</b>
              </p>
              {elixirMsg && (
                <p style={{ fontSize: 12, color: '#9df5cf', margin: '0 0 10px' }}>{elixirMsg}</p>
              )}
              <button
                className="big-btn"
                style={{ width: '100%' }}
                disabled={elixirBusy || elixir.owned < 1}
                onClick={handleElixirUse}
              >
                ✦ DRINK ELIXIR{elixir.owned > 0 ? ` (${elixir.owned})` : ''}
              </button>
              <button
                className="big-btn"
                style={{ width: '100%', marginTop: 10 }}
                disabled={elixirBusy}
                onClick={handleElixirBuy}
              >
                ⚗ BUY ELIXIR — ${GAME_CONFIG.elixir.priceUSD}
              </button>
              <button
                className="ghost-btn"
                style={{ marginTop: 10 }}
                disabled={elixirBusy}
                onClick={() => { setElixirModal(false); setElixirMsg(null) }}
              >
                ▾ close
              </button>
            </div>
          </div>
        )}

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
            <div className="char-select char-select-single">
              <div className="char-btn selected" data-char="knight">
                <div className="char-prev" id="prevKnight" /><span>KNIGHT</span>
              </div>
            </div>
            <button id="startBtn" className="big-btn">DESCEND ▾</button>
            <div className="title-foot">Every fall costs you. The depths remember.</div>
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

        {/* Context-sensitive action button — shows "⚡ NULL_STRIKE" near a
            boss in range, or "▤ OPEN" near a clear-room container. Driven
            every frame by updateActionButton() in game.js. */}
        <button id="actionBtn" className="action-btn hidden" />

        {/* Dual-panel container window (loot on the left, your stash on
            the right — mirrors renderContainerSlots()/renderStashPanel()
            in game.js). */}
        <div id="containerWindow" className="overlay hidden">
          <div className="container-inner">
            <div id="containerTitle" className="container-title" />
            <div className="container-panels">
              <div id="containerLootPanel" className="container-panel loot-panel">
                <div className="container-panel-label">LOOT</div>
                <div id="containerItems" className="inv-items container-items" />
                <div id="containerEmpty" className="inv-empty">Empty.</div>
              </div>
              <div className="container-panel inv-panel">
                <div className="container-panel-label">YOUR INVENTORY</div>
                <div id="containerPlayerItems" className="inv-items container-items" />
                <div id="containerPlayerEmpty" className="inv-empty">No items yet.</div>
              </div>
            </div>
            <div className="container-btns">
              <button id="containerTakeAll" className="big-btn">TAKE ALL</button>
              <button id="containerClose" className="ghost-btn">▾ close</button>
            </div>
          </div>
        </div>

        {/* Weekly Vault code-submit window (Bunker 5 "THE LAST LIGHT",
            Phase 5.5 #9C/#10) — appears when the player OPENs the sealed
            vault door that spawns after that bunker's boss falls. Talks to
            /api/vault/submit directly from game.js (see
            openVaultWindow()/submitVaultCode()); no React state needed. */}
        <div id="vaultWindow" className="overlay hidden">
          <div className="vault-inner">
            <div className="vault-title">SEALED VAULT DOOR</div>
            <div className="vault-sub">Enter the 4-digit code from this week&apos;s Paper.</div>
            <input id="vaultCodeInput" className="vault-code-input" inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="0000" autoComplete="off" />
            <div id="vaultMsg" className="vault-msg" />
            <div className="vault-btns">
              <button id="vaultSubmitBtn" className="big-btn">SUBMIT</button>
              <button id="vaultClose" className="ghost-btn">▾ close</button>
            </div>
          </div>
        </div>

        {/* Item zoom overlay — opened by tapping a slot in #invPanel (stash,
            shows BURN) or the LOOT side of #containerWindow (container slot,
            shows TAKE). Only one of the two action buttons is ever visible
            at a time; toggled in game.js via openItemZoom()/closeItemZoom(). */}
        <div id="itemZoom" className="overlay hidden">
          <div className="item-zoom-inner">
            {/* Wrapper is position:relative so the Paper code (below) can sit
                overlaid directly on top of the icon art like ink on paper,
                instead of as a separate block underneath. Only meaningful in
                'paper-code' mode — game.js toggles the .paper-code modifier
                on this wrap; every other mode renders it at the old plain
                88x88 size with the code hidden, unaffected. */}
            <div id="itemZoomIconWrap" className="item-zoom-icon-wrap">
              <img id="itemZoomIcon" className="item-zoom-icon" src="" alt="" draggable={false} />
              {/* Paper reveal (Phase 5.5 #9B) — shows this week's shared vault
                  code, fetched live from /api/paper/status when opened in
                  'paper-code' mode. Hidden/empty for every other mode. */}
              <div id="itemZoomCode" className="item-zoom-code hidden" />
            </div>
            <div id="itemZoomName" className="item-zoom-name" />
            <div id="itemZoomQty" className="item-zoom-qty" />
            <div id="itemZoomValue" className="item-zoom-value" />
            <div className="item-zoom-btns">
              <button id="itemZoomTake" className="item-zoom-btn take hidden">TAKE</button>
              <button id="itemZoomBurn" className="item-zoom-btn burn hidden">BURN</button>
            </div>
            <button id="itemZoomClose" className="item-zoom-close">▾ close</button>
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
        screenShakeEnabled={screenShakeEnabled}
        onToggleScreenShake={handleToggleScreenShake}
        onSaveGame={handleSaveGame}
        setPlayerUsername={setPlayerUsername}
        onExit={() => { setShowSettings(false); handleExitClick() }}
      />
      <SaveConfirmModal
        open={showExitConfirm}
        canSave={!!sessionStats}
        onSaveAndExit={handleSaveAndExit}
        onExitWithoutSaving={handleExitWithoutSaving}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
    </LiveStatsProvider>
  )
}
