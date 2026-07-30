'use client'

import { useEffect, useState } from 'react'
import { playUiSound } from '@/lib/uiSound'

// ─── The five-second answer to "why am I here today?" ────────────────────────
//
// GAME-DESIGN.md §5.5. Opening the app has to show, immediately and without a
// tap, what is worth doing right now. Until this existed the map showed where
// the player had BEEN — bunkers, ✓ marks, a level — and nothing about what the
// day was offering. A player who has to go looking for a reason to play does
// not go looking.
//
// It sits directly above the ENTER button on purpose: that is the path the eye
// already takes on the way to the only action on the screen, so it is read
// rather than discovered.
//
// WHAT IS DELIBERATELY NOT HERE. Daily contracts and the login streak are in
// the build order but not built, so there is no chip for them. A placeholder
// that shows a number nobody is tracking is how game-config.ts happened — see
// rule 2 in GAME-DESIGN.md §10. Chips appear when their system does.
//
// Each chip hides itself when it has nothing true to say: no craft running, no
// fragments left to earn, energy not yet loaded. With all three quiet the bar
// renders nothing at all rather than an empty frame.

interface DailyStatusBarProps {
  /** Wallet or guest id. Nothing is fetched without one. */
  address: string | null | undefined
  /** Tapping the craft chip is how a finished weapon gets collected. */
  onCrafting: () => void
}

interface Chip {
  key: string
  icon: string
  label: string
  tone: 'green' | 'amber' | 'ready'
  onClick?: () => void
  title: string
}

function formatLeft(ms: number): string {
  if (ms <= 0) return 'READY'
  const mins = Math.ceil(ms / 60000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export default function DailyStatusBar({ address, onCrafting }: DailyStatusBarProps) {
  const [energy, setEnergy] = useState<{ total: number; free: number } | null>(null)
  const [frag, setFrag] = useState<{ have: number; goal: number; label: string } | null>(null)
  const [craftDoneAt, setCraftDoneAt] = useState<number | null>(null)
  // Drives the countdown. Cheap: one re-render every 30s, and only while a
  // craft is actually running (see the effect's guard).
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!address) return
    let alive = true
    const j = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null)

    // All three in parallel, all after first paint, none blocking the map.
    // Every one of them degrades to "chip hidden" rather than an error state —
    // a status bar that can show an error is a status bar that can make the
    // home screen look broken.
    Promise.all([
      j(`/api/energy?wallet=${encodeURIComponent(address)}`),
      j(`/api/vault/fragments?wallet=${encodeURIComponent(address)}`),
      j(`/api/weapons/craft?wallet=${encodeURIComponent(address)}`),
    ]).then(([e, f, c]) => {
      if (!alive) return
      if (e && typeof e.total === 'number') setEnergy({ total: e.total, free: e.freeRemaining ?? 0 })
      if (f && typeof f.fragments === 'number' && f.nextGoal) {
        setFrag({ have: Math.min(f.fragments, f.nextGoal.threshold), goal: f.nextGoal.threshold, label: f.nextGoal.label })
      }
      if (c?.craft?.completesAt) {
        // Correct for client clock skew — the server's own clock is the one the
        // craft timer is measured against.
        const skew = typeof c.serverNow === 'number' ? Date.now() - c.serverNow : 0
        setCraftDoneAt(c.craft.completesAt + skew)
      }
    })

    return () => { alive = false }
  }, [address])

  useEffect(() => {
    if (craftDoneAt === null) return
    const id = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [craftDoneAt])

  const chips: Chip[] = []

  if (craftDoneAt !== null) {
    const left = craftDoneAt - now
    chips.push({
      key: 'craft',
      icon: left <= 0 ? '✦' : '⏳',
      label: left <= 0 ? 'WEAPON READY' : formatLeft(left),
      tone: left <= 0 ? 'ready' : 'amber',
      onClick: () => { playUiSound('panel'); onCrafting() },
      title: left <= 0 ? 'Your weapon has finished evolving — tap to collect it' : 'Weapon evolving — tap to see the craft',
    })
  }

  if (frag) {
    chips.push({
      key: 'frag',
      icon: '◈',
      label: `${frag.have}/${frag.goal}`,
      tone: 'green',
      title: `Vault fragments toward the ${frag.label}. Open lockable containers to earn them.`,
    })
  }

  if (energy) {
    chips.push({
      key: 'energy',
      icon: '⚡',
      label: `${energy.total}`,
      tone: energy.total > 0 ? 'green' : 'amber',
      title: energy.total > 0
        ? `${energy.total} run${energy.total === 1 ? '' : 's'} left (${energy.free} free today)`
        : 'Out of runs — the free allowance refills every 24h',
    })
  }

  if (!chips.length) return null

  return (
    <div className="ns-hub-daily" role="status" aria-label="Today">
      {chips.map((c) => {
        const inner = (
          <>
            <span aria-hidden="true" className="ns-hub-daily-ico">{c.icon}</span>
            <span>{c.label}</span>
          </>
        )
        return c.onClick ? (
          <button key={c.key} type="button" onClick={c.onClick} title={c.title} aria-label={c.title}
            className={`ns-hub-chip is-${c.tone} is-tappable`}>{inner}</button>
        ) : (
          <span key={c.key} title={c.title} aria-label={c.title}
            className={`ns-hub-chip is-${c.tone}`}>{inner}</span>
        )
      })}
    </div>
  )
}
