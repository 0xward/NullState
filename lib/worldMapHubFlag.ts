'use client'

import { useEffect, useState } from 'react'

// Single source of truth for the world-map hub feature flag.
//
// Both GameFlowManager (which screen to render) and HowToPlayScreen (whether to
// document the map at all) read it from here, so the help text can never
// describe a screen the player isn't actually getting.
//
// OFF by default. Turn on per-device with `?hub=1` on the URL, or globally at
// build time with NEXT_PUBLIC_WORLDMAP_HUB=1.
export function readWorldMapHubFlag(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (new URLSearchParams(window.location.search).get('hub') === '1') return true
  } catch { /* malformed query string — fall through to the env check */ }
  return process.env.NEXT_PUBLIC_WORLDMAP_HUB === '1'
}

// Read after mount so server-rendered markup and the first client render agree
// (the URL check is browser-only, so evaluating it during SSR would mismatch).
export function useWorldMapHubFlag(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => { setOn(readWorldMapHubFlag()) }, [])
  return on
}
