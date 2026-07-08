'use client'

import { useEffect, useState } from 'react'
import { formatUnits } from 'viem'
import { useReward } from '@/hooks/useReward'

interface LeaderboardEntry {
  rank: number
  player: string
  score: number
  username?: string
}

interface LeaderboardDisplayProps {
  walletAddress?: string
}

export default function LeaderboardDisplay({ walletAddress }: LeaderboardDisplayProps) {
  const { currentSeason, seasonLeaderboard, fetchSeasonLeaderboard } = useReward(walletAddress)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        await fetchSeasonLeaderboard()
        const res = await fetch(`/api/leaderboard?seasonId=${currentSeason.toString()}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to load leaderboard')
        setEntries(data.leaderboard ?? [])
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load leaderboard')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [currentSeason, fetchSeasonLeaderboard])

  return (
    <section className="rounded-xl border border-[rgba(0,170,255,0.25)] bg-[rgba(2,9,15,0.6)] p-5">
      <h2 className="font-mono text-sm uppercase tracking-[2px] text-null-blue">Season Leaderboard</h2>
      <p className="mt-2 text-sm text-null-muted">Season {currentSeason.toString()}</p>

      {seasonLeaderboard && (
        <p className="mt-2 text-xs text-null-muted">
          Total deposited: {formatUnits(seasonLeaderboard.totalDeposited, 18)}
        </p>
      )}

      {isLoading && <p className="mt-4 text-sm text-null-muted">Loading leaderboard...</p>}
      {error && <p className="mt-4 text-sm text-null-red">{error}</p>}

      {!isLoading && !error && (
        <ol className="mt-4 space-y-2" aria-label="Season rankings">
          {entries.slice(0, 10).map((entry) => (
            <li key={`${entry.player}-${entry.rank}`} className="flex items-center justify-between rounded border border-white/10 px-3 py-2 text-sm">
              <span className="font-mono text-null-green">#{entry.rank}</span>
              <span className="truncate px-3 text-null-white">{entry.username ?? `${entry.player.slice(0, 6)}...${entry.player.slice(-4)}`}</span>
              <span className="font-mono text-null-blue">{entry.score.toLocaleString()}</span>
            </li>
          ))}
          {entries.length === 0 && <li className="text-sm text-null-muted">No rankings available yet.</li>}
        </ol>
      )}
    </section>
  )
}
