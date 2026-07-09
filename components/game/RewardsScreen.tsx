'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { PlayerProfile } from '@/lib/contract'
import { usePassSBT, SeasonInfo } from '@/hooks/usePassSBT'
import SeasonPassCard from './SeasonPassCard'

// 6 seasons, one per month, July-December 2026. Season id format is
// YYYYMM per PassSBT.sol (e.g. 202607 = July 2026).
const SEASON_IDS: bigint[] = [
  BigInt(202607),
  BigInt(202608),
  BigInt(202609),
  BigInt(202610),
  BigInt(202611),
  BigInt(202612),
]

function currentSeasonId(): bigint {
  const now = new Date()
  const ymNow = BigInt(now.getUTCFullYear() * 100 + (now.getUTCMonth() + 1))
  // Clamp to the pass program's actual range so testing outside Jul-Dec
  // 2026 doesn't leave zero cards marked active.
  if (ymNow < SEASON_IDS[0]) return SEASON_IDS[0]
  if (ymNow > SEASON_IDS[SEASON_IDS.length - 1]) return SEASON_IDS[SEASON_IDS.length - 1]
  return ymNow
}

interface BurnItem {
  id: string
  name: string
  rarity?: string
  qty: number
  burnValue: number
}

interface BurnRecord {
  burnId: string
  wallet: string
  items: BurnItem[]
  itemCount: number
  totalValue: number
  txHash: string | null
  timestamp: number
  recordedAt: number
}

interface ProfileResponse {
  profile: {
    walletAddress: string
    nickname?: string
  }
  summary?: {
    totalBurnEvents: number
    totalBurnedValue: number
  }
  burns?: BurnRecord[]
}

interface StashItem {
  id: string
  name: string
  rarity?: string
  color?: string
  icon?: string
  qty: number
  burnValue: number
}

interface RewardsScreenProps {
  onBack: () => void
  address?: string
  playerProfile: PlayerProfile | null
}

export default function RewardsScreen({ onBack, address, playerProfile }: RewardsScreenProps) {
  const [data, setData] = useState<ProfileResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stash, setStash] = useState<StashItem[]>([])

  useEffect(() => {
    if (!address) {
      setData(null)
      return
    }
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/player/profile?walletAddress=${address}`)
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error ?? 'Failed to load rewards')
        setData(payload)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load rewards')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [address])

  // The unburned stash only ever lives client-side inside the live dungeon
  // canvas (game.js's G.inventory), which isn't running on this screen — so
  // we read the last snapshot game.js mirrored to localStorage instead. It
  // won't exist until the player has opened their in-game inventory at
  // least once this browser.
  useEffect(() => {
    if (!address || typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('nullstate-stash-' + address.toLowerCase())
      if (raw) {
        const parsed = JSON.parse(raw)
        setStash(Array.isArray(parsed?.items) ? parsed.items : [])
      } else {
        setStash([])
      }
    } catch {
      setStash([])
    }
  }, [address])

  const unburnedTotal = useMemo(
    () => stash.reduce((sum, it) => sum + it.burnValue * it.qty, 0),
    [stash]
  )

  // ── Season Pass ────────────────────────────────────────────────────────────
  const passSBT = usePassSBT(address)
  const activeSeasonId = useMemo(() => currentSeasonId(), [])
  const [seasonInfos, setSeasonInfos] = useState<Record<string, SeasonInfo | null>>({})
  const [mintError, setMintError] = useState<string | null>(null)
  const [mintingSeasonId, setMintingSeasonId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadAll = async () => {
      const results = await Promise.all(SEASON_IDS.map((id) => passSBT.getSeasonInfo(id)))
      if (cancelled) return
      const next: Record<string, SeasonInfo | null> = {}
      SEASON_IDS.forEach((id, i) => {
        next[id.toString()] = results[i]
      })
      setSeasonInfos(next)
    }
    loadAll()
    return () => {
      cancelled = true
    }
    // Only re-run when the pass status itself changes (e.g. right after a
    // mint), not on every getSeasonInfo identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, passSBT.hasPass])

  const handleMintSeason = useCallback(
    async (seasonId: bigint) => {
      if (!address) return
      setMintError(null)
      setMintingSeasonId(seasonId.toString())
      try {
        await passSBT.mintPaidPassWithApproval(seasonId)
        // Refresh this season's minted count after a successful mint.
        const refreshed = await passSBT.getSeasonInfo(seasonId)
        setSeasonInfos((prev) => ({ ...prev, [seasonId.toString()]: refreshed }))
      } catch (err) {
        setMintError(err instanceof Error ? err.message : 'Gagal mint Season Pass')
      } finally {
        setMintingSeasonId(null)
      }
    },
    [address, passSBT]
  )

  const burns = data?.burns ?? []
  const totalBurnedValue = data?.summary?.totalBurnedValue ?? 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[rgba(0,0,0,0.95)] p-4 sm:p-6 overflow-y-auto">
      <div
        className="absolute pointer-events-none inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 30%, rgba(255,190,11,0.08) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[9px] sm:text-[10px] tracking-[4px] sm:tracking-[6px] text-null-amber uppercase mb-1 sm:mb-2">
              // MINING &amp; BURN HISTORY
            </div>
            <h2
              className="font-display font-black text-null-white leading-none"
              style={{ fontSize: 'clamp(28px, 8vw, 48px)' }}
            >
              REWARDS
            </h2>
          </div>

          <button
            onClick={onBack}
            className="shrink-0 font-mono text-[10px] sm:text-xs tracking-[1px] sm:tracking-[2px] uppercase text-null-green border border-[rgba(0,255,136,0.4)] px-2.5 sm:px-4 py-1.5 sm:py-2 transition-all duration-200 hover:border-null-green hover:bg-[rgba(0,255,136,0.05)]"
            style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Player identity card */}
        <div className="mb-6 border border-[rgba(255,190,11,0.25)] bg-[rgba(255,190,11,0.04)] rounded-md p-4 font-mono text-xs sm:text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-null-muted uppercase tracking-[1px] text-[10px]">Username</span>
              <div className="text-null-acid font-bold text-base">
                {playerProfile?.username || data?.profile?.nickname || 'Unnamed'}
              </div>
            </div>
            <div>
              <span className="text-null-muted uppercase tracking-[1px] text-[10px]">XP</span>
              <div className="text-null-blue font-bold text-base">{playerProfile?.xp ?? 0}</div>
            </div>
            <div>
              <span className="text-null-muted uppercase tracking-[1px] text-[10px]">Level</span>
              <div className="text-null-green font-bold text-base">{playerProfile?.level ?? '-'}</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[rgba(255,190,11,0.15)]">
            <span className="text-null-muted uppercase tracking-[1px] text-[10px]">Wallet</span>
            <div className="text-null-white break-all">{address || 'NOT CONNECTED'}</div>
          </div>
        </div>

        {/* Totals row */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="border border-[rgba(0,255,136,0.25)] bg-[rgba(0,255,136,0.04)] rounded-md p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[1px] text-null-muted mb-1">Burned → USDm</div>
            <div className="font-display font-black text-null-green text-2xl">{totalBurnedValue.toFixed(3)}</div>
          </div>
          <div className="border border-[rgba(255,190,11,0.25)] bg-[rgba(255,190,11,0.04)] rounded-md p-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[1px] text-null-muted mb-1">Unburned Stash</div>
            <div className="font-display font-black text-null-amber text-2xl">{unburnedTotal.toFixed(3)}</div>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-null-amber font-mono text-sm animate-pulse">// fetching burn history...</div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded border border-[rgba(255,190,11,0.35)] bg-[rgba(255,190,11,0.08)] p-3 text-sm text-null-amber font-mono">
            {error}
          </div>
        )}

        {/* Unburned stash list */}
        {!isLoading && stash.length > 0 && (
          <div className="mb-8">
            <div className="font-mono text-[10px] tracking-[2px] text-null-amber uppercase mb-2">
              // Not Yet Burned ({stash.length})
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {stash.map((it) => (
                <div
                  key={it.id}
                  className="border rounded p-2.5 font-mono text-xs"
                  style={{ borderColor: it.color || 'rgba(255,190,11,0.3)' }}
                >
                  <div className="text-null-white truncate" style={{ color: it.color }}>
                    {it.name} <span className="text-null-muted">×{it.qty}</span>
                  </div>
                  <div className="text-null-amber mt-1">{it.burnValue.toFixed(3)} USDm</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Burn history */}
        {!isLoading && (
          <div>
            <div className="font-mono text-[10px] tracking-[2px] text-null-green uppercase mb-2">
              // Burn History ({burns.length})
            </div>
            {burns.length === 0 ? (
              <p className="text-null-muted font-mono text-sm py-6 text-center">
                No burns recorded yet this season — burn items from your inventory in-game to send them
                to the weekly reward pool.
              </p>
            ) : (
              <div className="space-y-2">
                {burns.map((b) => (
                  <div
                    key={b.burnId}
                    className="border border-[rgba(0,255,136,0.15)] rounded-md p-3 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-null-muted">
                        {new Date(b.recordedAt || b.timestamp).toLocaleString()}
                      </span>
                      <span className="text-null-green font-bold">{b.totalValue.toFixed(3)} USDm</span>
                    </div>
                    <div className="text-null-white/80 flex flex-wrap gap-x-3 gap-y-1">
                      {b.items.map((it, i) => (
                        <span key={i}>
                          {it.name} ×{it.qty}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1.5 text-[10px]">
                      {b.txHash ? (
                        <span className="text-null-green">✓ on-chain</span>
                      ) : (
                        <span className="text-null-amber">⏳ pending on-chain credit</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Season Pass */}
        <div className="mt-10">
          <div className="font-mono text-[10px] tracking-[2px] text-null-acid uppercase mb-3">
            // Season Pass
          </div>

          {mintError && (
            <div className="mb-3 rounded border border-[rgba(255,34,68,0.35)] bg-[rgba(255,34,68,0.08)] p-3 text-xs text-null-red font-mono break-words">
              {mintError}
            </div>
          )}

          <div
            className="flex gap-3 overflow-x-auto pb-2"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {SEASON_IDS.map((seasonId, idx) => {
              const seasonNumber = idx + 1
              const isActive = seasonId === activeSeasonId
              const info = seasonInfos[seasonId.toString()] ?? null
              const phase = isActive && mintingSeasonId === seasonId.toString()
                ? passSBT.mintTxPhase
                : 'idle'

              return (
                <SeasonPassCard
                  key={seasonId.toString()}
                  seasonNumber={seasonNumber}
                  seasonId={seasonId}
                  imageSrc={`/Season_${seasonNumber}.png`}
                  isActive={isActive}
                  info={info}
                  hasPass={passSBT.hasPass}
                  isConnected={!!address}
                  mintPhase={phase}
                  onMint={() => handleMintSeason(seasonId)}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
