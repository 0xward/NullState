import { toDataSuffix, codeFromHostname } from '@celo/attribution-tags'
import { concat, type Hex } from 'viem'

// ─── Celo Attribution Tags (ERC-8021) ────────────────────────────────────────
// Appends a tiny attribution suffix to the calldata of every transaction the
// app sends on Celo. The EVM discards trailing calldata bytes, so the suffix is
// INVISIBLE to the contract — it never changes execution (an ERC20 transfer
// still emits the same Transfer event, so /api/marketplace/verify is
// unaffected). It only lets Celo trace the transaction back to NullState for
// ecosystem-impact tracking and future reward distribution.
//
// Code source: hostname-derived (Option A — zero registration, the MiniPay
// default). Same host → same code every time; subdomains stay distinct, so
// nullstate-ten.vercel.app has its own code and never collides with other
// *.vercel.app apps.
//
// SSR-safe: window.location is browser-only, so getAttributionSuffix() returns
// undefined on the server (during prerender). Callers spread it into
// writeContract's `dataSuffix` (undefined = no suffix) or run it through
// withAttribution() for sendTransaction calldata (no-op when undefined).

let cached: Hex | null = null

export function getAttributionSuffix(): Hex | undefined {
  if (typeof window === 'undefined') return undefined
  if (cached) return cached
  try {
    cached = toDataSuffix(codeFromHostname(window.location.hostname)) as Hex
    return cached
  } catch {
    return undefined
  }
}

// Append the attribution suffix to already-encoded calldata (for
// sendTransaction, which takes raw `data`). Returns the data unchanged on the
// server or if the suffix can't be derived — so it can never break a tx.
export function withAttribution(data: Hex): Hex {
  const tag = getAttributionSuffix()
  return tag ? (concat([data, tag]) as Hex) : data
}

// ─── Server-side transactions ────────────────────────────────────────────────
// Not every NullState transaction comes from a browser. The backend signs four
// of them itself — the Treasure Vault payout and its score write
// (app/api/vault/submit), the Season Pass mint (app/api/passsbt/mint), and the
// referral pass gift (lib/server/referrals.ts) — and those were going out
// completely untagged, because getAttributionSuffix() reads
// window.location.hostname and there is no window on a server.
//
// That is the wrong half to lose. The vault payout is the transaction that
// moves real USDT to a player; it is the most worth attributing of anything we
// send. And attribution cannot be backfilled — untagged history stays
// unattributed, so every payout signed before this was permanently uncounted.
//
// The hostname is hardcoded rather than read from a request header on purpose.
// It has to produce the SAME code as the browser does on production, or the
// dashboard splits NullState into two apps; and a header is attacker-controlled,
// so deriving it from one would let anyone mint transactions under our code (or
// ours under someone else's). This matches SITE_URL in app/layout.tsx.
const PROD_HOSTNAME = 'nullstate-ten.vercel.app'

let serverCached: Hex | null = null

export function getServerAttributionSuffix(): Hex | undefined {
  if (serverCached) return serverCached
  try {
    serverCached = toDataSuffix(codeFromHostname(PROD_HOSTNAME)) as Hex
    return serverCached
  } catch {
    return undefined
  }
}
