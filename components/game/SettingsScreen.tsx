'use client'

import { useEffect, useState } from 'react'
import { useWallet } from '@/lib/WalletProvider'
import { maskAddress } from '@/lib/addressMask'
import { PlayerProfile } from '@/lib/contract'
import { usernameSchema } from '@/lib/validation'
import { loadGameSettings, saveGameSettings, type GameSettings } from '@/lib/gameSettings'
import { setMusicVolume, setSfxEnabled, setSoundMuted, startAudio } from '@/lib/audioControl'

// ─── Settings, from the map ──────────────────────────────────────────────────
// The in-run SettingsModal can't be reused here. Half of it is run state — Save
// Game, Exit, session stats, and audio toggles that talk to a mounted engine —
// and none of that exists on the map.
//
// So this screen carries only what is true outside a run: the preferences
// themselves (now persisted, see lib/gameSettings), the player's name, and the
// links MiniPay requires. Changes land in the same storage the run reads at
// mount, so setting the volume here is what the next bunker starts with.
//
// Styled to the map, not to the old modal: the in-game one is a light
// "bone-white paper" panel from an earlier art direction, which is exactly the
// mismatch this screen exists to stop repeating.

interface SettingsScreenProps {
  onBack: () => void
  playerProfile: PlayerProfile | null
  setPlayerUsername: (username: string) => Promise<{ success: boolean; username: string }>
}

function Toggle({ on, onClick, label, hint }: { on: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="min-w-0">
        <span className="block font-mono text-[12px]" style={{ color: '#e8fff4' }}>{label}</span>
        {hint && <span className="block font-mono text-[9px] leading-relaxed" style={{ color: '#4e6b5e' }}>{hint}</span>}
      </span>
      <button
        onClick={onClick}
        role="switch"
        aria-checked={on}
        aria-label={label}
        className="relative flex-shrink-0"
        style={{
          width: 52, height: 30, minHeight: 30, padding: 0, cursor: 'pointer',
          background: on ? '#14b869' : 'rgba(255,255,255,.12)',
          border: `2px solid ${on ? '#39ff9a' : 'rgba(255,255,255,.18)'}`,
          clipPath: 'polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)',
          transition: 'background-color .15s ease',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', top: 3, left: 3, width: 18, height: 18,
            background: on ? '#04140c' : '#8ea89d',
            transform: on ? 'translateX(22px)' : 'translateX(0)',
            transition: 'transform .15s ease',
          }}
        />
      </button>
    </div>
  )
}

export default function SettingsScreen({ onBack, playerProfile, setPlayerUsername }: SettingsScreenProps) {
  const { realAddress, isGuest } = useWallet()
  const [s, setS] = useState<GameSettings | null>(null)
  const [name, setName] = useState(playerProfile?.username || '')
  const [nameState, setNameState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [nameError, setNameError] = useState<string | null>(null)

  // Read after mount — localStorage is browser-only, and seeding state from it
  // during render would disagree with the server-rendered markup.
  useEffect(() => { setS(loadGameSettings()) }, [])

  // Each control goes through lib/audioControl, which stores the preference AND
  // pushes it into the running engine. The first version of this screen only
  // wrote to storage, so moving the volume slider on the map changed nothing
  // you could hear until the next run started.
  const onMute = (muted: boolean) => { startAudio(); setS(setSoundMuted(muted)) }
  const onSfx = (enabled: boolean) => { startAudio(); setS(setSfxEnabled(enabled)) }
  const onVolume = (v: number) => { startAudio(); setS(setMusicVolume(v)) }

  const submitName = async () => {
    const wanted = name.trim()
    if (!wanted || wanted === playerProfile?.username) return
    setNameState('saving'); setNameError(null)
    try {
      await setPlayerUsername(usernameSchema.parse(wanted))
      setNameState('saved')
    } catch (err) {
      setNameState('error')
      setNameError(err instanceof Error ? err.message : 'Could not change your name')
    }
  }

  const linkStyle: React.CSSProperties = {
    minHeight: 44, padding: '0 10px', fontSize: 10, letterSpacing: '2px',
    color: '#8ea89d', display: 'inline-flex', alignItems: 'center', textDecoration: 'none',
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: 'rgba(5,10,8,.975)' }}>
      <div className="mx-auto w-full max-w-lg p-4 pb-16">

        <header className="mb-5 flex items-center justify-between border-b pb-3" style={{ borderColor: 'rgba(57,255,154,.22)' }}>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[4px]" style={{ color: '#4e8f74' }}>{'// NullState'}</p>
            <h1 className="font-mono text-2xl font-bold" style={{ color: '#8ef5bd' }}>SETTINGS</h1>
          </div>
          <button
            onClick={onBack}
            className="rounded border px-3 py-2 font-mono text-xs uppercase tracking-wider"
            style={{ minHeight: 44, borderColor: '#2f6b50', color: '#8ea89d' }}
          >
            ◂ Map
          </button>
        </header>

        {/* ── Audio & feel ── */}
        <section className="mb-5 rounded-lg border p-3" style={{ borderColor: 'rgba(57,255,154,.18)', background: 'rgba(10,24,18,.6)' }}>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[2px]" style={{ color: '#5f8d78' }}>Sound &amp; feel</p>
          {!s ? (
            <p className="py-4 font-mono text-[11px] animate-pulse" style={{ color: '#5f8d78' }}>loading…</p>
          ) : (
            <>
              <Toggle
                label="Sound" on={!s.soundMuted}
                onClick={() => onMute(!s.soundMuted)}
                hint="The master switch — music and effects"
              />
              <div className="py-2.5" style={{ opacity: s.soundMuted ? 0.4 : 1 }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px]" style={{ color: '#e8fff4' }}>Music volume</span>
                  <span className="font-mono text-[11px] font-bold" style={{ color: '#39ff9a' }}>{Math.round(s.musicVolume * 100)}%</span>
                </div>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={s.musicVolume}
                  disabled={s.soundMuted}
                  onChange={e => onVolume(Number(e.target.value))}
                  aria-label="Music volume"
                  className="mt-2 w-full"
                  style={{ accentColor: '#39ff9a', touchAction: 'pan-x' }}
                />
              </div>
              {/* Dimmed while the master switch is off, because effects cannot
                  be heard then whatever this says. The preference is still
                  remembered, so unmuting restores what the player chose rather
                  than silently switching effects back on. */}
              <div style={{ opacity: s.soundMuted ? 0.4 : 1 }}>
                <Toggle
                  label="Sound effects" on={s.sfxEnabled}
                  onClick={() => onSfx(!s.sfxEnabled)}
                  hint="Hits, pickups, menu taps"
                />
              </div>
              <Toggle
                label="Screen shake" on={s.screenShakeEnabled}
                onClick={() => setS(saveGameSettings({ screenShakeEnabled: !s.screenShakeEnabled }))}
                hint="Turn off if the camera movement bothers you"
              />
              <p className="mt-2 font-mono text-[9px] leading-relaxed" style={{ color: '#4e6b5e' }}>
                Saved on this device and used by every run from now on.
              </p>
            </>
          )}
        </section>

        {/* ── Name ── */}
        <section className="mb-5 rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,.1)', background: 'rgba(10,24,18,.5)' }}>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[2px]" style={{ color: '#5f8d78' }}>Your name</p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={e => { setName(e.target.value); setNameState('idle') }}
              maxLength={24}
              aria-label="Your name"
              className="min-w-0 flex-1 px-3 font-mono text-[13px]"
              style={{ minHeight: 44, background: 'rgba(0,0,0,.4)', border: '1px solid #2f6b50', color: '#e8fff4' }}
            />
            <button
              onClick={submitName}
              disabled={nameState === 'saving' || !name.trim() || name.trim() === playerProfile?.username}
              className="font-mono text-[11px] font-bold uppercase tracking-[2px] disabled:opacity-40"
              style={{ minHeight: 44, padding: '0 16px', color: '#04140c', background: '#39ff9a', border: '2px solid #0a3d24' }}
            >
              {nameState === 'saving' ? '…' : 'Save'}
            </button>
          </div>
          {nameState === 'saved' && <p className="mt-2 font-mono text-[10px]" style={{ color: '#39ff9a' }}>✓ Saved</p>}
          {nameState === 'error' && <p className="mt-2 font-mono text-[10px]" style={{ color: '#ff8a6a' }}>{nameError}</p>}
        </section>

        {/* ── Account + the links MiniPay requires ── */}
        <section className="rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,.1)', background: 'rgba(10,24,18,.5)' }}>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[2px]" style={{ color: '#5f8d78' }}>Account</p>
          <p className="font-mono text-[11px]" style={{ color: '#cfe9dc' }}>
            {realAddress ? maskAddress(realAddress) : 'Guest Mode'}
          </p>
          {isGuest && (
            <p className="mt-1 font-mono text-[9px] leading-relaxed" style={{ color: '#4e6b5e' }}>
              Your progress is saved to this device. Connect a wallet to keep it if you reinstall.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1 border-t pt-2" style={{ borderColor: 'rgba(255,255,255,.08)' }}>
            <a href="https://t.me/nullstate_id" rel="noopener noreferrer" className="font-mono uppercase" style={linkStyle}>Support</a>
            <span aria-hidden="true" style={{ color: 'rgba(255,255,255,.25)' }}>·</span>
            <a href="/terms" className="font-mono uppercase" style={linkStyle}>Terms</a>
            <span aria-hidden="true" style={{ color: 'rgba(255,255,255,.25)' }}>·</span>
            <a href="/privacy" className="font-mono uppercase" style={linkStyle}>Privacy</a>
          </div>
        </section>
      </div>
    </div>
  )
}
