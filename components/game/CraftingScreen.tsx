'use client'

import { useEffect, useState, useCallback } from 'react'
import { useWallet } from '@/lib/WalletProvider'
import {
  MARKETPLACE_ITEMS, ACCEPTED_TOKENS, getMarketplaceItem, resolveItemId, maxWeaponTier,
  type MarketplaceItem, type MarketplaceTokenSymbol,
} from '@/lib/constants/marketplace'
import { GAME_CONFIG } from '@/lib/constants/game-config'

interface CraftingScreenProps {
  onBack: () => void
  // Free path: send the player back to the menu to start a run and farm the
  // shard tier they're short on. Kept separate from onBack so the intent
  // ("go play") reads clearly at the call site even though both land on menu —
  // a run must start through the menu's New Game/Continue + energy flow, never
  // straight from here.
  onGoToRun?: () => void
  address?: string
}

type ShardBal = { t1: number; t2: number; t3: number }
type TierKey = 't1' | 't2' | 't3'

// Which act drops each shard tier most (mirrors game.js _shardTierForAct:
// acts 1-2 = t1, 3-4 = t2, 5 = t3). Used for the free-path CTA label.
const ACT_FOR_TIER: Record<TierKey, string> = { t1: 'Act 1–2', t2: 'Act 3–4', t3: 'Act 5' }

export default function CraftingScreen({ onBack, onGoToRun, address }: CraftingScreenProps) {
  const { buyMarketplaceItem, insufficientFunds, addCashUrl } = useWallet()
  const [token, setToken] = useState<MarketplaceTokenSymbol>('USDm')
  const [owned, setOwned] = useState<string[]>([])
  const [tiers, setTiers] = useState<Record<string, number>>({})
  const [shards, setShards] = useState<ShardBal>({ t1: 0, t2: 0, t3: 0 })
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; kind: 'info' | 'ok' | 'err' } | null>(null)

  const pack = GAME_CONFIG.weaponEvolution.shardPack

  // Same server-side-rechecked dev bypass the Marketplace uses.
  const isDevWallet =
    !!address &&
    (process.env.NEXT_PUBLIC_DEV_TEST_WALLETS || '')
      .split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
      .includes(address.toLowerCase())

  const refreshShards = useCallback(() => {
    if (!address) return
    fetch(`/api/materials?wallet=${address}`)
      .then(r => r.json())
      .then(d => { if (d && typeof d.t1 === 'number') setShards({ t1: d.t1, t2: d.t2 || 0, t3: d.t3 || 0 }) })
      .catch(() => { /* offline — leave as-is */ })
  }, [address])

  const refreshTiers = useCallback(() => {
    if (!address) return
    fetch(`/api/weapons?wallet=${address}`)
      .then(r => r.json())
      .then(d => { if (d && d.tiers && typeof d.tiers === 'object') setTiers(d.tiers) })
      .catch(() => { /* offline — treat all as base tier */ })
  }, [address])

  // Load owned weapons + shard balance + current tiers on mount.
  useEffect(() => {
    if (!address) return
    fetch(`/api/marketplace/owned?wallet=${address}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.owned)) {
          const weapons = d.owned
            .map(resolveItemId)
            .filter((id: string) => {
              const it = getMarketplaceItem(id)
              return !!it && it.type === 'weapon' && !!it.evolutionTiers?.length
            })
          setOwned(weapons.filter((id: string, i: number) => weapons.indexOf(id) === i))
        }
      })
      .catch(() => { /* offline — empty list */ })
    refreshShards()
    refreshTiers()
  }, [address, refreshShards, refreshTiers])

  const handleUpgrade = useCallback(async (item: MarketplaceItem) => {
    if (busy) return
    setBusy(item.id)
    setMsg({ text: `Forging ${item.name}…`, kind: 'info' })
    try {
      const res = await fetch('/api/weapons/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, itemId: item.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upgrade failed')
      setTiers(prev => ({ ...prev, [item.id]: data.tier }))
      if (data.materials) setShards({ t1: data.materials.t1 || 0, t2: data.materials.t2 || 0, t3: data.materials.t3 || 0 })
      setMsg({ text: `✓ ${item.name} evolved to Tier ${data.tier}!`, kind: 'ok' })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Upgrade failed', kind: 'err' })
    } finally {
      setBusy(null)
    }
  }, [busy, address])

  const handleBuyPack = useCallback(async (item: MarketplaceItem, tierKey: TierKey) => {
    if (busy) return
    setBusy(item.id)
    setMsg({ text: isDevWallet ? 'DEV: requesting free shards…' : `Sending $${pack.priceUSD} ${token}…`, kind: 'info' })
    try {
      let txHash = ''
      if (!isDevWallet) {
        txHash = await buyMarketplaceItem(pack.priceUSD, token)
        setMsg({ text: 'Payment sent — verifying on-chain…', kind: 'info' })
      }
      const res = await fetch('/api/materials/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isDevWallet
            ? { wallet: address, tier: tierKey, devBypass: true }
            : { wallet: address, txHash, token, tier: tierKey },
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Purchase failed')
      setShards({ t1: data.t1 || 0, t2: data.t2 || 0, t3: data.t3 || 0 })
      setMsg({ text: `✓ +${pack.shards} ${tierKey.toUpperCase()} Glitch Shards added!`, kind: 'ok' })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Purchase failed', kind: 'err' })
    } finally {
      setBusy(null)
    }
  }, [busy, isDevWallet, pack.priceUSD, pack.shards, token, address, buyMarketplaceItem])

  // Cheapest-first mirrors the Marketplace so newly bought weapons surface near
  // the top of the crafting list.
  const weapons = owned
    .map(getMarketplaceItem)
    .filter((i): i is MarketplaceItem => !!i)
    .sort((a, b) => a.price - b.price)

  const renderCard = (item: MarketplaceItem) => {
    const curTier = Math.max(1, tiers[item.id] || 1)
    const cap = maxWeaponTier(item)
    const atMax = curTier >= cap
    const tierKey = (`t${item.fxTier}`) as TierKey
    const step = atMax ? null : item.evolutionTiers?.[curTier - 1]
    const cost = step ? (step.materialsRequired[tierKey] || 0) : 0
    const have = shards[tierKey]
    const shortBy = Math.max(0, cost - have)
    const canUpgrade = !atMax && shortBy === 0

    return (
      <div key={item.id}
        className="rounded-lg border border-[#7a4f24]/60 bg-gradient-to-b from-[#2b1a0d] to-[#1a0f06] p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-black/40 border border-[#7a4f24]/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.sprite} alt={item.name} className="h-9 w-9 [image-rendering:pixelated]"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-sm font-bold text-[#f0dcb8]">{item.name}</span>
              <span className="rounded bg-[#e8bd6f] px-1.5 text-[9px] font-bold text-[#2a1705]">
                TIER {curTier}/{cap}
              </span>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-[#c39a5f]">
              +{(item.effect.atkBonus || 0) + (item.evolutionTiers?.slice(0, curTier - 1).reduce((s, t) => s + (t.atkBonusDelta || 0), 0) || 0)} ATK
              {!atMax && step ? ` · next +${step.atkBonusDelta} ATK` : ''}
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-1">
            {atMax ? (
              <span className="rounded border border-[#8a5a2b] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#c39a5f]">Max</span>
            ) : (
              <>
                <span className="font-mono text-[10px] text-[#9c7a4f]">
                  <b className={have >= cost ? 'text-[#7ef0a6]' : 'text-[#f0a878]'}>{have}</b>/{cost} {tierKey.toUpperCase()}
                </span>
                <button
                  onClick={() => handleUpgrade(item)}
                  disabled={busy !== null || !canUpgrade}
                  className="rounded bg-gradient-to-b from-[#e8bd6f] to-[#c9962f] px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#2a1705] transition hover:brightness-110 disabled:opacity-40"
                >
                  {busy === item.id ? '…' : 'Upgrade'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Shortfall CTA — the blueprint's hard rule: the FREE path is shown
            with EQUAL weight beside the paid path, never the paid button alone. */}
        {!atMax && shortBy > 0 && (
          <div className="mt-3 rounded-lg border border-[#7a4f24]/40 bg-black/30 p-3">
            <p className="mb-2 font-mono text-[10px] text-[#f0a878]">
              You need <b>{shortBy}</b> more {tierKey.toUpperCase()} Glitch Shard{shortBy > 1 ? 's' : ''}.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => (onGoToRun || onBack)()}
                disabled={busy !== null}
                className="rounded border border-[#4ade80]/50 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#7ef0a6] transition hover:bg-[#4ade80]/10 disabled:opacity-50"
              >
                Farm in {ACT_FOR_TIER[tierKey]}
              </button>
              <button
                onClick={() => handleBuyPack(item, tierKey)}
                disabled={busy !== null}
                className="rounded bg-gradient-to-b from-[#e8bd6f] to-[#c9962f] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#2a1705] transition hover:brightness-110 disabled:opacity-50"
              >
                {busy === item.id ? '…' : `Buy ${pack.shards} — $${pack.priceUSD}`}
              </button>
            </div>
            <p className="mt-2 font-mono text-[9px] leading-relaxed text-[#9c7a4f]">
              Free: clear runs to loot shards. Or top up instantly — {pack.shards} {tierKey.toUpperCase()} shards for ${pack.priceUSD}.
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(10,7,4,0.97)] p-4 sm:p-6">
      <div className="mx-auto w-full max-w-lg pb-16">
        <header className="mb-4 flex items-center justify-between border-b border-[#7a4f24]/40 pb-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[4px] text-[#c39a5f]">// NullState</p>
            <h1 className="font-mono text-2xl font-bold text-[#f2cd82]">CRAFTING</h1>
          </div>
          <button onClick={onBack}
            className="rounded border border-[#7a4f24] px-3 py-2 font-mono text-xs uppercase tracking-wider text-[#c39a5f] hover:bg-[#7a4f24]/20">
            ◂ Back
          </button>
        </header>

        {/* shard balance strip */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {(['t1', 't2', 't3'] as TierKey[]).map(k => (
            <div key={k} className="rounded-lg border border-[#7a4f24]/50 bg-[#2b1a0d] px-3 py-2 text-center">
              <div className="font-mono text-[9px] uppercase tracking-wider text-[#9c7a4f]">{k.toUpperCase()} Shards</div>
              <div className="font-mono text-lg font-bold text-[#f2cd82]">{shards[k]}</div>
            </div>
          ))}
        </div>

        {/* token selector (only needed for the paid $1 top-up) */}
        <div className="mb-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[2px] text-[#9c7a4f]">Top-up pays with</p>
          <div className="flex gap-2">
            {ACCEPTED_TOKENS.map(t => (
              <button key={t} onClick={() => setToken(t)}
                className={`flex-1 rounded-lg border px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider transition ${
                  token === t
                    ? 'border-[#e8bd6f] bg-gradient-to-b from-[#e8bd6f] to-[#c9962f] text-[#2a1705]'
                    : 'border-[#7a4f24]/60 bg-[#2b1a0d] text-[#c39a5f] hover:border-[#8a5a2b]'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {msg && (
          <div className={`mb-4 rounded-lg border p-3 font-mono text-xs ${
            msg.kind === 'ok' ? 'border-[#4ade80]/50 bg-[#4ade80]/10 text-[#7ef0a6]'
            : msg.kind === 'err' ? 'border-[#e07a3a]/50 bg-[#e07a3a]/10 text-[#f0a878]'
            : 'border-[#7a4f24]/50 bg-[#7a4f24]/10 text-[#e8c37a]'
          }`}>
            <div>{msg.text}</div>
            {msg.kind === 'err' && insufficientFunds && addCashUrl && (
              <a href={addCashUrl} target="_blank" rel="noopener noreferrer"
                className="mt-2 inline-block text-[#f2cd82] underline underline-offset-2">
                Add cash in MiniPay →
              </a>
            )}
          </div>
        )}

        <section>
          <h2 className="mb-2 font-mono text-xs font-bold uppercase tracking-[3px] text-[#e6c07a]">⚒ Your Weapons</h2>
          {weapons.length === 0 ? (
            <div className="rounded-lg border border-[#7a4f24]/40 bg-[#2b1a0d]/60 p-4 text-center font-mono text-[11px] text-[#9c7a4f]">
              No weapons to evolve yet. Buy one in the Marketplace, then level it here with Glitch Shards.
            </div>
          ) : (
            <div className="flex flex-col gap-2">{weapons.map(renderCard)}</div>
          )}
        </section>
      </div>
    </div>
  )
}
