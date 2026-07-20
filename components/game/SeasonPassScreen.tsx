'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePassSBT, SeasonInfo } from '@/hooks/usePassSBT'
import { getUserFriendlyError } from '@/lib/errorUtils'
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

  // TASK #7 — daily pass perks (energy bonus run + Glitch-Shard stipend).
  // State mirrors GET /api/passsbt/perks; claims POST /api/passsbt/perks/claim.
  interface PerksState {
    hasPass: boolean
    nextResetAt: number
    energy: { amount: number; claimedToday: boolean }
    shards: { amount: { t1: number; t2: number; t3: number }; claimedToday: boolean }
  }
  const [perks, setPerks] = useState<PerksState | null>(null)
  const [perkBusy, setPerkBusy] = useState<'energy' | 'shards' | null>(null)
  const [perkMsg, setPerkMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  const loadPerks = useCallback(async () => {
    if (!address) { setPerks(null); return }
    try {
      const r = await fetch(`/api/passsbt/perks?wallet=${address}`)
      const d = await r.json()
      if (r.ok) setPerks(d as PerksState)
    } catch {
      /* offline — perks panel stays hidden/last-known */
    }
  }, [address])

  const claimPerk = useCallback(
    async (kind: 'energy' | 'shards') => {
      if (!address || perkBusy) return
      setPerkBusy(kind)
      setPerkMsg(null)
      try {
        const r = await fetch('/api/passsbt/perks/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet: address, kind }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d?.error || 'Claim failed')
        if (d?.alreadyClaimed) {
          setPerkMsg({ text: 'Already claimed today — come back after reset.', kind: 'err' })
        } else {
          setPerkMsg({
            text: kind === 'energy' ? '+1 bonus energy run claimed!' : 'Glitch Shards claimed!',
            kind: 'ok',
          })
        }
        await loadPerks()
      } catch (e) {
        setPerkMsg({ text: e instanceof Error ? e.message : 'Claim failed', kind: 'err' })
      } finally {
        setPerkBusy(null)
      }
    },
    [address, perkBusy, loadPerks],
  )

  useEffect(() => {
    loadPerks()
    // Refresh perks when the pass is freshly minted (hasPass flips true).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, passSBT.hasPass])

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
        await passSBT.mintPaidPassFlexible(seasonId)
        setMintSuccess('Pass minted successfully!')
        // Refresh this season's minted count after a successful mint.
        const refreshed = await passSBT.getSeasonInfo(seasonId)
        setSeasonInfos((prev) => ({ ...prev, [seasonId.toString()]: refreshed }))
      } catch (err) {
        // usePassSBT already routes this through the shared friendly-error
        // translator and stores it on passSBT.error / passSBT.insufficientFunds
        // (see hooks/usePassSBT.ts) — fall back to getUserFriendlyError only
        // if for some reason passSBT.error wasn't set.
        setMintError(passSBT.error ?? getUserFriendlyError(err).message)
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
            <div>{mintError}</div>
            {passSBT.insufficientFunds && passSBT.addCashUrl && (
              <a
                href={passSBT.addCashUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-null-amber underline underline-offset-2"
              >
                Add cash in MiniPay →
              </a>
            )}
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
                priceUsd={passSBT.passPriceUsd}
                onMint={() => handleMintSeason(seasonId)}
              />
            )
          })}
        </div>

        {/* ── TASK #7 — Pass Perks panel ──────────────────────────────────
            Shows what the pass unlocks (so non-holders see the value) with the
            FREE path stated alongside, plus once-per-day claim buttons for the
            two economy perks (holders only). All perks are cosmetic or modest
            convenience — the HP-100 cap and combat balance are untouched. */}
        <div className="mt-8 border border-[rgba(0,255,136,0.25)] bg-[rgba(0,255,136,0.03)] rounded-md p-4 sm:p-5">
          <div className="font-mono text-[9px] sm:text-[10px] tracking-[3px] uppercase text-null-acid mb-3">
            // PASS PERKS
          </div>

          <ul className="font-mono text-xs text-null-white/85 space-y-2 mb-4">
            <li>◆ <span className="text-null-green">NullState Warden skin</span> — exclusive acid-green cosmetic (no stats). Equip it in the in-game Gear tab.</li>
            <li>◆ <span className="text-null-green">Holder emblem</span> — a ◆ PASS badge on your profile and in-game HUD.</li>
            <li>◆ <span className="text-null-green">+{perks?.energy.amount ?? 1} energy run / day</span> — on top of the free 5/day everyone gets.</li>
            <li>◆ <span className="text-null-green">Daily Glitch Shards</span> — a small crafting stipend (shards are also earned free by playing).</li>
          </ul>

          <p className="font-mono text-[10px] text-null-muted mb-4">
            Free to play: everyone keeps 5 energy runs a day and earns shards in-run — the pass only adds a little on top, never a power advantage (HP stays capped at 100).
          </p>

          {perkMsg && (
            <div
              className={
                'mb-3 rounded border p-2 text-[11px] font-mono ' +
                (perkMsg.kind === 'ok'
                  ? 'border-[rgba(0,255,136,0.35)] bg-[rgba(0,255,136,0.08)] text-null-green'
                  : 'border-[rgba(255,190,11,0.35)] bg-[rgba(255,190,11,0.08)] text-null-amber')
              }
            >
              {perkMsg.text}
            </div>
          )}

          {!address ? (
            <div className="font-mono text-[11px] text-null-muted">Connect to claim daily perks.</div>
          ) : !perks?.hasPass ? (
            <div className="font-mono text-[11px] text-null-muted">Mint the active-season pass to unlock daily claims.</div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => claimPerk('energy')}
                disabled={perkBusy !== null || perks.energy.claimedToday}
                className={
                  'flex-1 font-mono text-[10px] tracking-[1px] uppercase py-2.5 transition-all duration-200 ' +
                  (perkBusy !== null || perks.energy.claimedToday
                    ? 'text-null-muted border border-[rgba(42,74,53,0.6)] cursor-not-allowed'
                    : 'text-null-green border border-[rgba(0,255,136,0.5)] hover:border-null-green hover:bg-[rgba(0,255,136,0.08)]')
                }
                style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}
              >
                {perkBusy === 'energy'
                  ? 'CLAIMING…'
                  : perks.energy.claimedToday
                    ? '✓ ENERGY CLAIMED'
                    : `CLAIM +${perks.energy.amount} ENERGY RUN`}
              </button>
              <button
                onClick={() => claimPerk('shards')}
                disabled={perkBusy !== null || perks.shards.claimedToday}
                className={
                  'flex-1 font-mono text-[10px] tracking-[1px] uppercase py-2.5 transition-all duration-200 ' +
                  (perkBusy !== null || perks.shards.claimedToday
                    ? 'text-null-muted border border-[rgba(42,74,53,0.6)] cursor-not-allowed'
                    : 'text-null-green border border-[rgba(0,255,136,0.5)] hover:border-null-green hover:bg-[rgba(0,255,136,0.08)]')
                }
                style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}
              >
                {perkBusy === 'shards'
                  ? 'CLAIMING…'
                  : perks.shards.claimedToday
                    ? '✓ SHARDS CLAIMED'
                    : `CLAIM ${perks.shards.amount.t1} GLITCH SHARDS`}
              </button>
            </div>
          )}
          {perks?.hasPass && (perks.energy.claimedToday || perks.shards.claimedToday) && (
            <div className="mt-2 font-mono text-[9px] text-null-muted">
              Daily perks reset at 00:00 UTC.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
