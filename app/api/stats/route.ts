import { NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { getMarketplaceItem } from '@/lib/constants/marketplace'
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
      mtxSnap,      // marketplaceTxHashes/{txHash} = { wallet, itemId, token, at }
      passSnap,     // passMintTxHashes/{txHash}
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

    // ---- Purchases (ERC-20 transfers to treasury, recorded off-chain) ----
    const purchasesByToken: TokenCount = { USDM: 0, USDC: 0, USDT: 0 }
    let purchaseCount = 0
    let purchaseVolumeUsd = 0
    // Daily purchase counts for the last 14 days (oldest → newest).
    const days = 14
    const perDay = new Array<number>(days).fill(0)
    const startDay = new Date(now); startDay.setHours(0, 0, 0, 0)
    const todayStart = startDay.getTime()

    if (mtxSnap.exists()) {
      for (const rec of Object.values(mtxSnap.val() as Record<string, any>)) {
        if (!rec || typeof rec !== 'object') continue
        purchaseCount++
        const label = tokenLabel(rec.token) as keyof TokenCount
        if (label in purchasesByToken) purchasesByToken[label]++
        const item = getMarketplaceItem(String(rec.itemId ?? ''))
        if (item) purchaseVolumeUsd += item.price
        const at = n(rec.at)
        touch(rec.wallet, at)
        if (at) {
          const idx = days - 1 - Math.floor((todayStart - at) / DAY)
          if (idx >= 0 && idx < days) perDay[idx]++
        }
      }
    }

    // ---- Season Passes minted ----
    const passMints = passSnap.exists() ? Object.keys(passSnap.val()).length : 0

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
        purchases: purchaseCount,
        purchasesByToken: purchasesByToken,
        purchaseVolumeUsd: Math.round(purchaseVolumeUsd * 100) / 100,
        passMints,
        rewardsPaidCount,
        rewardsPaidUsd: Math.round(rewardsPaidUsd * 1e6) / 1e6,
        transactionsTotal: purchaseCount + passMints + rewardsPaidCount,
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
