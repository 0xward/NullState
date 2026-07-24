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
