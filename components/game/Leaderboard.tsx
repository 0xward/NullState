'use client'

import { useState, useEffect } from 'react'
import { LeaderboardEntry } from '@/lib/contract'

interface LeaderboardProps {
  onBack: () => void
  isLoading: boolean
  entries: LeaderboardEntry[]
}

const PAGE_SIZE = 10

export default function Leaderboard({
  onBack,
  isLoading,
  entries,
}: LeaderboardProps) {
  const [displayEntries, setDisplayEntries] = useState<LeaderboardEntry[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    // Sort by XP descending, assign ranks
    const sorted = [...entries]
      .sort((a, b) => b.xp - a.xp)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }))
    setDisplayEntries(sorted)
    setVisibleCount(PAGE_SIZE) // reset pagination whenever entries change
  }, [entries])

  const visibleEntries = displayEntries.slice(0, visibleCount)
  const hasMore = visibleCount < displayEntries.length

  const rankColor = (rank: number) =>
    rank === 1
      ? 'text-[#ffd700]'
      : rank === 2
        ? 'text-[#c0c0c0]'
        : rank === 3
          ? 'text-[#cd7f32]'
          : 'text-null-muted'

  // Bonus badge for the top 3 — a medal emoji shown next to the rank
  // number, plus a subtle tinted row background so the podium stands out
  // at a glance while scrolling a long list.
  const rankMedal = (rank: number) =>
    rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

  const rankRowBg = (rank: number) =>
    rank === 1
      ? 'bg-[rgba(255,215,0,0.06)]'
      : rank === 2
        ? 'bg-[rgba(192,192,192,0.06)]'
        : rank === 3
          ? 'bg-[rgba(205,127,50,0.06)]'
          : ''

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[rgba(0,0,0,0.95)] p-4 sm:p-6 overflow-y-auto">
      {/* Glow orb */}
      <div
        className="absolute pointer-events-none inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 30%, rgba(0,170,255,0.08) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[9px] sm:text-[10px] tracking-[4px] sm:tracking-[6px] text-null-blue uppercase mb-1 sm:mb-2">
              // GLOBAL LEADERBOARD
            </div>
            <h2
              className="font-display font-black text-null-white leading-none"
              style={{ fontSize: 'clamp(28px, 8vw, 48px)' }}
            >
              TOP PLAYERS
            </h2>
          </div>

          <button
            onClick={onBack}
            className="shrink-0 font-mono text-[10px] sm:text-xs tracking-[1px] sm:tracking-[2px] uppercase text-null-green border border-[rgba(0,255,136,0.4)] px-2.5 sm:px-4 py-1.5 sm:py-2 transition-all duration-200 hover:border-null-green hover:bg-[rgba(0,255,136,0.05)]"
            style={{
              clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)',
            }}
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-null-green font-mono text-sm mb-4 animate-pulse">
                // fetching leaderboard from blockchain...
              </div>
              <div className="inline-block">
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    border: '2px solid rgba(0,255,136,0.2)',
                    borderTopColor: 'var(--null-green)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Table (grid-based, fits narrow mobile widths without horizontal scroll) */}
        {!isLoading && displayEntries.length > 0 && (
          <div className="font-mono">
            {/* Header row */}
            <div
              className="grid items-center border-b border-[rgba(0,255,136,0.2)] py-2 px-1 sm:px-2 text-null-green font-bold uppercase text-[9px] sm:text-xs tracking-[0.5px] sm:tracking-[1px]"
              style={{ gridTemplateColumns: '32px 1fr 34px 56px 40px' }}
            >
              <span>RK</span>
              <span>USERNAME</span>
              <span className="text-right">LVL</span>
              <span className="text-right">XP</span>
              <span className="text-right">KILL</span>
            </div>

            {/* Rows */}
            {visibleEntries.map((entry) => (
              <div
                key={entry.walletAddress}
                className={`grid items-center border-b border-[rgba(0,255,136,0.1)] py-2.5 sm:py-3 px-1 sm:px-2 text-xs sm:text-sm hover:bg-[rgba(0,255,136,0.05)] transition-colors ${rankRowBg(entry.rank)}`}
                style={{ gridTemplateColumns: '32px 1fr 34px 56px 40px' }}
              >
                <span className={`font-bold ${rankColor(entry.rank)} flex items-center gap-0.5`}>
                  {rankMedal(entry.rank) ? (
                    <span aria-hidden="true">{rankMedal(entry.rank)}</span>
                  ) : (
                    `#${entry.rank}`
                  )}
                </span>
                <span className="text-null-acid font-bold truncate pr-1">
                  {entry.username}
                </span>
                <span className="text-right text-null-green">{entry.level}</span>
                <span className="text-right text-null-blue">
                  {entry.xp.toLocaleString()}
                </span>
                <span className="text-right text-null-red">{entry.kills}</span>
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center pt-5">
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="font-mono text-[10px] sm:text-xs tracking-[1px] sm:tracking-[2px] uppercase text-null-blue border border-[rgba(0,170,255,0.4)] px-4 py-2 transition-all duration-200 hover:border-null-blue hover:bg-[rgba(0,170,255,0.08)]"
                  style={{
                    clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)',
                  }}
                >
                  Load More ({Math.min(visibleCount + PAGE_SIZE, displayEntries.length)}/{displayEntries.length})
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && displayEntries.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-null-muted font-mono text-sm mb-4">
                // no players on leaderboard yet
              </p>
              <p className="text-null-green text-xs font-mono">
                be the first to register and climb the ranks!
              </p>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-10 sm:mt-12 pt-6 sm:pt-8 border-t border-[rgba(0,255,136,0.2)]">
          <p className="text-null-muted font-mono text-[9px] sm:text-[10px] tracking-[1px] sm:tracking-[2px] uppercase">
            // data fetched from celoscan registry
            <br />
            total players: {displayEntries.length}
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
