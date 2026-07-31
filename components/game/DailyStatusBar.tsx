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
// Every chip here is backed by a system that actually tracks the number it
// shows — rule 2 in GAME-DESIGN.md §10, and the reason each one arrived on the
// day its feature did rather than as a placeholder.
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
  const [contracts, setContracts] = useState<{ done: number; total: number } | null>(null)
  const [contractList, setContractList] = useState<
    { id: string; label: string; progress: number; target: number; done: boolean }[]
  >([])
  const [streak, setStreak] = useState<{ streak: number; day: number; best: number; tomorrow: string } | null>(null)
  // Shown once, on the visit that actually earned it. A reward the player is
  // never told about is a reward that does not retain anyone.
  const [streakGrant, setStreakGrant] = useState<string | null>(null)
  const [showContracts, setShowContracts] = useState(false)
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
    // The streak is a POST because opening the app IS the event it records —
    // there is nothing to tap and no claim step, matching the decision Daily
    // Contracts already made. It is idempotent per UTC day, so a remount or a
    // second tab costs nothing.
    const streakReq = fetch('/api/streak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address }),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null)

    Promise.all([
      j(`/api/energy?wallet=${encodeURIComponent(address)}`),
      j(`/api/vault/fragments?wallet=${encodeURIComponent(address)}`),
      j(`/api/weapons/craft?wallet=${encodeURIComponent(address)}`),
      j(`/api/contracts?wallet=${encodeURIComponent(address)}`),
      streakReq,
    ]).then(([e, f, c, d, s]) => {
      if (!alive) return
      if (e && typeof e.total === 'number') setEnergy({ total: e.total, free: e.freeRemaining ?? 0 })
      if (f && typeof f.fragments === 'number' && f.nextGoal) {
        setFrag({ have: Math.min(f.fragments, f.nextGoal.threshold), goal: f.nextGoal.threshold, label: f.nextGoal.label })
      }
      if (d && Array.isArray(d.contracts) && d.contracts.length) {
        setContracts({ done: d.completed ?? 0, total: d.contracts.length })
        setContractList(d.contracts)
      }
      if (s && typeof s.streak === 'number' && s.streak > 0) {
        const label = (r: { kind?: string; amount?: number; tier?: string } | null | undefined) =>
          !r ? '' : r.kind === 'point' ? `+${r.amount} Point`
            : r.kind === 'shard' ? `+${r.amount} Shard ${String(r.tier || '').toUpperCase()}`
            : `+${r.amount} energy`
        setStreak({ streak: s.streak, day: s.day ?? 1, best: s.best ?? s.streak, tomorrow: label(s.tomorrow) })
        // The energy chip is fetched in the same breath as this, so a streak
        // that just paid energy would otherwise show yesterday's number until
        // the next mount.
        if (s.granted?.kind === 'energy' && e && typeof e.total === 'number') {
          setEnergy({ total: e.total + (s.granted.amount || 0), free: e.freeRemaining ?? 0 })
        }
        if (s.grantedLabel) setStreakGrant(s.grantedLabel)
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

  // The map's DAILY rail button opens this list too — it used to be a "SOON"
  // placeholder for a feature that now exists.
  useEffect(() => {
    const open = () => setShowContracts(true)
    window.addEventListener('nullstate-open-contracts', open)
    return () => window.removeEventListener('nullstate-open-contracts', open)
  }, [])

  useEffect(() => {
    if (craftDoneAt === null) return
    const id = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [craftDoneAt])

  const chips: Chip[] = []

  // First, and always visible once it exists. This is the one number on the bar
  // the player can LOSE, and loss aversion only works if the thing at risk is
  // in front of them — a streak they have to go looking for is not at stake.
  if (streak) {
    const last = streak.day === 7
    chips.push({
      key: 'streak',
      icon: last ? '★' : '🔥',
      label: `${streak.streak}`,
      tone: last ? 'ready' : 'amber',
      title: last
        ? `Day 7 — the big one. Come back tomorrow and the ladder starts again. Best: ${streak.best} days`
        : `${streak.streak}-day streak · tomorrow: ${streak.tomorrow}. Miss a day and it goes back to 1. Best: ${streak.best} days`,
    })
  }

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

  // Ahead of fragments, because it is the one that resets tonight. A player
  // with an hour to spare should see the perishable thing first.
  if (contracts) {
    const all = contracts.done >= contracts.total
    chips.push({
      key: 'contracts',
      icon: all ? '✓' : '◇',
      label: `${contracts.done}/${contracts.total}`,
      tone: all ? 'ready' : 'green',
      // A count with no way to see what is being counted is a tease. Tapping
      // opens the list right here rather than sending the player to a screen —
      // three lines of text do not need a route.
      onClick: () => { playUiSound('panel'); setShowContracts((v) => !v) },
      title: all
        ? "Today's contracts are all done — new ones at 00:00 UTC"
        : `${contracts.total - contracts.done} of today's contracts still open`,
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
    <>
      {streakGrant && streak && (
        <button
          type="button"
          className="ns-hub-streak-note"
          onClick={() => { playUiSound('panel'); setStreakGrant(null) }}
          aria-label={`Day ${streak.day} streak reward: ${streakGrant}. Tap to dismiss.`}
        >
          <span aria-hidden="true">🔥</span> Day {streak.day} · {streakGrant}
        </button>
      )}
      {showContracts && contractList.length > 0 && (
        <div className="ns-hub-contracts" role="region" aria-label="Today's contracts">
          <p className="ns-hub-contracts-head">Today · resets 00:00 UTC</p>
          {contractList.map((c) => (
            <div key={c.id} className={`ns-hub-contract${c.done ? ' is-done' : ''}`}>
              <span className="ns-hub-contract-label">{c.done ? '✓ ' : ''}{c.label}</span>
              <span className="ns-hub-contract-count">{Math.min(c.progress, c.target)}/{c.target}</span>
            </div>
          ))}
        </div>
      )}
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
    </>
  )
}
