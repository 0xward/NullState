'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePublicClient } from 'wagmi'
import { useWallet, CELO_CHAIN_ID } from '@/lib/WalletProvider'

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
  '/game-engine/dungeon.js',
  '/game-engine/props.js',
  '/game-engine/entities.js',
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

export default function DungeonGame() {
  const wallet = useWallet()
  const publicClient = usePublicClient({ chainId: CELO_CHAIN_ID })

  // Keep the latest wallet/client in refs so the engine bridge always reads
  // current values (wagmi state changes between renders after connect()).
  const walletRef = useRef(wallet)
  const clientRef = useRef(publicClient)
  walletRef.current = wallet
  clientRef.current = publicClient

  useEffect(() => {
    let cancelled = false

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
            damageDealt: clampU32(damage),
            damageReceived: 0,
            xpGained: Math.max(0, Math.round(xp || 0)),
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

    loadEngine()
      .then(() => {
        if (cancelled) return
        const NSG = (window as any).NullStateGame
        if (NSG && typeof NSG.mount === 'function') NSG.mount({ chain })
      })
      .catch(err => console.error('NullState engine failed to load:', err))

    return () => {
      cancelled = true
      const NSG = (window as any).NullStateGame
      if (NSG && typeof NSG.unmount === 'function') NSG.unmount()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="ns-game-root">
      <div id="app">
        <canvas id="game" />

        {/* Back to site */}
        <Link href="/" className="ns-back" aria-label="Back to NullState home">
          ◂ EXIT
        </Link>

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
              <button id="muteBtn" title="Mute / Unmute">♪</button>
            </div>
          </div>

          <div id="floorBanner" className="floor-banner" />

          <div id="log" className="log" />

          {/* Inventory button sits just under the canvas-drawn minimap
              (top-right) and toggles the inventory panel. */}
          <button id="invBtn" className="inv-btn" aria-label="Inventory">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 9V7a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <rect x="4" y="9" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M4 13h16" stroke="currentColor" strokeWidth="1.2" opacity="0.55"/>
              <rect x="10" y="11.4" width="4" height="3.2" stroke="currentColor" strokeWidth="1.2"/>
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
        <div id="loadingFade" className="loading-fade hidden" />

        {/* Title screen */}
        <div id="title" className="overlay">
          <div className="title-inner">
            <div className="logo">NULL_STATE</div>
            <div className="subtitle">// THE FORSAKEN DEPTHS</div>
            <p className="lore" id="titleLore" />
            <div className="char-select">
              <button className="char-btn selected" data-char="male">
                <div className="char-prev" id="prevMale" /><span>VOID WALKER</span>
              </button>
              <button className="char-btn" data-char="female">
                <div className="char-prev" id="prevFemale" /><span>ASH SEEKER</span>
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
    </div>
  )
}
