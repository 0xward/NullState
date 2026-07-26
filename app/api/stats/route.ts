import { NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { getMarketplaceItem } from '@/lib/constants/marketplace'
import { GAME_CONFIG } from '@/lib/constants/game-config'
import { tokenLabel } from '@/lib/constants/tokens'

// Public, no-wallet stats endpoint powering /stats — the analytics/operational
// visibility page MiniPay asks for in the listing readiness checklist
// (`celopedia-skill` → minipay-requirements.md §8). Everything here is
// aggregated from the same Firebase RTDB the game already writes to; no new
// tracking is introduced. Read-only, cached briefly at the edge.
export const dynamic = 'force-dynamic'

const DAY = 86_400_000

// Coerce anything to a finite number or 0.
function n(v: unknown): number {
  const x = typeof v === 'string' ? Number(v) : (v as number)
  return typeof x === 'number' && isFinite(x) ? x : 0
}

type TokenCount = { USDM: number; USDC: number; USDT: number }

export async function GET() {
  const db = getAdminDb()
  if (!db) {
    return NextResponse.json({ error: 'Stats service unavailable' }, { status: 503 })
  }

  try {
    const now = Date.now()

    const [
      mtxSnap,      // marketplaceTxHashes/{txHash} = { wallet, itemId, token, usd, at }
      passSnap,     // passMintTxHashes/{txHash}   = { wallet, seasonId, token, usd, at, status }
      elixirSnap,   // elixirTxHashes/{txHash}     = { wallet, token, usd, at }
      matSnap,      // materialsTxHashes/{txHash}  = { wallet, token, tier, usd, at }
      bpSnap,       // blueprintTxHashes/{txHash}  = { wallet, token, sectorId, usd, at }
      rewardsSnap,  // rewards/{wallet} = { seasonBonus:{...}, weeklyRewards:{...} }
      vaultSnap,    // vaultCompleted/{weekId}/{wallet} = { amount, token, completedAt }
      burnSnap,     // burnRecords/{seasonId}/{wallet}/{burnId} = { totalValue, timestamp }
      keySnap,      // goldenKeyClaims/{weekId}/{wallet}
      paperSnap,    // paperClaims/{weekId}/{wallet}
      ownedSnap,    // marketplaceOwned/{wallet}/{itemId}
      energySnap,   // energy/{wallet}
    ] = await Promise.all([
      db.ref('marketplaceTxHashes').get(),
      db.ref('passMintTxHashes').get(),
      db.ref('elixirTxHashes').get(),
      db.ref('materialsTxHashes').get(),
      db.ref('blueprintTxHashes').get(),
      db.ref('rewards').get(),
      db.ref('vaultCompleted').get(),
      db.ref('burnRecords').get(),
      db.ref('goldenKeyClaims').get(),
      db.ref('paperClaims').get(),
      db.ref('marketplaceOwned').get(),
      db.ref('energy').get(),
    ])

    // Track every wallet we ever see (unique-players proxy) and each wallet's
    // most recent activity timestamp (for DAU/MAU).
    const seen = new Set<string>()
    const lastActive = new Map<string, number>()
    const touch = (wallet?: unknown, ts?: number) => {
      if (typeof wallet !== 'string' || !wallet) return
      const w = wallet.toLowerCase()
      seen.add(w)
      if (ts && ts > (lastActive.get(w) ?? 0)) lastActive.set(w, ts)
    }

    // ---- Money in: EVERY paid flow, not just the marketplace ----------------
    // This used to count marketplaceTxHashes and nothing else. Season passes
    // were reported as a separate headline number worth $0, and elixir, shard
    // packs and sector blueprints were invisible entirely — three whole revenue
    // lines missing from "purchase volume", and their buyers missing from the
    // unique-player count.
    //
    // Revenue is read from the `usd` recorded ON THE TRANSACTION. The old code
    // looked each itemId up in the CURRENT price list, so every repricing
    // rewrote history: halving prices halved all past revenue. Records written
    // before `usd` existed fall back to today's price, which is the best that
    // can be done for them — `volumeEstimated` says how many are guesses so the
    // number is never quoted as exact when it isn't.
    const purchasesByToken: TokenCount = { USDM: 0, USDC: 0, USDT: 0 }
    let purchaseCount = 0
    let purchaseVolumeUsd = 0
    let volumeEstimated = 0
    const revenueByKind: Record<string, { count: number; usd: number }> = {
      items: { count: 0, usd: 0 },
      passes: { count: 0, usd: 0 },
      elixir: { count: 0, usd: 0 },
      shards: { count: 0, usd: 0 },
      blueprints: { count: 0, usd: 0 },
    }

    // Daily purchase counts for the last 14 days (oldest → newest).
    const days = 14
    const perDay = new Array<number>(days).fill(0)
    const startDay = new Date(now); startDay.setHours(0, 0, 0, 0)
    const todayStart = startDay.getTime()

    const countSale = (kind: keyof typeof revenueByKind, rec: any, fallbackUsd: number | null) => {
      purchaseCount++
      const label = tokenLabel(rec.token) as keyof TokenCount
      if (label in purchasesByToken) purchasesByToken[label]++

      let usd = n(rec.usd)
      if (!usd && fallbackUsd != null) { usd = fallbackUsd; volumeEstimated++ }
      purchaseVolumeUsd += usd
      revenueByKind[kind].count++
      revenueByKind[kind].usd += usd

      const at = n(rec.at)
      touch(rec.wallet, at)
      if (at) {
        const idx = days - 1 - Math.floor((todayStart - at) / DAY)
        if (idx >= 0 && idx < days) perDay[idx]++
      }
    }

    const eachRec = (snap: any, fn: (rec: any) => void) => {
      if (!snap?.exists()) return
      for (const rec of Object.values(snap.val() as Record<string, any>)) {
        if (rec && typeof rec === 'object') fn(rec)
      }
    }

    eachRec(mtxSnap, (rec) => {
      const item = getMarketplaceItem(String(rec.itemId ?? ''))
      countSale('items', rec, item ? item.price : null)
    })

    // Only mints that actually SUCCEEDED. A failed or still-pending mint leaves
    // a record behind, and counting those inflated the headline pass number.
    // Records predating the status field are treated as successful, since at
    // the time nothing was written unless the mint went through.
    let passMints = 0
    eachRec(passSnap, (rec) => {
      if (rec.status && rec.status !== 'success') return
      passMints++
      countSale('passes', rec, null)   // no fallback: the price is owner-adjustable, so a guess would be fiction
    })

    eachRec(elixirSnap, (rec) => countSale('elixir', rec, GAME_CONFIG.elixir.priceUSD))
    eachRec(matSnap,    (rec) => countSale('shards', rec, GAME_CONFIG.weaponEvolution.shardPack.priceUSD))
    eachRec(bpSnap,     (rec) => {
      const sector = GAME_CONFIG.premiumSectors.find(s => s.id === rec.sectorId)
      countSale('blueprints', rec, sector ? sector.priceUSD : null)
    })

    // ---- Real stablecoin rewards paid out (vault wins + season/weekly ledger) ----
    let rewardsPaidCount = 0
    let rewardsPaidUsd = 0
    let vaultCompletions = 0
    if (vaultSnap.exists()) {
      const byWeek = vaultSnap.val() as Record<string, Record<string, any>>
      for (const wallets of Object.values(byWeek)) {
        for (const [w, rec] of Object.entries(wallets ?? {})) {
          if (!rec || typeof rec !== 'object') continue
          vaultCompletions++
          rewardsPaidCount++
          rewardsPaidUsd += n(rec.amount)
          touch(w, n(rec.completedAt))
        }
      }
    }
    if (rewardsSnap.exists()) {
      for (const [w, val] of Object.entries(rewardsSnap.val() as Record<string, any>)) {
        for (const rec of Object.values(val?.seasonBonus ?? {})) {
          rewardsPaidCount++; rewardsPaidUsd += n((rec as any)?.amount)
          touch(w, n((rec as any)?.claimedAt) || n((rec as any)?.at))
        }
        for (const rec of Object.values(val?.weeklyRewards ?? {})) {
          rewardsPaidCount++; rewardsPaidUsd += n((rec as any)?.amount)
          touch(w, n((rec as any)?.claimedAt) || n((rec as any)?.at))
        }
      }
    }

    // ---- Burns (in-game economy) ----
    let burnEvents = 0
    let pointsBurned = 0
    if (burnSnap.exists()) {
      const bySeason = burnSnap.val() as Record<string, Record<string, Record<string, any>>>
      for (const wallets of Object.values(bySeason)) {
        for (const [w, records] of Object.entries(wallets ?? {})) {
          for (const rec of Object.values(records ?? {})) {
            if (!rec || typeof rec !== 'object') continue
            burnEvents++
            pointsBurned += n((rec as any).totalValue)
            touch(w, n((rec as any).timestamp) || n((rec as any).recordedAt))
          }
        }
      }
    }

    // ---- Weekly quest claims (count leaves under {weekId}/{wallet}) ----
    const countLeaves = (snap: any): number => {
      if (!snap?.exists()) return 0
      let c = 0
      for (const wallets of Object.values(snap.val() as Record<string, any>)) {
        for (const w of Object.keys(wallets ?? {})) { touch(w); c++ }
      }
      return c
    }
    const goldenKeys = countLeaves(keySnap)
    const papers = countLeaves(paperSnap)

    // Fold owned + energy roots into the unique-player set.
    if (ownedSnap.exists()) for (const w of Object.keys(ownedSnap.val())) touch(w)
    if (energySnap.exists()) for (const w of Object.keys(energySnap.val())) touch(w)

    // ---- DAU / MAU from collected activity timestamps ----
    let dau = 0, wau = 0, mau = 0
    for (const ts of lastActive.values()) {
      const age = now - ts
      if (age < DAY) dau++
      if (age < 7 * DAY) wau++
      if (age < 30 * DAY) mau++
    }

    const payload = {
      generatedAt: now,
      players: {
        total: seen.size,
        dau, wau, mau,
      },
      onchain: {
        // `purchases` now spans every paid flow, so passes are inside this
        // count as well as being reported separately below.
        purchases: purchaseCount,
        purchasesByToken: purchasesByToken,
        purchaseVolumeUsd: Math.round(purchaseVolumeUsd * 100) / 100,
        // How many of those sales had no recorded price and were valued at
        // today's list price instead. Zero means the figure is exact.
        volumeEstimated,
        revenueByKind,
        passMints,
        rewardsPaidCount,
        rewardsPaidUsd: Math.round(rewardsPaidUsd * 1e6) / 1e6,
        // passMints is no longer added on top — it is already in purchaseCount.
        transactionsTotal: purchaseCount + rewardsPaidCount,
        purchasesPerDay: perDay,
      },
      economy: {
        burnEvents,
        pointsBurned: Math.round(pointsBurned),
        vaultCompletions,
        goldenKeys,
        papers,
      },
    }

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('[stats] Error:', error)
    return NextResponse.json({ error: 'Failed to build stats' }, { status: 500 })
  }
}
