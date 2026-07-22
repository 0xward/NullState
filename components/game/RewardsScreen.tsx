'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
    nullstateTokenBalance?: number
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

interface StablecoinEntry {
  kind: 'vault' | 'season' | 'weekly'
  weekId?: number
  seasonId?: number
  amount?: number
  token?: string
  txHash?: string | null
  at: number
}

interface RewardsScreenProps {
  onBack: () => void
  address?: string
  playerProfile: PlayerProfile | null
}

type Tab = 'stablecoin' | 'points'

// Contract defaults for the seasonal top-3 leaderboard bonus
// (NullStateRewardV2 rank1/2/3Reward — owner-settable via setRankRewards,
// so this is an indicative amount; the exact payout is enforced on-chain).
const RANK_BONUS_USDM = [20, 5, 3]

const CELOSCAN_TX = 'https://celoscan.io/tx/'

export default function RewardsScreen({ onBack, address, playerProfile }: RewardsScreenProps) {
  const [tab, setTab] = useState<Tab>('stablecoin')

  const [data, setData] = useState<ProfileResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stash, setStash] = useState<StashItem[]>([])

  // Stablecoin (left tab) — received history + live claimable
  const [scHistory, setScHistory] = useState<StablecoinEntry[]>([])
  const [scLoading, setScLoading] = useState(false)
  const {
    seasonLeaderboard,
    hasClaimedSeasonBonus,
    weeklyClaimable,
    currentSeason,
    isLoading: rewardBusy,
    claimSeasonBonus,
    claimWeeklyRewards,
  } = useReward(address)

  // Burn (right tab) — multi-select
  const [sel, setSel] = useState<Record<string, number>>({})
  const [burning, setBurning] = useState(false)
  const [burnMsg, setBurnMsg] = useState<string | null>(null)

  // Claim feedback (left tab)
  const [claimBusy, setClaimBusy] = useState<'season' | 'weekly' | null>(null)
  const [claimMsg, setClaimMsg] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    if (!address) {
      setData(null)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/player/profile?walletAddress=${address}`)
      // The API always responds with JSON, but a bad deploy / proxy error
      // page / auth redirect can return HTML — read as text first so a
      // non-JSON response surfaces a real message, not "Unexpected token '<'".
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
  }, [address])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  // Stablecoin received-history (Firebase-only ledger — see
  // app/api/rewards/stablecoin/route.ts).
  useEffect(() => {
    if (!address) {
      setScHistory([])
      return
    }
    let cancelled = false
    const load = async () => {
      setScLoading(true)
      try {
        const res = await fetch(`/api/rewards/stablecoin?walletAddress=${address}`)
        const payload = await res.json()
        if (!cancelled && res.ok) setScHistory(Array.isArray(payload.history) ? payload.history : [])
      } catch {
        if (!cancelled) setScHistory([])
      } finally {
        if (!cancelled) setScLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [address])

  // The unburned stash only lives in the live dungeon canvas (game.js
  // G.inventory), which isn't running on this screen — read the last
  // snapshot game.js mirrored to localStorage instead.
  useEffect(() => {
    if (!address || typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('nullstate-stash-' + address.toLowerCase())
      const parsed = raw ? JSON.parse(raw) : null
      setStash(Array.isArray(parsed?.items) ? parsed.items : [])
    } catch {
      setStash([])
    }
  }, [address])

  const unburnedTotal = useMemo(
    () => stash.reduce((sum, it) => sum + it.burnValue * it.qty, 0),
    [stash]
  )

  const burns = data?.burns ?? []
  const tokenBalance = data?.summary?.nullstateTokenBalance ?? 0

  // --- Stablecoin claimable (live, on-chain) ---
  const myRank = useMemo(() => {
    if (!seasonLeaderboard || !address) return -1
    return seasonLeaderboard.topPlayers.findIndex(
      (a) => a?.toLowerCase() === address.toLowerCase()
    )
  }, [seasonLeaderboard, address])

  const seasonClaimable =
    myRank >= 0 && !!seasonLeaderboard?.finalized && !hasClaimedSeasonBonus
  const weeklyHasClaim = (weeklyClaimable ?? BigInt(0)) > BigInt(0)
  const hasClaimable = seasonClaimable || weeklyHasClaim

  const onClaimSeason = async () => {
    if (!seasonClaimable || claimBusy) return
    setClaimBusy('season')
    setClaimMsg(null)
    try {
      const { hash } = await claimSeasonBonus(currentSeason)
      setClaimMsg(`Season bonus claimed ✓ (${hash.slice(0, 10)}…)`)
    } catch (e) {
      setClaimMsg(e instanceof Error ? e.message : 'Claim failed')
    } finally {
      setClaimBusy(null)
    }
  }

  const onClaimWeekly = async () => {
    if (!weeklyHasClaim || claimBusy) return
    setClaimBusy('weekly')
    setClaimMsg(null)
    try {
      const { hash } = await claimWeeklyRewards()
      setClaimMsg(`Weekly reward claimed ✓ (${hash.slice(0, 10)}…)`)
    } catch (e) {
      setClaimMsg(e instanceof Error ? e.message : 'Claim failed')
    } finally {
      setClaimBusy(null)
    }
  }

  // --- Points burn (multi-select) ---
  const selectedEntries = stash.filter((it) => (sel[it.id] || 0) > 0)
  const selectedCount = selectedEntries.reduce((s, it) => s + (sel[it.id] || 0), 0)
  const selectedValue = selectedEntries.reduce((s, it) => s + it.burnValue * (sel[it.id] || 0), 0)

  const setQty = (id: string, qty: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, qty))
    setSel((prev) => {
      const next = { ...prev }
      if (clamped <= 0) delete next[id]
      else next[id] = clamped
      return next
    })
  }

  // Persist an out-of-game burn so the engine reconciles it on next run
  // (nullstate-extburn-<wallet>) and keep the stash mirror consistent.
  const recordExternalBurn = (addr: string, burned: Record<string, number>) => {
    if (typeof window === 'undefined') return
    const lower = addr.toLowerCase()
    try {
      const k = 'nullstate-extburn-' + lower
      let q: Record<string, number> = {}
      const raw = localStorage.getItem(k)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') q = parsed
      }
      for (const [id, qty] of Object.entries(burned)) q[id] = (q[id] || 0) + qty
      localStorage.setItem(k, JSON.stringify(q))
    } catch {
      /* storage full/unavailable — engine simply won't reconcile; non-fatal */
    }
    try {
      const k = 'nullstate-stash-' + lower
      const raw = localStorage.getItem(k)
      if (raw) {
        const snap = JSON.parse(raw)
        if (snap && Array.isArray(snap.items)) {
          snap.items = snap.items
            .map((it: any) => (burned[it.id] ? { ...it, qty: it.qty - burned[it.id] } : it))
            .filter((it: any) => it.qty > 0)
          snap.updatedAt = Date.now()
          localStorage.setItem(k, JSON.stringify(snap))
        }
      }
    } catch {
      /* ignore */
    }
  }

  const doBurn = async () => {
    if (!address || selectedEntries.length === 0 || burning) return
    setBurning(true)
    setBurnMsg(null)
    try {
      const items = selectedEntries.map((it) => ({
        id: it.id,
        name: it.name,
        rarity: it.rarity,
        qty: sel[it.id],
        burnValue: it.burnValue,
        icon: it.icon,
        color: it.color,
      }))
      const res = await fetch('/api/burn/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, items, totalValue: selectedValue, timestamp: Date.now() }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Burn failed')

      const burnedMap: Record<string, number> = {}
      for (const it of selectedEntries) burnedMap[it.id] = sel[it.id]
      recordExternalBurn(address, burnedMap)

      // Reflect locally without a full reload
      setStash((prev) =>
        prev
          .map((it) => (burnedMap[it.id] ? { ...it, qty: it.qty - burnedMap[it.id] } : it))
          .filter((it) => it.qty > 0)
      )
      setData((prev) =>
        prev
          ? {
              ...prev,
              summary: {
                totalBurnEvents: (prev.summary?.totalBurnEvents ?? 0) + 1,
                totalBurnedValue: (prev.summary?.totalBurnedValue ?? 0) + (payload.totalValue ?? selectedValue),
                nullstateTokenBalance: payload.newBalance ?? tokenBalance + selectedValue,
              },
            }
          : prev
      )
      setSel({})
      setBurnMsg(`Burned ${selectedCount} item(s) → +${Math.round(payload.totalValue ?? selectedValue)} NullState Point`)
      // Refresh burn history so the new event shows up
      loadProfile()
    } catch (e) {
      setBurnMsg(e instanceof Error ? e.message : 'Burn failed')
    } finally {
      setBurning(false)
    }
  }

  const tabBtn = (id: Tab, label: string, sub: string) => (
    <button
      onClick={() => setTab(id)}
      className={`flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 border font-mono uppercase transition-all duration-200 ${
        tab === id
          ? 'border-null-amber bg-[rgba(255,190,11,0.08)] text-null-amber'
          : 'border-[rgba(255,255,255,0.12)] text-null-muted hover:border-[rgba(255,190,11,0.4)]'
      }`}
      style={{ clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)' }}
    >
      <span className="text-xs sm:text-sm tracking-[2px] font-bold">{label}</span>
      <span className="text-[8px] sm:text-[9px] tracking-[1px] opacity-70">{sub}</span>
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[rgba(0,0,0,0.95)] p-4 sm:p-6 overflow-y-auto">
      <div
        className="absolute pointer-events-none inset-0"
        style={{ background: 'radial-gradient(circle at 50% 30%, rgba(255,190,11,0.08) 0%, transparent 60%)' }}
      />

      <div className="relative z-10 max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[9px] sm:text-[10px] tracking-[4px] sm:tracking-[6px] text-null-amber uppercase mb-1 sm:mb-2">
              // REWARDS
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
            className="shrink-0 inline-flex items-center justify-center min-h-11 font-mono text-[10px] sm:text-xs tracking-[1px] sm:tracking-[2px] uppercase text-null-green border border-[rgba(0,255,136,0.4)] px-3 sm:px-4 py-2 transition-all duration-200 hover:border-null-green hover:bg-[rgba(0,255,136,0.05)]"
            style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Wallet line */}
        <div className="mb-4 font-mono text-[10px] sm:text-xs">
          <span className="text-null-muted uppercase tracking-[1px]">Wallet </span>
          <span className="text-null-white break-all">{address || 'NOT CONNECTED'}</span>
        </div>

        {/* Two-reward tab switch */}
        <div className="flex gap-2 sm:gap-3 mb-6">
          {tabBtn('stablecoin', 'Stablecoin', 'USDm rewards')}
          {tabBtn('points', 'Reward Point', 'from burning')}
        </div>

        {/* ================= STABLECOIN TAB ================= */}
        {tab === 'stablecoin' && (
          <div>
            {/* Claimable now */}
            <div className="font-mono text-[10px] tracking-[2px] text-null-green uppercase mb-2">
              // Claimable now
            </div>
            {claimMsg && (
              <div className="mb-3 rounded border border-[rgba(0,255,136,0.35)] bg-[rgba(0,255,136,0.06)] p-2.5 text-xs text-null-green font-mono break-words">
                {claimMsg}
              </div>
            )}
            {!hasClaimable ? (
              <p className="text-null-muted font-mono text-sm py-5 text-center border border-[rgba(255,255,255,0.08)] rounded-md mb-8">
                No rewards
              </p>
            ) : (
              <div className="space-y-2 mb-8">
                {seasonClaimable && (
                  <div className="flex items-center justify-between gap-3 border border-[rgba(255,190,11,0.3)] bg-[rgba(255,190,11,0.04)] rounded-md p-3">
                    <div className="font-mono text-xs">
                      <div className="text-null-amber font-bold">Season #{String(currentSeason)} — Rank #{myRank + 1} bonus</div>
                      <div className="text-null-muted text-[10px] mt-0.5">≈ {RANK_BONUS_USDM[myRank] ?? '?'} USDm · top-3 leaderboard</div>
                    </div>
                    <button
                      onClick={onClaimSeason}
                      disabled={claimBusy !== null || rewardBusy}
                      className="shrink-0 min-h-10 px-4 font-mono text-[10px] tracking-[1px] uppercase text-null-green border border-[rgba(0,255,136,0.5)] disabled:opacity-40 hover:bg-[rgba(0,255,136,0.08)]"
                      style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}
                    >
                      {claimBusy === 'season' ? '…' : 'Claim'}
                    </button>
                  </div>
                )}
                {weeklyHasClaim && (
                  <div className="flex items-center justify-between gap-3 border border-[rgba(255,190,11,0.3)] bg-[rgba(255,190,11,0.04)] rounded-md p-3">
                    <div className="font-mono text-xs">
                      <div className="text-null-amber font-bold">Weekly burn reward</div>
                      <div className="text-null-muted text-[10px] mt-0.5">On-chain USDm pool</div>
                    </div>
                    <button
                      onClick={onClaimWeekly}
                      disabled={claimBusy !== null || rewardBusy}
                      className="shrink-0 min-h-10 px-4 font-mono text-[10px] tracking-[1px] uppercase text-null-green border border-[rgba(0,255,136,0.5)] disabled:opacity-40 hover:bg-[rgba(0,255,136,0.08)]"
                      style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}
                    >
                      {claimBusy === 'weekly' ? '…' : 'Claim'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Received history */}
            <div className="font-mono text-[10px] tracking-[2px] text-null-amber uppercase mb-2">
              // Received ({scHistory.length})
            </div>
            {scLoading ? (
              <div className="text-null-amber font-mono text-sm py-6 text-center animate-pulse">// loading…</div>
            ) : scHistory.length === 0 ? (
              <p className="text-null-muted font-mono text-sm py-5 text-center border border-[rgba(255,255,255,0.08)] rounded-md">
                No rewards
              </p>
            ) : (
              <div className="space-y-2">
                {scHistory.map((e, i) => (
                  <div key={i} className="border border-[rgba(0,255,136,0.15)] rounded-md p-3 font-mono text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-null-white/90 font-bold">
                        {e.kind === 'vault'
                          ? `🔓 Treasure Vault${e.weekId ? ` · wk ${e.weekId}` : ''}`
                          : e.kind === 'season'
                            ? `🏆 Season bonus${e.seasonId ? ` · S${e.seasonId}` : ''}`
                            : `⛏ Weekly reward${e.weekId ? ` · wk ${e.weekId}` : ''}`}
                      </span>
                      {typeof e.amount === 'number' && (
                        <span className="text-null-green font-bold">
                          +{e.amount} {e.token ?? 'USDm'}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-null-muted">{e.at ? new Date(e.at).toLocaleString() : ''}</span>
                      {e.txHash && (
                        <a
                          href={CELOSCAN_TX + e.txHash}
                          target="_blank"
                          rel="noreferrer"
                          className="text-null-blue hover:underline"
                        >
                          tx ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-6 text-center font-mono text-[9px] text-null-muted leading-relaxed">
              Stablecoin comes from the Treasure Vault (weekly code) and the seasonal top-3 leaderboard
              bonus. Vault rewards are paid instantly on a correct code; season bonuses are claimed here.
            </p>
          </div>
        )}

        {/* ================= REWARD POINT TAB ================= */}
        {tab === 'points' && (
          <div>
            {/* Totals */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="border border-[rgba(0,255,136,0.25)] bg-[rgba(0,255,136,0.04)] rounded-md p-4 text-center">
                <div className="font-mono text-[10px] uppercase tracking-[1px] text-null-muted mb-1">NullState Point</div>
                <div className="font-display font-black text-null-green text-2xl">{Math.round(tokenBalance)}</div>
              </div>
              <div className="border border-[rgba(255,190,11,0.25)] bg-[rgba(255,190,11,0.04)] rounded-md p-4 text-center">
                <div className="font-mono text-[10px] uppercase tracking-[1px] text-null-muted mb-1">Unburned Stash</div>
                <div className="font-display font-black text-null-amber text-2xl">{Math.round(unburnedTotal)}</div>
              </div>
            </div>
            <p className="-mt-3 mb-6 text-center font-mono text-[9px] text-null-muted">
              Spend NullState Point on Marketplace gear ($0.5–$2 items) via the Swap button.
            </p>

            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="text-null-amber font-mono text-sm animate-pulse">// fetching…</div>
              </div>
            )}
            {error && (
              <div className="mb-6 rounded border border-[rgba(255,190,11,0.35)] bg-[rgba(255,190,11,0.08)] p-3 text-sm text-null-amber font-mono">
                {error}
              </div>
            )}

            {/* Burnable stash — multi-select */}
            {!isLoading && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-mono text-[10px] tracking-[2px] text-null-amber uppercase">
                    // Burn for Points ({stash.length})
                  </div>
                  {stash.length > 0 && (
                    <button
                      onClick={() =>
                        setSel((prev) => {
                          const allSelected = stash.every((it) => (prev[it.id] || 0) >= it.qty)
                          if (allSelected) return {}
                          const next: Record<string, number> = {}
                          for (const it of stash) next[it.id] = it.qty
                          return next
                        })
                      }
                      className="font-mono text-[9px] tracking-[1px] uppercase text-null-blue border border-[rgba(74,215,255,0.35)] px-2 py-1 hover:bg-[rgba(74,215,255,0.06)]"
                    >
                      {stash.every((it) => (sel[it.id] || 0) >= it.qty) && stash.length > 0 ? 'Clear' : 'Select all'}
                    </button>
                  )}
                </div>

                {burnMsg && (
                  <div className="mb-3 rounded border border-[rgba(0,255,136,0.35)] bg-[rgba(0,255,136,0.06)] p-2.5 text-xs text-null-green font-mono break-words">
                    {burnMsg}
                  </div>
                )}

                {stash.length === 0 ? (
                  <p className="text-null-muted font-mono text-sm py-6 text-center border border-[rgba(255,255,255,0.08)] rounded-md">
                    Nothing to burn — loot items in a run first, then open your in-game inventory once so it syncs here.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {stash.map((it) => {
                        const q = sel[it.id] || 0
                        const active = q > 0
                        return (
                          <div
                            key={it.id}
                            className="flex items-center gap-3 border rounded p-2 font-mono"
                            style={{ borderColor: active ? it.color || '#ffbe0b' : 'rgba(255,255,255,0.1)' }}
                          >
                            {it.icon ? (
                              <img
                                src={it.icon}
                                alt={it.name}
                                draggable={false}
                                className="w-8 h-8 shrink-0"
                                style={{ imageRendering: 'pixelated' }}
                              />
                            ) : (
                              <div className="w-8 h-8 shrink-0 rounded bg-white/5" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] uppercase truncate" style={{ color: it.color }}>
                                {it.name}
                              </div>
                              <div className="text-null-amber text-[9px]">
                                {Math.round(it.burnValue)} pt · have ×{it.qty}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => setQty(it.id, q - 1, it.qty)}
                                className="w-7 h-7 border border-[rgba(255,255,255,0.15)] text-null-white/70 disabled:opacity-30"
                                disabled={q <= 0}
                              >
                                −
                              </button>
                              <span className="w-6 text-center text-null-white text-xs">{q}</span>
                              <button
                                onClick={() => setQty(it.id, q + 1, it.qty)}
                                className="w-7 h-7 border border-[rgba(255,255,255,0.15)] text-null-white/70 disabled:opacity-30"
                                disabled={q >= it.qty}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Burn action bar */}
                    <div className="sticky bottom-0 mt-3 flex items-center justify-between gap-3 bg-[rgba(0,0,0,0.9)] border border-[rgba(255,190,11,0.3)] rounded-md p-3">
                      <div className="font-mono text-xs">
                        <span className="text-null-white">{selectedCount}</span>
                        <span className="text-null-muted"> selected → </span>
                        <span className="text-null-green font-bold">+{Math.round(selectedValue)} pt</span>
                      </div>
                      <button
                        onClick={doBurn}
                        disabled={selectedCount === 0 || burning || !address}
                        className="min-h-10 px-5 font-mono text-[11px] tracking-[2px] uppercase font-bold text-null-amber border border-null-amber disabled:opacity-40 hover:bg-[rgba(255,190,11,0.1)]"
                        style={{ clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)' }}
                      >
                        {burning ? 'Burning…' : '🔥 Burn'}
                      </button>
                    </div>
                  </>
                )}
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
                    No burns recorded yet this season.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {burns.map((b) => (
                      <div key={b.burnId} className="border border-[rgba(0,255,136,0.15)] rounded-md p-3 font-mono text-xs">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-null-muted">{new Date(b.recordedAt || b.timestamp).toLocaleString()}</span>
                          <span className="text-null-green font-bold">+{Math.round(b.totalValue)} pt</span>
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
