'use client'

import { useEffect, useState, useCallback } from 'react'
import { useWallet } from '@/lib/WalletProvider'
import { MARKETPLACE_ITEMS, ACCEPTED_TOKENS, getMarketplaceItem, resolveItemId, type MarketplaceItem, type MarketplaceTokenSymbol } from '@/lib/constants/marketplace'

interface MarketplaceScreenProps {
  onBack: () => void
  address?: string
}

function ownedKey(addr?: string) {
  return `nullstate-owned-${(addr || '').toLowerCase()}`
}

export default function MarketplaceScreen({ onBack, address }: MarketplaceScreenProps) {
  const { buyMarketplaceItem, insufficientFunds, addCashUrl, isGuest } = useWallet()
  const [token, setToken] = useState<MarketplaceTokenSymbol>('USDm')
  const [owned, setOwned] = useState<string[]>([])
  // v76 Task #7: four weapons were re-skinned with new ids, four items removed.
  // Normalise any pre-v76 id coming from cache/server so a wallet that already
  // bought the old version still sees it as owned, and so ids that no longer
  // exist stop rendering as ghost entries. Mirrors the same mapping applied by
  // loadPersistedEquipment() in game.js.
  const normalizeOwned = useCallback((list: string[]) => {
    const mapped = list.map(resolveItemId).filter(id => !!getMarketplaceItem(id))
    return mapped.filter((id, i) => mapped.indexOf(id) === i)
  }, [])
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; kind: 'info' | 'ok' | 'err' } | null>(null)
  const [tokenBalance, setTokenBalance] = useState<number | null>(null)
  const [swapConfirmId, setSwapConfirmId] = useState<string | null>(null)

  // NullState Point balance — off-chain, credited from burning items
  // (see /api/burn/record). Used to gate the "Swap" option below.
  const loadTokenBalance = useCallback(() => {
    if (!address) return
    fetch(`/api/player/profile?walletAddress=${address}`)
      .then(r => r.json())
      .then(d => {
        const bal = d?.summary?.nullstateTokenBalance
        setTokenBalance(typeof bal === 'number' ? bal : 0)
      })
      .catch(() => { /* offline — leave as-is */ })
  }, [address])

  useEffect(() => { loadTokenBalance() }, [loadTokenBalance])

  const persist = useCallback((list: string[]) => {
    list = normalizeOwned(list)
    setOwned(list)
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(ownedKey(address), JSON.stringify(list))
        const NS = (window as unknown as { NS_EQUIP?: { setOwned?: (l: string[]) => void } }).NS_EQUIP
        NS?.setOwned?.(list)
      }
    } catch { /* non-critical */ }
  }, [address, normalizeOwned])

  // Load owned on mount: localStorage first (instant), then server (source of truth)
  useEffect(() => {
    if (!address) return
    try {
      const cached = localStorage.getItem(ownedKey(address))
      if (cached) setOwned(normalizeOwned(JSON.parse(cached)))
    } catch { /* ignore */ }
    fetch(`/api/marketplace/owned?wallet=${address}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.owned)) persist(d.owned) })
      .catch(() => { /* offline — keep cache */ })
  }, [address, persist, normalizeOwned])

  // v72 dev bypass (frontend half): if this wallet is listed in
  // NEXT_PUBLIC_DEV_TEST_WALLETS (comma-separated), BUY skips the real
  // payment tx and asks the verify API for a dev grant instead. The server
  // independently re-checks its own DEV_TEST_WALLETS env var, so this public env
  // var alone grants nothing — it only changes which request the UI sends.
  const isDevWallet =
    !!address &&
    (process.env.NEXT_PUBLIC_DEV_TEST_WALLETS || '')
      .split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
      .includes(address.toLowerCase())

  const handleBuy = useCallback(async (item: MarketplaceItem) => {
    if (busy) return
    if (isGuest) { setMsg({ text: 'Connect a wallet to buy — you’re playing as a guest.', kind: 'err' }); return }
    setBusy(item.id)
    setMsg({ text: isDevWallet ? 'DEV: requesting free unlock…' : `Sending ${item.price} ${token}…`, kind: 'info' })
    try {
      let txHash = ''
      if (!isDevWallet) {
        txHash = await buyMarketplaceItem(item.price, token)
        setMsg({ text: 'Payment sent — verifying on-chain…', kind: 'info' })
      }
      const res = await fetch('/api/marketplace/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isDevWallet
            ? { wallet: address, itemId: item.id, token, devBypass: true }
            : { wallet: address, txHash, itemId: item.id, token },
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      persist(Array.isArray(data.owned) ? data.owned : [...owned, item.id])
      setMsg({ text: `✓ ${item.name} unlocked! Equip it in your inventory.`, kind: 'ok' })
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : 'Purchase failed'
      setMsg({ text: m, kind: 'err' })
    } finally {
      setBusy(null)
    }
  }, [busy, token, address, owned, buyMarketplaceItem, persist, isDevWallet, isGuest])

  const handleSwap = useCallback(async (item: MarketplaceItem) => {
    if (busy || !item.tokenPrice) return
    setBusy(item.id)
    setSwapConfirmId(null)
    setMsg({ text: `Swapping ${item.tokenPrice} NullState Point…`, kind: 'info' })
    try {
      const res = await fetch('/api/marketplace/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, itemId: item.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Swap failed')
      persist(Array.isArray(data.owned) ? data.owned : [...owned, item.id])
      if (typeof data.newBalance === 'number') setTokenBalance(data.newBalance)
      setMsg({ text: `✓ ${item.name} unlocked via NullState Point! Equip it in your inventory.`, kind: 'ok' })
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : 'Swap failed'
      setMsg({ text: m, kind: 'err' })
    } finally {
      setBusy(null)
    }
  }, [busy, address, owned, persist])

  // Issue 4a: expensive-first within each category section.
  const armor = MARKETPLACE_ITEMS.filter(i => i.type === 'armor').sort((a, b) => b.price - a.price)
  const weapons = MARKETPLACE_ITEMS.filter(i => i.type === 'weapon').sort((a, b) => b.price - a.price)
  // Phase 9 — cosmetic skins ($5-$10), pure visuals with no stats.
  const outfits = MARKETPLACE_ITEMS.filter(i => i.type === 'outfit').sort((a, b) => b.price - a.price)

  const renderItem = (item: MarketplaceItem) => {
    const isOwned = owned.includes(item.id)
    // Skins (outfits) intentionally show NO stat/type descriptor line (owner:
    // don't spell out that they're cosmetic). Only weapons/armor get a stat line.
    const stat = item.type === 'armor'
      ? `+${Math.round((item.effect.hpBonus || 0) * 100)}% HP`
      : item.type === 'weapon'
      ? `+${item.effect.atkBonus || 0} ATK`
      : null
    const tierGlow = ['', 'shadow-[0_0_0_1px_rgba(180,130,70,.4)]', 'shadow-[0_0_14px_rgba(180,130,70,.4)]', 'shadow-[0_0_22px_rgba(255,180,90,.55)]'][item.fxTier]
    return (
      <div key={item.id}>
      <div
        className={`flex items-center gap-3 rounded-lg border border-[#7a4f24]/60 bg-gradient-to-b from-[#2b1a0d] to-[#1a0f06] p-3 ${tierGlow}`}>
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-black/40 border border-[#7a4f24]/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.sprite} alt={item.name} className="h-9 w-9 [image-rendering:pixelated]"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-sm font-bold text-[#f0dcb8]">{item.name}</span>
            <span className="rounded bg-[#e8bd6f] px-1.5 text-[9px] font-bold text-[#2a1705]">T{item.fxTier}</span>
          </div>
          {stat && (
            <div className="font-mono text-[10px] uppercase tracking-wide text-[#c39a5f]">{stat} · {item.type}</div>
          )}
          <div className="mt-0.5 truncate font-mono text-[10px] text-[#9c7a4f]">{item.desc}</div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-sm font-bold text-[#f2cd82]">${item.price.toFixed(2)}</span>
          {isOwned ? (
            <span className="rounded border border-[#8a5a2b] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#c39a5f]">Owned</span>
          ) : (
            <div className="flex flex-col items-stretch gap-1">
              <button
                onClick={() => handleBuy(item)}
                disabled={busy !== null}
                className="rounded bg-gradient-to-b from-[#e8bd6f] to-[#c9962f] px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#2a1705] transition hover:brightness-110 disabled:opacity-50"
              >
                {busy === item.id ? '…' : 'Buy'}
              </button>
              {/* Swap (with NullState Point) sits directly under Buy. It
                  AUTO-EXPANDS the confirm panel below the moment the player has
                  enough Point (owner spec), so an affordable swap is one tap,
                  not two; otherwise it toggles a "need more Point" hint. */}
              {item.tokenPrice ? (
                <button
                  onClick={() => setSwapConfirmId(swapConfirmId === item.id ? null : item.id)}
                  disabled={busy !== null}
                  className="rounded border border-[#4ade80]/50 px-4 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[#7ef0a6] transition hover:bg-[#4ade80]/10 disabled:opacity-50"
                >
                  Swap ⇄ Point
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
      {(swapConfirmId === item.id || (item.tokenPrice != null && tokenBalance !== null && tokenBalance >= item.tokenPrice)) && item.tokenPrice && !isOwned && (
        <div className="mt-2 -mb-1 rounded-lg border border-[#4ade80]/40 bg-[#4ade80]/5 p-3 font-mono text-[10px]">
          <div className="flex items-center justify-between text-[#c9e8d4]">
            <span>Your NullState Point</span>
            <span className="font-bold text-[#7ef0a6]">{tokenBalance ?? '…'}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[#c9e8d4]">
            <span>Required</span>
            <span className="font-bold text-[#e8c37a]">{item.tokenPrice}</span>
          </div>
          {tokenBalance !== null && tokenBalance < item.tokenPrice ? (
            <p className="mt-2 text-[#f0a878]">Not enough NullState Point yet — burn more items in your inventory to earn some.</p>
          ) : (
            <button
              onClick={() => handleSwap(item)}
              disabled={busy !== null || tokenBalance === null}
              className="mt-2 w-full rounded bg-gradient-to-b from-[#4ade80] to-[#22b862] px-3 py-1.5 font-bold uppercase tracking-wider text-[#062b13] transition hover:brightness-110 disabled:opacity-50"
            >
              {busy === item.id ? 'Swapping…' : 'Confirm Swap'}
            </button>
          )}
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
            <h1 className="font-mono text-2xl font-bold text-[#f2cd82]">MARKETPLACE</h1>
          </div>
          <button onClick={onBack}
            className="rounded border border-[#7a4f24] px-3 py-2 font-mono text-xs uppercase tracking-wider text-[#c39a5f] hover:bg-[#7a4f24]/20">
            ◂ Back
          </button>
        </header>

        {/* Guest note — buying with real currency needs a wallet, but swapping
            earned NullState Point for basic gear still works while playing. */}
        {isGuest && (
          <div className="mb-4 rounded-lg border border-[#7a4f24]/50 bg-[#7a4f24]/10 p-3 font-mono text-[10px] leading-relaxed text-[#e8c37a]">
            You’re playing as a guest. Buying with USDm/USDC/USDT needs a connected wallet — but you can still <span className="text-[#7ef0a6]">Swap ⇄ Point</span> for basic gear using Point you earn by burning loot.
          </div>
        )}

        {/* token selector */}
        <div className="mb-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[2px] text-[#9c7a4f]">Pay with</p>
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
          <p className="mt-2 font-mono text-[9px] leading-relaxed text-[#9c7a4f]">
            Paid on Celo · MiniPay covers the network fee automatically. Purchases are permanent and equippable in-game.
          </p>
        </div>

        {msg && (
          <div className={`mb-4 rounded-lg border p-3 font-mono text-xs ${
            msg.kind === 'ok' ? 'border-[#4ade80]/50 bg-[#4ade80]/10 text-[#7ef0a6]'
            : msg.kind === 'err' ? 'border-[#e07a3a]/50 bg-[#e07a3a]/10 text-[#f0a878]'
            : 'border-[#7a4f24]/50 bg-[#7a4f24]/10 text-[#e8c37a]'
          }`}>
            <div>{msg.text}</div>
            {msg.kind === 'err' && insufficientFunds && addCashUrl && (
              <a
                href={addCashUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-[#f2cd82] underline underline-offset-2"
              >
                Add cash in MiniPay →
              </a>
            )}
          </div>
        )}

        <section className="mb-5">
          <h2 className="mb-2 font-mono text-xs font-bold uppercase tracking-[3px] text-[#e6c07a]">⛨ Armor</h2>
          <div className="flex flex-col gap-2">{armor.map(renderItem)}</div>
        </section>
        <section className="mb-5">
          <h2 className="mb-2 font-mono text-xs font-bold uppercase tracking-[3px] text-[#e6c07a]">⚔ Weapons</h2>
          <div className="flex flex-col gap-2">{weapons.map(renderItem)}</div>
        </section>
        <section>
          <h2 className="mb-2 font-mono text-xs font-bold uppercase tracking-[3px] text-[#e6c07a]">✦ Skins</h2>
          <div className="flex flex-col gap-2">{outfits.map(renderItem)}</div>
        </section>
      </div>
    </div>
  )
}
