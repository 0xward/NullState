'use client'

import { useState } from 'react'
import { formatUnits } from 'viem'
import { useReward } from '@/hooks/useReward'

interface RewardClaimButtonProps {
  walletAddress?: string
}

export default function RewardClaimButton({ walletAddress }: RewardClaimButtonProps) {
  const {
    weeklyClaimable,
    hasClaimedSeasonBonus,
    seasonLeaderboard,
    isLoading,
    claimWeeklyRewards,
    claimSeasonBonus,
    currentSeason,
  } = useReward(walletAddress)
  const [status, setStatus] = useState<string | null>(null)

  const canClaimWeekly = Boolean(walletAddress) && weeklyClaimable > BigInt(0)
  const canClaimSeason =
    Boolean(walletAddress) &&
    !hasClaimedSeasonBonus &&
    !!seasonLeaderboard?.topPlayers.includes(walletAddress as `0x${string}`)

  return (
    <section className="rounded-xl border border-[rgba(255,190,11,0.25)] bg-[rgba(20,14,3,0.6)] p-5">
      <h2 className="font-mono text-sm uppercase tracking-[2px] text-null-amber">Reward Claim</h2>
      <p className="mt-2 text-sm text-null-muted">Weekly claimable: {formatUnits(weeklyClaimable, 18)} USDm</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={async () => {
            try {
              const tx = await claimWeeklyRewards()
              setStatus(`Weekly reward claimed: ${tx.hash.slice(0, 10)}...`)
            } catch (error) {
              setStatus(error instanceof Error ? error.message : 'Failed to claim weekly reward')
            }
          }}
          disabled={!canClaimWeekly || isLoading}
          className="rounded-md border border-null-green px-4 py-2 font-mono text-xs uppercase tracking-[2px] text-null-green transition hover:bg-null-green hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
          aria-disabled={!canClaimWeekly || isLoading}
        >
          {isLoading ? 'Processing...' : 'Claim Weekly'}
        </button>

        <button
          onClick={async () => {
            try {
              const tx = await claimSeasonBonus(currentSeason)
              setStatus(`Season bonus claimed: ${tx.hash.slice(0, 10)}...`)
            } catch (error) {
              setStatus(error instanceof Error ? error.message : 'Failed to claim season bonus')
            }
          }}
          disabled={!canClaimSeason || isLoading}
          className="rounded-md border border-null-blue px-4 py-2 font-mono text-xs uppercase tracking-[2px] text-null-blue transition hover:bg-null-blue hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
          aria-disabled={!canClaimSeason || isLoading}
        >
          {isLoading ? 'Processing...' : 'Claim Season Bonus'}
        </button>
      </div>

      <p className="mt-3 text-sm text-null-muted" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  )
}
