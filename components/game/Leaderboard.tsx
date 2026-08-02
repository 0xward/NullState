'use client'

import { useState, useEffect } from 'react'
import { GiMedal } from 'react-icons/gi'
import { LeaderboardEntry } from '@/lib/contract'
import {
  PAID_RANKS, ONCHAIN_RANKS, SEASON_POOL_USD, SEASON_PAYOUT_TOKEN, rewardForRank,
} from '@/lib/constants/seasonRewards'

// What the frozen season snapshot looks like coming out of /api/season/status.
// That route is public on purpose: who won a finished season, and whether they
// have been paid, is exactly the thing players should be able to check without
// asking anyone.
interface SeasonWinnerRow { rank: number; wallet: string; username: string; xp: number; rewardUsd: number }
interface SeasonStatusResponse {
  lastClosedSeasonId?: number
  snapshot?: { seasonId: number; winners: SeasonWinnerRow[]; paidAt: number | null } | null
}

const seasonLabel = (id: number | undefined) => {
  if (!id || !Number.isFinite(id)) return ''
  const y = Math.floor(id / 100), m = id % 100
  if (m < 1 || m > 12) return String(id)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

interface LeaderboardProps {
  onBack: () => void
  isLoading: boolean
  entries: LeaderboardEntry[]
  // Connected wallet's address (if any) — used only to highlight the
  // player's own row in the list below. Addresses are compared
  // case-insensitively since checksummed vs lowercase casing can differ
  // between where entries come from (contract reads) and the wallet hook.
  currentWalletAddress?: string | null
}

const PAGE_SIZE = 10
// One definition, used by the header and every row. They were two copies of the
// same literal, which is how a column gets added to one and not the other.
const GRID = '32px 1fr 56px 40px 46px'

export default function Leaderboard({
  onBack,
  isLoading,
  entries,
  currentWalletAddress,
}: LeaderboardProps) {
  const [displayEntries, setDisplayEntries] = useState<LeaderboardEntry[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  // Last season's FROZEN result. Owner: "tampilkan juga di leaderboard musim
  // lalu." Until now the only place this existed was /stats — an operator page
  // — so the players who competed for it could not see who had won or whether
  // they had been paid. Degrades to "section hidden" rather than to an error:
  // this is a live board and a season that has not closed yet is the normal
  // case, not a failure.
  const [season, setSeason] = useState<SeasonStatusResponse | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/season/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && !d.error) setSeason(d) })
      .catch(() => { /* offline — the section simply does not render */ })
    return () => { alive = false }
  }, [])

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

  // Bonus badge for the top 3 — a colored medal icon shown next to the rank
  // number, plus a subtle tinted row background so the podium stands out
  // at a glance while scrolling a long list.
  const rankMedal = (rank: number) => {
    const color = rank === 1 ? '#ffd166' : rank === 2 ? '#c8d0d8' : rank === 3 ? '#cd7f32' : null
    return color ? <GiMedal aria-hidden style={{ color }} /> : null
  }

  const isOwnRow = (walletAddress: string) =>
    !!currentWalletAddress &&
    walletAddress.toLowerCase() === currentWalletAddress.toLowerCase()

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
            className="shrink-0 inline-flex items-center justify-center min-h-11 font-mono text-[10px] sm:text-xs tracking-[1px] sm:tracking-[2px] uppercase text-null-green border border-[rgba(0,255,136,0.4)] px-3 sm:px-4 py-2 transition-all duration-200 hover:border-null-green hover:bg-[rgba(0,255,136,0.05)]"
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
              style={{ gridTemplateColumns: GRID }}
            >
              <span>RK</span>
              <span>USERNAME</span>
              <span className="text-right">XP</span>
              <span className="text-right">KILL</span>
              {/* The reward replaces LVL. A level is a number about the past;
                  the prize is the reason the row above you matters. */}
              <span className="text-right">PRIZE</span>
            </div>

            {/* Rows */}
            {visibleEntries.map((entry) => {
              const own = isOwnRow(entry.walletAddress)
              return (
                <div
                  key={entry.walletAddress}
                  className={`grid items-center border-b py-2.5 sm:py-3 px-1 sm:px-2 text-xs sm:text-sm transition-colors ${
                    own
                      ? 'border-[rgba(0,255,136,0.5)] bg-[rgba(0,255,136,0.1)]'
                      : `border-[rgba(0,255,136,0.1)] hover:bg-[rgba(0,255,136,0.05)] ${rankRowBg(entry.rank)}`
                  }`}
                  style={own ? { gridTemplateColumns: GRID, boxShadow: 'inset 2px 0 0 var(--null-green, #00ff88)' } : { gridTemplateColumns: GRID }}
                >
                  <span className={`font-bold ${rankColor(entry.rank)} flex items-center gap-0.5`}>
                    {rankMedal(entry.rank) ?? `#${entry.rank}`}
                  </span>
                  <span className="text-null-acid font-bold truncate pr-1 flex items-center gap-1.5">
                    <span className="truncate">{entry.username}</span>
                    {own && (
                      <span className="shrink-0 text-[8px] sm:text-[9px] tracking-[1px] font-mono text-null-green border border-[rgba(0,255,136,0.5)] rounded px-1 py-0.5">
                        YOU
                      </span>
                    )}
                  </span>
                  <span className="text-right text-null-blue">
                    {entry.xp.toLocaleString()}
                  </span>
                  <span className="text-right text-null-red">{entry.kills}</span>
                  {/* Blank, not "$0", outside the prize. A zero reads as a prize
                      that was won and lost; nothing reads as a line to climb to. */}
                  <span
                    className="text-right font-bold"
                    style={{ color: rewardForRank(entry.rank) ? '#7ef0a6' : 'rgba(255,255,255,.18)' }}
                    title={rewardForRank(entry.rank)
                      ? `Rank ${entry.rank} pays $${rewardForRank(entry.rank)} ${SEASON_PAYOUT_TOKEN} when the season ends`
                      : `Only the top ${PAID_RANKS} are paid`}
                  >
                    {rewardForRank(entry.rank) ? `$${rewardForRank(entry.rank)}` : '–'}
                  </span>
                </div>
              )
            })}

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

        {/* ── WHAT THE BOARD IS WORTH ──────────────────────────────────────
            Sits directly under the table, because "why am I trying to be 7th"
            is a question the table itself cannot answer. The split between the
            three that are claimed in-app and the seven that are sent directly
            is stated rather than glossed: the contract takes address[3] and
            has no fourth slot, so promising ranks 4-10 a claim button would be
            promising something that cannot exist.

            Not gated on `isLoading` or on there being any entries. This is
            static copy about what the season pays — it is true before the
            table arrives, and it must not disappear because Firestore is slow.
            Gating it on the fetch is how the one part of this screen that
            explains the money ends up hidden behind a spinner that, when the
            read never settles, never goes away. */}
        {(
          <div className="mt-8 rounded-md border border-[rgba(255,209,102,0.28)] bg-[rgba(255,209,102,0.05)] p-4 font-mono">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[2px]" style={{ color: '#ffd166' }}>
              Season prize · ${SEASON_POOL_USD} {SEASON_PAYOUT_TOKEN}
            </p>
            <p className="text-[10px] leading-relaxed text-null-muted">
              The top {PAID_RANKS} by XP are paid when the season ends:{' '}
              <b style={{ color: '#7ef0a6' }}>$20 / $5 / $3</b> for the podium, and{' '}
              <b style={{ color: '#7ef0a6' }}>$1</b> each for ranks {ONCHAIN_RANKS + 1}–{PAID_RANKS}.
            </p>
            <p className="mt-2 text-[9px] leading-relaxed text-null-muted">
              The top {ONCHAIN_RANKS} claim theirs in <b>Rewards</b> (a Season Pass for that month is
              required). Ranks {ONCHAIN_RANKS + 1}–{PAID_RANKS} are sent straight to your wallet — there
              is nothing to claim, because the reward contract only holds three places.
            </p>
            <p className="mt-2 text-[9px] leading-relaxed text-null-muted">
              Ranking is frozen the moment the season closes. XP keeps counting after that, so the
              board you see now and the board that pays are only the same thing until then.
            </p>
          </div>
        )}

        {/* ── LAST SEASON ──────────────────────────────────────────────────
            Owner: "tampilkan juga di leaderboard musim lalu." The frozen
            snapshot already existed and was only ever visible on /stats, which
            is an operator page — so the people who actually competed for the
            prize could not see who won it or whether it had been paid. */}
        {season?.snapshot && season.snapshot.winners?.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-[3px] text-null-blue">
                Last season · {seasonLabel(season.snapshot.seasonId ?? season.lastClosedSeasonId)}
              </h3>
              <span
                className="shrink-0 font-mono text-[9px] uppercase tracking-[1px]"
                style={{ color: season.snapshot.paidAt ? '#7ef0a6' : '#f2cd82' }}
              >
                {season.snapshot.paidAt ? '✓ Paid' : '● Payout pending'}
              </span>
            </div>
            <div className="font-mono">
              {season.snapshot.winners.map((w) => {
                const own = isOwnRow(w.wallet)
                return (
                  <div
                    key={w.rank}
                    className={`grid items-center border-b py-2 px-1 sm:px-2 text-[11px] sm:text-xs ${
                      own ? 'border-[rgba(0,255,136,0.5)] bg-[rgba(0,255,136,0.1)]' : 'border-[rgba(0,170,255,0.12)]'
                    }`}
                    style={{ gridTemplateColumns: GRID }}
                  >
                    <span className={`font-bold ${rankColor(w.rank)} flex items-center gap-0.5`}>
                      {rankMedal(w.rank) ?? `#${w.rank}`}
                    </span>
                    <span className="truncate pr-1 font-bold text-null-acid">
                      {w.username || `${w.wallet.slice(0, 6)}…${w.wallet.slice(-4)}`}
                    </span>
                    <span className="text-right text-null-blue">{w.xp.toLocaleString()}</span>
                    <span className="text-right text-null-muted">–</span>
                    <span className="text-right font-bold" style={{ color: '#7ef0a6' }}>${w.rewardUsd}</span>
                  </div>
                )
              })}
            </div>
            <p className="mt-2 font-mono text-[9px] leading-relaxed text-null-muted">
              Frozen when the season closed — these are the standings that were paid, not today&apos;s.
            </p>
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
