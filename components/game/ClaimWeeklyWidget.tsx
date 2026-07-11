'use client'

import { useState } from 'react'
import { formatUnits } from 'viem'
import { useReward } from '@/hooks/useReward'

interface ClaimWeeklyWidgetProps {
  walletAddress?: string | null
}

// Small fixed overlay, sibling of #app, shown just under the EXIT button.
// Only renders once there's a connected wallet AND something claimable —
// otherwise it would just be dead chrome sitting on top of the game.
export default function ClaimWeeklyWidget({ walletAddress }: ClaimWeeklyWidgetProps) {
  const address = walletAddress ?? undefined
  const { weeklyClaimable, isLoading, claimWeeklyRewards } = useReward(address)
  const [status, setStatus] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)

  if (!address || weeklyClaimable <= BigInt(0)) return null

  const handleClaim = async () => {
    setClaiming(true)
    setStatus(null)
    try {
      const tx = await claimWeeklyRewards()
      setStatus(`Claimed · ${tx.hash.slice(0, 8)}…`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Claim failed')
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 56,
        left: 12,
        zIndex: 30,
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 10,
        border: '1px solid rgba(0,255,136,0.25)',
        background: 'rgba(6,10,13,0.88)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        fontFamily: "'Share Tech Mono', monospace",
        maxWidth: 220,
      }}
    >
      <div style={{ fontSize: 10, lineHeight: 1.4 }}>
        <div style={{ color: '#00ff88', letterSpacing: 1 }}>WEEKLY REWARD</div>
        <div style={{ color: '#eafff5', fontSize: 11 }}>
          {formatUnits(weeklyClaimable, 18)} USDm
        </div>
        {status && <div style={{ color: '#9fc3b4', marginTop: 2 }}>{status}</div>}
      </div>
      <button
        type="button"
        onClick={handleClaim}
        disabled={claiming || isLoading}
        style={{
          flexShrink: 0,
          cursor: claiming || isLoading ? 'wait' : 'pointer',
          padding: '6px 12px',
          borderRadius: 6,
          border: 'none',
          color: '#04110b',
          background: 'linear-gradient(180deg,#00ff88,#06c46a)',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 10,
          letterSpacing: 1,
          fontWeight: 700,
          opacity: claiming || isLoading ? 0.6 : 1,
        }}
      >
        {claiming ? '...' : 'CLAIM'}
      </button>
    </div>
  )
}
