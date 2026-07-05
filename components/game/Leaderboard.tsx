'use client'

import { useState, useEffect } from 'react'
import { LeaderboardEntry } from '@/lib/contract'

interface LeaderboardProps {
  onBack: () => void
  isLoading: boolean
  entries: LeaderboardEntry[]
}

export default function Leaderboard({
  onBack,
  isLoading,
  entries,
}: LeaderboardProps) {
  const [displayEntries, setDisplayEntries] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    // Sort by XP descending, assign ranks
    const sorted = [...entries]
      .sort((a, b) => b.xp - a.xp)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }))
    setDisplayEntries(sorted)
  }, [entries])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[rgba(0,0,0,0.95)] p-6 overflow-y-auto">
      {/* Glow orb */}
      <div
        className="absolute pointer-events-none inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 30%, rgba(0,170,255,0.08) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="font-mono text-[10px] tracking-[6px] text-null-blue uppercase mb-2">
              // GLOBAL LEADERBOARD
            </div>
            <h2 className="font-display font-black text-null-white" style={{ fontSize: '48px' }}>
              TOP PLAYERS
            </h2>
          </div>

          <button
            onClick={onBack}
            className="font-mono text-xs tracking-[2px] uppercase text-null-green border border-[rgba(0,255,136,0.4)] px-4 py-2 transition-all duration-200 hover:border-null-green hover:bg-[rgba(0,255,136,0.05)]"
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

        {/* Table */}
        {!isLoading && displayEntries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="border-b border-[rgba(0,255,136,0.2)]">
                  <th className="text-left py-3 px-4 text-null-green font-bold tracking-[1px] text-xs uppercase">
                    RANK
                  </th>
                  <th className="text-left py-3 px-4 text-null-green font-bold tracking-[1px] text-xs uppercase">
                    USERNAME
                  </th>
                  <th className="text-right py-3 px-4 text-null-green font-bold tracking-[1px] text-xs uppercase">
                    LEVEL
                  </th>
                  <th className="text-right py-3 px-4 text-null-green font-bold tracking-[1px] text-xs uppercase">
                    XP
                  </th>
                  <th className="text-right py-3 px-4 text-null-green font-bold tracking-[1px] text-xs uppercase">
                    KILLS
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayEntries.map((entry, index) => (
                  <tr
                    key={entry.walletAddress}
                    className="border-b border-[rgba(0,255,136,0.1)] hover:bg-[rgba(0,255,136,0.05)] transition-colors"
                  >
                    <td className="py-4 px-4">
                      <span
                        className={`font-bold ${
                          entry.rank === 1
                            ? 'text-[#ffd700]'
                            : entry.rank === 2
                              ? 'text-[#c0c0c0]'
                              : entry.rank === 3
                                ? 'text-[#cd7f32]'
                                : 'text-null-muted'
                        }`}
                      >
                        #{entry.rank}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-null-acid font-bold">
                      {entry.username}
                    </td>
                    <td className="py-4 px-4 text-right text-null-green">
                      {entry.level}
                    </td>
                    <td className="py-4 px-4 text-right text-null-blue">
                      {entry.xp.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-right text-null-red">
                      {entry.kills}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        <div className="mt-12 pt-8 border-t border-[rgba(0,255,136,0.2)]">
          <p className="text-null-muted font-mono text-[10px] tracking-[2px] uppercase">
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
