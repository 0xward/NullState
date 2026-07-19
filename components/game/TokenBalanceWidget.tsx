'use client'

import { useEffect, useState, useCallback } from 'react'

interface TokenBalanceWidgetProps {
  walletAddress?: string | null
  /** Issue 2 fix: set to true when ANY full-screen modal or overlay is open
   *  (React-managed or vanilla-JS).  DungeonGame.tsx computes this via
   *  useState + MutationObserver and passes it down.  When true the widget
   *  is fully unmounted — not z-index'd behind — so it never overlaps
   *  inventory / container / item-zoom / vault / settings / exit-confirm. */
  hidden?: boolean
}

// Small fixed overlay, sibling of #app, shown just under the EXIT button.
// Replaces the old ClaimWeeklyWidget (Phase 5.5 #8) — burning no longer
// feeds an on-chain USDm weekly pool that needs a manual claim tx; NullState
// Point is credited instantly and off-chain (see /api/burn/record), so
// this widget is just a live balance readout, no claim button needed.
// Only renders once there's a connected wallet with a non-zero balance —
// otherwise it would just be dead chrome sitting on top of the game.
export default function TokenBalanceWidget({ walletAddress, hidden }: TokenBalanceWidgetProps) {
  const address = walletAddress ?? undefined
  const [balance, setBalance] = useState<number | null>(null)

  const refresh = useCallback(() => {
    if (!address) return
    fetch(`/api/player/profile?walletAddress=${address}`)
      .then(r => r.json())
      .then(d => {
        const bal = d?.summary?.nullstateTokenBalance
        setBalance(typeof bal === 'number' ? bal : 0)
      })
      .catch(() => { /* offline — keep last known value */ })
  }, [address])

  useEffect(() => {
    refresh()
    // Burns happen mid-run inside the canvas — poll occasionally so the
    // overlay reflects a fresh burn without requiring a page reload.
    const id = setInterval(refresh, 20000)
    return () => clearInterval(id)
  }, [refresh])

  // Issue 2 fix: fully unmount (not just invisible) when any overlay is open.
  // `hidden` is computed in DungeonGame.tsx from both React modal state and a
  // MutationObserver on the vanilla-engine overlay DOM nodes.
  if (!address || !balance || hidden) return null

  return (
    // v81 (owner): the old wide "NULLSTATE POINT" box blocked too much of the
    // playfield. Now a compact one-line "POINT <n>" chip pinned just under
    // the EXIT button (top-left), inline-positioned so no stylesheet cascade
    // can push it back into the middle of the screen.
    <div
      className="ns-token-widget"
      style={{
        position: 'fixed',
        top: 56,
        left: 12,
        zIndex: 30,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderRadius: 6,
        border: '1px solid rgba(0,255,136,0.25)',
        background: 'rgba(6,10,13,0.82)',
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 10,
        lineHeight: 1.2,
      }}
    >
      <span style={{ color: '#00ff88', letterSpacing: 1 }}>POINT</span>
      <span style={{ color: '#eafff5', fontSize: 11 }}>{Math.round(balance)}</span>
    </div>
  )
}
