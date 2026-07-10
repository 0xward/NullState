'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { PlayerProfile } from '@/lib/contract'
import { useReward } from '@/hooks/useReward'

interface BurnItem {
  id: string
  name: string
  rarity?: string
  qty: number
  burnValue: number
  icon?: string
  color?: string
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
  onBack?: () => void
  address?: string
  walletAddress?: string
  playerProfile?: PlayerProfile | null
}

export default function RewardsScreen({
  onBack,
  address,
  walletAddress,
  playerProfile = null,
}: RewardsScreenProps) {
  const resolvedAddress = address ?? walletAddress
  const [data, setData] = useState<ProfileResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stash, setStash] = useState<StashItem[]>([])

  useEffect(() => {
    if (!resolvedAddress) {
      setData(null)
      return
    }
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/player/profile?walletAddress=${resolvedAddress}`)
        // The API always responds with JSON (see app/api/player/profile/
        // route.ts), but if the request never reaches it — a bad deploy, a
        // proxy/CDN error page, an expired session redirecting to HTML —
        // res.json() throws its own unhelpful "Unexpected token '<'..."
        // parse error instead of surfacing what actually went wrong. Read
        // the body as text first so a non-JSON response gets a real message.
        const raw = await res.text()
        let payload: any
        try {
          payload = JSON.parse(raw)
        } catch {
          throw new Error(
            res.ok
              ? 'Rewards service returned an unexpected response — try again shortly.'
              : `Rewards service error (HTTP ${res.status})`
          )
        }
        if (!res.ok) throw new Error(payload.error ?? 'Failed to load rewards')
        setData(payload)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load rewards')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [resolvedAddress])

  // The unburned stash only ever lives client-side inside the live dungeon
  // canvas (game.js's G.inventory), which isn't running on this screen — so
  // we read the last snapshot game.js mirrored to localStorage instead. It
  // won't exist until the player has opened their in-game inventory at
  // least once this browser.
  useEffect(() => {
    if (!resolvedAddress || typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('nullstate-stash-' + resolvedAddress.toLowerCase())
      if (raw) {
        const parsed = JSON.parse(raw)
        setStash(Array.isArray(parsed?.items) ? parsed.items : [])
      } else {
        setStash([])
      }
    } catch {
      setStash([])
    }
  }, [resolvedAddress])

  const unburnedTotal = useMemo(
    () => stash.reduce((sum, it) => sum + it.burnValue * it.qty, 0),
    [stash]
  )

  const burns = data?.burns ?? []
  const totalBurnedValue = data?.summary?.totalBurnedValue ?? 0

  // ── Weekly claim (on-chain) ───────────────────────────────────────────
  // "Burned → USDm" above is the lifetime total ever recorded via
  // recordBurn() — it is NOT the claimable amount. Claiming is scoped to
  // *this ISO week* only (userWeeklyBurnAmount - userWeeklyClaimed for the
  // current week, see NullStateReward.sol claimWeeklyRewards()), and
  // requires a separate on-chain tx signed by the player's own wallet.
  const {
    weeklyClaimable,
    isLoading: rewardLoading,
    error: rewardError,
    claimWeeklyRewards,
  } = useReward(resolvedAddress)
  const [claiming, setClaiming] = useState(false)
  const [claimStatus, setClaimStatus] = useState<string | null>(null)

  const canClaim = Boolean(resolvedAddress) && weeklyClaimable > BigInt(0)

  const handleClaim = async () => {
    setClaiming(true)
    setClaimStatus(null)
    try {
      const tx = await claimWeeklyRewards()
      setClaimStatus(`✓ Claimed · tx ${tx.hash.slice(0, 10)}…`)
    } catch (err) {
      // claimWeeklyRewards() reverts with "Week not initialized" if the
      // owner hasn't called depositWeeklyPool() for this ISO week yet —
      // surface that plainly instead of a raw revert string.
      const message = err instanceof Error ? err.message : 'Claim failed'
      setClaimStatus(
        message.includes('Week not initialized')
          ? 'Reward pool for this week isn\u2019t funded yet — try again later.'
          : message
      )
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className={`${onBack ? 'fixed inset-0 z-50 bg-[rgba(0,0,0,0.95)]' : 'rounded-xl border border-[rgba(0,255,136,0.2)] bg-[rgba(0,0,0,0.7)]'} flex flex-col p-4 sm:p-6 overflow-y-auto`}>
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

          {onBack ? (
            <button
              onClick={onBack}
              className="shrink-0 inline-flex items-center justify-center min-h-11 font-mono text-[10px] sm:text-xs tracking-[1px] sm:tracking-[2px] uppercase text-null-green border border-[rgba(0,255,136,0.4)] px-3 sm:px-4 py-2 transition-all duration-200 hover:border-null-green hover:bg-[rgba(0,255,136,0.05)]"
              style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}
            >
              ✕ CLOSE
            </button>
          ) : null}
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
            <div className="text-null-white break-all">{resolvedAddress || 'NOT CONNECTED'}</div>
          </div>
        </div>

        {/* Weekly claim — separate on-chain action from burning. Burning
            only records value into the ledger (see "✓ on-chain" tag below
            on each burn record); nothing moves into the wallet until this
            button's claimWeeklyRewards() tx is signed and confirmed. */}
        <div className="mb-8 border border-[rgba(0,255,136,0.3)] bg-[rgba(0,255,136,0.05)] rounded-md p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[1px] text-null-muted mb-1">
                Claimable This Week
              </div>
              <div className="font-display font-black text-null-green text-2xl">
                {resolvedAddress ? formatUnits(weeklyClaimable, 18) : '0.0'} USDm
              </div>
            </div>
            <button
              onClick={handleClaim}
              disabled={!canClaim || claiming || rewardLoading}
              className="shrink-0 font-mono text-xs tracking-[2px] uppercase px-5 py-2.5 rounded border border-null-green text-null-green transition-all duration-200 hover:bg-[rgba(0,255,136,0.1)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {claiming ? 'Claiming…' : 'Claim'}
            </button>
          </div>
          {claimStatus && (
            <div className="mt-2 text-[11px] font-mono text-null-muted">{claimStatus}</div>
          )}
          {!claimStatus && rewardError && (
            <div className="mt-2 text-[11px] font-mono text-null-amber">{rewardError}</div>
          )}
          {!resolvedAddress && (
            <div className="mt-2 text-[11px] font-mono text-null-muted">
              Connect your wallet to check claimable rewards.
            </div>
          )}
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

        {/* Unburned stash list — mirrors the in-game inventory grid
            (fixed 5 columns, real item icons) instead of a plain text list,
            so items read the same way here as they do in #invItems/
            #containerPlayerItems inside the live dungeon canvas. */}
        {!isLoading && stash.length > 0 && (
          <div className="mb-8">
            <div className="font-mono text-[10px] tracking-[2px] text-null-amber uppercase mb-2">
              // Not Yet Burned ({stash.length})
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {stash.map((it) => (
                <div
                  key={it.id}
                  className="relative flex flex-col items-center justify-center gap-1 border rounded p-2 pt-3 font-mono text-xs aspect-square"
                  style={{ borderColor: it.color || 'rgba(255,190,11,0.3)' }}
                >
                  <span
                    className="absolute top-1 right-1.5 text-[9px] font-bold rounded px-1"
                    style={{ background: it.color || '#ffbe0b', color: '#0a0a0a' }}
                  >
                    ×{it.qty}
                  </span>
                  {it.icon ? (
                    <img
                      src={it.icon}
                      alt={it.name}
                      draggable={false}
                      className="w-1/2 h-auto"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div className="w-1/2 aspect-square rounded bg-white/5" />
                  )}
                  <div
                    className="text-null-white text-center text-[9px] uppercase leading-tight truncate w-full"
                    style={{ color: it.color }}
                  >
                    {it.name}
                  </div>
                  <div className="text-null-amber text-[9px]">{it.burnValue.toFixed(3)} USDm</div>
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
                    <div className="text-null-white/80 flex flex-wrap gap-x-3 gap-y-1.5">
                      {b.items.map((it, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5">
                          {it.icon && (
                            <img
                              src={it.icon}
                              alt={it.name}
                              draggable={false}
                              className="w-4 h-4"
                              style={{ imageRendering: 'pixelated' }}
                            />
                          )}
                          <span style={{ color: it.color }}>{it.name}</span> ×{it.qty}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1.5 text-[10px]">
                      {b.txHash ? (
                        <span className="text-null-green">✓ recorded on-chain (eligible for weekly claim)</span>
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
      </div>
    </div>
  )
}
