'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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

interface SeasonPassScreenProps {
  onBack: () => void
  address?: string
}

export default function SeasonPassScreen({ onBack, address }: SeasonPassScreenProps) {
  const passSBT = usePassSBT(address)
  const activeSeasonId = useMemo(() => currentSeasonId(), [])
  const [seasonInfos, setSeasonInfos] = useState<Record<string, SeasonInfo | null>>({})
  const [mintError, setMintError] = useState<string | null>(null)
  const [mintSuccess, setMintSuccess] = useState<string | null>(null)
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
      setMintSuccess(null)
      setMintingSeasonId(seasonId.toString())
      try {
        await passSBT.mintPaidPassWithApproval(seasonId)
        setMintSuccess('Pass minted successfully!')
        // Refresh this season's minted count after a successful mint.
        const refreshed = await passSBT.getSeasonInfo(seasonId)
        setSeasonInfos((prev) => ({ ...prev, [seasonId.toString()]: refreshed }))
      } catch (err) {
        setMintError(err instanceof Error ? err.message : 'Failed to mint Season Pass')
      } finally {
        setMintingSeasonId(null)
      }
    },
    [address, passSBT]
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[rgba(0,0,0,0.95)] p-4 sm:p-6 overflow-y-auto">
      <div
        className="absolute pointer-events-none inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 30%, rgba(0,255,136,0.08) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[9px] sm:text-[10px] tracking-[4px] sm:tracking-[6px] text-null-acid uppercase mb-1 sm:mb-2">
              // SOULBOUND ACCESS TOKEN
            </div>
            <h2
              className="font-display font-black text-null-white leading-none"
              style={{ fontSize: 'clamp(28px, 8vw, 48px)' }}
            >
              SEASON PASS
            </h2>
          </div>

          <button
            onClick={onBack}
            className="shrink-0 inline-flex items-center justify-center min-h-11 font-mono text-[10px] sm:text-xs tracking-[1px] sm:tracking-[2px] uppercase text-null-green border border-[rgba(0,255,136,0.4)] px-3 sm:px-4 py-2 transition-all duration-200 hover:border-null-green hover:bg-[rgba(0,255,136,0.05)]"
            style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}
          >
            ✕ CLOSE
          </button>
        </div>

        <p className="text-null-muted font-mono text-xs sm:text-sm mb-6 max-w-lg">
          Mint your monthly pass to unlock season perks. Swipe to preview upcoming seasons — only
          the current month can be minted.
        </p>

        {!address && (
          <div className="mb-6 rounded border border-[rgba(255,190,11,0.35)] bg-[rgba(255,190,11,0.08)] p-3 text-sm text-null-amber font-mono">
            Connect your wallet to mint a pass.
          </div>
        )}

        {mintError && (
          <div className="mb-4 rounded border border-[rgba(255,34,68,0.35)] bg-[rgba(255,34,68,0.08)] p-3 text-xs text-null-red font-mono break-words">
            {mintError}
          </div>
        )}

        {mintSuccess && (
          <div className="mb-4 rounded border border-[rgba(0,255,136,0.35)] bg-[rgba(0,255,136,0.08)] p-3 text-xs text-null-green font-mono">
            {mintSuccess}
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
            const phase =
              isActive && mintingSeasonId === seasonId.toString() ? passSBT.mintTxPhase : 'idle'

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
  )
}
