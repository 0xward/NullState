'use client'

import { useEffect, useState } from 'react'

// ─── The Privy gate: temporary, off by default, and never for MiniPay ────────
//
// OWNER, 2026-08-02: *"aku lagi ikutan talent.app juga sebenernya, jadi untuk
// user non minipay, aku mau ada koneksi wallet barengan dengan login google …
// pake privy aja … tp ini hanya untuk user dan penjurian talent.app saja
// muncul nya … karena ini sementara saja."*
//
// Four properties, and every one of them is load-bearing:
//
//   1. OFF BY DEFAULT. This is scaffolding for a judging period, not a product
//      decision. A temporary thing that ships enabled is a temporary thing that
//      becomes permanent by forgetting.
//   2. NEVER INSIDE MINIPAY. MiniPay resolves an address with zero clicks and
//      its listing rules reject a screen between the player and the game. That
//      guarantee is enforced at the call site by the same `!isMiniPay` that
//      already gates the sign-in offer — this flag cannot switch it on.
//   3. REQUIRES AN APP ID. Privy cannot initialise without one, so a deployment
//      that sets the flag and forgets the id must fall back rather than render a
//      broken screen. `privyAppId()` returning null is treated as "off".
//   4. NOTHING IS RIPPED OUT. With the flag off, the existing Google/email
//      sign-in returns exactly as it was. Turning this off after the judging is
//      one environment variable, not a revert.
//
//   NEXT_PUBLIC_PRIVY_GATE=1   → on for this deployment
//   ?privy=1 / ?privy=0        → force on/off for one device, for testing
//
// Precedence is URL over env, matching lib/worldMapHubFlag.ts: the env var is
// the deployment-wide switch, the query param is how one person checks one
// device without changing what anyone else sees.

const ENV_ON = process.env.NEXT_PUBLIC_PRIVY_GATE === '1'

/** The Privy app id, or null when it is not configured. */
export function privyAppId(): string | null {
  const id = process.env.NEXT_PUBLIC_PRIVY_APP_ID
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

export function readPrivyGateFlag(): boolean {
  // No app id means Privy cannot initialise. Fall back rather than render a
  // login screen that can never log anyone in.
  if (!privyAppId()) return false
  if (typeof window !== 'undefined') {
    try {
      const q = new URLSearchParams(window.location.search).get('privy')
      if (q === '1') return true
      if (q === '0') return false
    } catch { /* malformed query string — fall through to the env default */ }
  }
  return ENV_ON
}

/**
 * Seeded FALSE rather than from the env, unlike the world-map flag.
 *
 * That module seeds from its env value because it is on by default and a
 * one-frame flip would show every player the wrong home screen. This one is off
 * by default and loads a heavy SDK, so the safe first render is the one that
 * loads nothing: the gate appears a frame later on the rare deployment that
 * enables it, and never flickers on the normal path.
 */
export function usePrivyGateFlag(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => { setOn(readPrivyGateFlag()) }, [])
  return on
}
