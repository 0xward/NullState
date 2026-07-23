'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Public analytics/operational-visibility page required for MiniPay listing
// (celopedia-skill → minipay-requirements.md §8). No wallet needed — it reads
// aggregated numbers from /api/stats (Firebase-backed) and renders them.

interface StatsPayload {
  generatedAt: number
  players: { total: number; dau: number; wau: number; mau: number }
  onchain: {
    purchases: number
    purchasesByToken: { USDM: number; USDC: number; USDT: number }
    purchaseVolumeUsd: number
    passMints: number
    rewardsPaidCount: number
    rewardsPaidUsd: number
    transactionsTotal: number
    purchasesPerDay: number[]
  }
  economy: {
    burnEvents: number
    pointsBurned: number
    vaultCompletions: number
    goldenKeys: number
    papers: number
  }
}

const fmt = (n: number | undefined) => (typeof n === 'number' ? Math.round(n).toLocaleString() : '—')
const fmtUsd = (n: number | undefined) =>
  typeof n === 'number' ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

function Stat({ label, value, hint, accent = '#00ff88' }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="font-mono text-[10px] uppercase tracking-[2px] text-null-muted">{label}</div>
      <div className="mt-1 font-display font-black text-null-white" style={{ fontSize: 'clamp(22px,5vw,32px)', color: accent }}>
        {value}
      </div>
      {hint && <div className="mt-1 font-mono text-[10px] text-null-muted">{hint}</div>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 font-mono text-[10px] tracking-[4px] uppercase text-null-green">// {title}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
    </section>
  )
}

export default function StatsPage() {
  const [data, setData] = useState<StatsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/stats')
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`)
        return j
      })
      .then(j => { if (!cancelled) setData(j) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
    return () => { cancelled = true }
  }, [])

  const t = data?.onchain
  const maxDay = Math.max(1, ...(t?.purchasesPerDay ?? [1]))

  return (
    <div className="min-h-[100dvh] bg-[rgba(0,0,0,0.96)] p-4 sm:p-8">
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(0,255,136,0.06) 0%, transparent 55%)' }}
      />
      <div className="relative z-10 mx-auto w-full max-w-3xl">
        {/* Header */}
        <header className="mb-6 flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[9px] sm:text-[10px] tracking-[4px] sm:tracking-[6px] text-null-green uppercase mb-1">
              // NULLSTATE · LIVE STATS
            </div>
            <h1 className="font-display font-black text-null-white leading-none" style={{ fontSize: 'clamp(26px,7vw,44px)' }}>
              STATS
            </h1>
          </div>
          <Link
            href="/"
            className="shrink-0 font-mono text-[10px] sm:text-xs uppercase tracking-[2px] text-null-green border border-[rgba(0,255,136,0.4)] px-3 py-2 transition hover:bg-[rgba(0,255,136,0.06)]"
          >
            ◂ Home
          </Link>
        </header>

        {error && (
          <div className="mb-6 rounded-md border border-[rgba(224,122,58,0.5)] bg-[rgba(224,122,58,0.1)] p-4 font-mono text-xs text-[#f0a878]">
            Couldn’t load stats: {error}
          </div>
        )}
        {!data && !error && (
          <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-6 text-center font-mono text-xs text-null-muted">
            Loading live stats…
          </div>
        )}

        {data && (
          <>
            <Section title="Players">
              <Stat label="Total players" value={fmt(data.players.total)} />
              <Stat label="Active today (DAU)" value={fmt(data.players.dau)} accent="#4ad7ff" />
              <Stat label="Active 7d (WAU)" value={fmt(data.players.wau)} accent="#4ad7ff" />
              <Stat label="Active 30d (MAU)" value={fmt(data.players.mau)} accent="#4ad7ff" />
            </Section>

            <Section title="On-chain activity">
              <Stat label="Total transactions" value={fmt(t?.transactionsTotal)} hint="purchases + passes + rewards" />
              <Stat label="Purchases" value={fmt(t?.purchases)} accent="#f2cd82" />
              <Stat label="Purchase volume" value={fmtUsd(t?.purchaseVolumeUsd)} accent="#f2cd82" />
              <Stat label="Season Passes" value={fmt(t?.passMints)} accent="#c9a0ff" />
              <Stat label="USDT rewards paid" value={fmtUsd(t?.rewardsPaidUsd)} accent="#7ef0a6" hint={`${fmt(t?.rewardsPaidCount)} payouts`} />
              <Stat
                label="Paid with"
                value={`${fmt(t?.purchasesByToken.USDM)}·${fmt(t?.purchasesByToken.USDC)}·${fmt(t?.purchasesByToken.USDT)}`}
                hint="USDM · USDC · USDT"
                accent="#f0dcb8"
              />
            </Section>

            {/* 14-day purchases bar chart */}
            <section className="mb-8">
              <div className="mb-3 font-mono text-[10px] tracking-[4px] uppercase text-null-green">// PURCHASES · LAST 14 DAYS</div>
              <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="flex h-24 items-end justify-between gap-1">
                  {(t?.purchasesPerDay ?? []).map((v, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center justify-end" title={`${v} purchase(s)`}>
                      <div
                        className="w-full rounded-sm bg-[rgba(0,255,136,0.55)]"
                        style={{ height: `${Math.max(3, (v / maxDay) * 100)}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between font-mono text-[9px] text-null-muted">
                  <span>14d ago</span><span>today</span>
                </div>
              </div>
            </section>

            <Section title="Game economy">
              <Stat label="Items burned" value={fmt(data.economy.burnEvents)} hint="burn events" accent="#f0a878" />
              <Stat label="Points burned" value={fmt(data.economy.pointsBurned)} accent="#f0a878" />
              <Stat label="Vault cracks" value={fmt(data.economy.vaultCompletions)} accent="#7ef0a6" />
              <Stat label="Golden Keys" value={fmt(data.economy.goldenKeys)} accent="#f2cd82" />
              <Stat label="Old Papers" value={fmt(data.economy.papers)} accent="#d9b877" />
            </Section>

            <p className="mt-2 font-mono text-[9px] leading-relaxed text-null-muted">
              Live figures aggregated from NullState’s off-chain database (game activity + recorded on-chain
              purchases, Season-Pass mints, and Treasure-Vault / Season reward payouts on Celo). Refreshed every
              few minutes. Last updated {new Date(data.generatedAt).toLocaleString()}.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
