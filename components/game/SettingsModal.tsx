'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { PlayerProfile } from '@/lib/contract'
import { usernameSchema } from '@/lib/validation'
import { usePassSBT } from '@/hooks/usePassSBT'

interface SessionStats {
  depth: number
  kills: number
}

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  /** the raw address is NOT rendered (v75 MiniPay compliance removed it), but
      it IS used to read the wallet's Season Pass status (TASK #7) shown below. */
  address?: string | null
  playerProfile: PlayerProfile | null
  sessionStats: SessionStats | null
  soundMuted: boolean
  onToggleSound: () => void
  musicVolume: number
  onMusicVolumeChange: (value: number) => void
  sfxEnabled: boolean
  onToggleSfx: () => void
  screenShakeEnabled: boolean
  onToggleScreenShake: () => void
  onSaveGame: () => Promise<boolean>
  setPlayerUsername: (username: string) => Promise<{ success: boolean; username: string }>
  /** HUD redesign (owner): Exit moved out of the top-left corner into Settings,
      directly under Save Game. Triggers the same save-before-exit flow the old
      "◂ EXIT" button did (opens the exit-confirm dialog). */
  onExit: () => void
}

export default function SettingsModal({
  open,
  onClose,
  address,
  playerProfile,
  sessionStats,
  soundMuted,
  onToggleSound,
  musicVolume,
  onMusicVolumeChange,
  sfxEnabled,
  onToggleSfx,
  screenShakeEnabled,
  onToggleScreenShake,
  onSaveGame,
  setPlayerUsername,
  onExit,
}: SettingsModalProps) {
  const [usernameInput, setUsernameInput] = useState(playerProfile?.username || '')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // TASK #7 (owner request): the pass badge is NOT shown on the in-game HUD.
  // Instead a connected wallet that has minted the active-season pass sees a
  // "Season N Pass — Active" line here in Settings. hasPass is read on-chain
  // (true only for the currently-active season) and passSeasonId is the minted
  // season id (e.g. 202607 = July 2026 = Season 1); the season program runs
  // Jul–Dec 2026, so season number = (month - 6).
  const { hasPass, passSeasonId, isLoading: passLoading } = usePassSBT(address ?? undefined)
  const passSeasonNumber = (() => {
    const month = Number(passSeasonId) % 100
    const n = month - 6
    return n >= 1 && n <= 6 ? n : null
  })()

  useEffect(() => {
    if (open) {
      setUsernameInput(playerProfile?.username || '')
      setUsernameStatus('idle')
      setSaveStatus('idle')
    }
  }, [open, playerProfile?.username])

  if (!open) return null

  const handleUsernameSave = async () => {
    if (!usernameInput.trim() || usernameInput === playerProfile?.username) return
    setUsernameStatus('saving')
    setUsernameError(null)
    try {
      const parsedUsername = usernameSchema.parse(usernameInput)
      await setPlayerUsername(parsedUsername)
      setUsernameStatus('saved')
    } catch (err) {
      setUsernameStatus('error')
      setUsernameError(err instanceof Error ? err.message : 'Failed to update username')
    }
  }

  const handleSave = async () => {
    setSaveStatus('saving')
    const ok = await onSaveGame()
    setSaveStatus(ok ? 'saved' : 'error')
  }

  return (
    <div className="ns-settings-overlay" role="dialog" aria-label="Settings">
      <div className="ns-settings-panel">
        <div className="ns-settings-header">
          <Image
            src="/NullState_Logo_Transparent.webp"
            alt="NullState"
            width={106}
            height={26}
            className="ns-settings-logo-corner"
          />

          <button className="ns-settings-close" onClick={onClose} aria-label="Close settings">
            [CLOSED]
          </button>
        </div>

        {/* Progress panel removed (owner: it duplicates the in-game HUD, which
            already shows Level / XP / Floor / Kills live). */}

        {/* Season Pass status (TASK #7) — shown here in Settings instead of on
            the HUD. A connected wallet that has minted the active season's pass
            sees a green "Season N Pass — Active" line; otherwise a muted note. */}
        <div className="ns-settings-section">
          <div className="ns-settings-label">Season Pass</div>
          {!address ? (
            <p className="ns-settings-hint" style={{ marginTop: 6 }}>
              Connect a wallet to mint a Season Pass.
            </p>
          ) : passLoading ? (
            <p className="ns-settings-hint" style={{ marginTop: 6 }}>Checking pass…</p>
          ) : hasPass ? (
            <div
              style={{
                marginTop: 6,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'monospace',
                fontSize: 13,
                letterSpacing: 0.5,
                color: '#00ff88',
                border: '1px solid rgba(0,255,136,0.5)',
                background: 'rgba(0,255,136,0.08)',
                padding: '6px 10px',
                borderRadius: 4,
                textShadow: '0 0 6px rgba(0,255,136,0.6)',
              }}
            >
              ◆ Season {passSeasonNumber ?? passSeasonId.toString()} Pass — Active
            </div>
          ) : (
            <p className="ns-settings-hint" style={{ marginTop: 6 }}>
              No active Season Pass. Mint one from the Season Pass screen to unlock
              perks.
            </p>
          )}
        </div>

        {/* Save Game */}
        <div className="ns-settings-section">
          <div className="ns-settings-label">Save Game</div>
          <p className="ns-settings-hint">
            Saves your current floor and inventory so you can continue from this
            exact bunker next time. This does not record kills or XP on-chain —
            that only happens when your character dies.
          </p>
          <button
            className="ns-settings-btn-primary"
            onClick={handleSave}
            disabled={!sessionStats || saveStatus === 'saving'}
          >
            {saveStatus === 'saving'
              ? 'Saving…'
              : saveStatus === 'saved'
              ? '✓ Saved'
              : saveStatus === 'error'
              ? 'Failed — try again'
              : 'Save Game'}
          </button>
          {!sessionStats && (
            <p className="ns-settings-hint" style={{ marginTop: 6 }}>
              Nothing to save right now — you&apos;re not inside a bunker.
            </p>
          )}

          {/* Exit — moved here from the old top-left "◂ EXIT" button. Same
              chunky primary style as Save Game (owner spec). Opens the
              save-before-exit dialog so a run is never lost by accident. */}
          <button
            className="ns-settings-btn-primary"
            style={{ marginTop: 10 }}
            onClick={onExit}
          >
            ◂ Exit to Home
          </button>
        </div>

        {/* Wallet + Username */}
        <div className="ns-settings-section">
          {/* v75 MiniPay compliance: raw wallet address removed from
              Settings entirely (user decision) — no address shown here. */}
          <div className="ns-settings-label">
            Username
          </div>
          <div className="ns-settings-username-row">
            <input
              className="ns-settings-input"
              value={usernameInput}
              maxLength={32}
              onChange={e => {
                setUsernameInput(e.target.value)
                setUsernameStatus('idle')
              }}
              placeholder="Enter a username"
            />
            <button
              className="ns-settings-btn-secondary"
              onClick={handleUsernameSave}
              disabled={
                usernameStatus === 'saving' ||
                !usernameInput.trim() ||
                usernameInput === playerProfile?.username
              }
            >
              {usernameStatus === 'saving' ? 'Saving…' : 'Save'}
            </button>
          </div>
          {usernameStatus === 'saved' && (
            <p className="ns-settings-success">Username updated.</p>
          )}
          {usernameStatus === 'error' && (
            <p className="ns-settings-error">{usernameError}</p>
          )}
        </div>

        {/* Sound */}
        <div className="ns-settings-section">
          <div className="ns-settings-row">
            <div className="ns-settings-label">Volume</div>
            <span className="ns-settings-volume-value">{Math.round(musicVolume * 100)}%</span>
          </div>
          <input
            type="range"
            className="ns-settings-slider"
            min={0}
            max={100}
            step={1}
            value={Math.round(musicVolume * 100)}
            disabled={soundMuted}
            onChange={e => onMusicVolumeChange(Number(e.target.value) / 100)}
            aria-label="Music volume"
          />

          <div className="ns-settings-row" style={{ marginTop: 18 }}>
            <div className="ns-settings-label">Sound</div>
            <button
              className={`ns-settings-toggle-switch ${!soundMuted ? 'is-on' : ''}`}
              onClick={onToggleSound}
              role="switch"
              aria-checked={!soundMuted}
              aria-label="Toggle sound"
            >
              <span className="ns-settings-toggle-knob" />
            </button>
          </div>

          <div className="ns-settings-row" style={{ marginTop: 16 }}>
            <div className="ns-settings-label">SFX</div>
            <button
              className={`ns-settings-toggle-switch ${sfxEnabled ? 'is-on' : ''}`}
              onClick={onToggleSfx}
              role="switch"
              aria-checked={sfxEnabled}
              aria-label="Toggle SFX"
            >
              <span className="ns-settings-toggle-knob" />
            </button>
          </div>

          {/* Screen Shake toggle — punch list #10 (v38). Accessibility option
              for players sensitive to the camera shake on hits/kills/NULL_STRIKE;
              doesn't touch hit-stop, knockback, or particle FX, just the
              camera-offset wobble itself (see render() in game.js). */}
          <div className="ns-settings-row" style={{ marginTop: 16 }}>
            <div className="ns-settings-label">Screen Shake</div>
            <button
              className={`ns-settings-toggle-switch ${screenShakeEnabled ? 'is-on' : ''}`}
              onClick={onToggleScreenShake}
              role="switch"
              aria-checked={screenShakeEnabled}
              aria-label="Toggle screen shake"
            >
              <span className="ns-settings-toggle-knob" />
            </button>
          </div>
        </div>

        {/* Links */}
        <div className="ns-settings-section ns-settings-links">
          <a
            href="mailto:0xward.dev@gmail.com?subject=NullState%20Feedback"
            className="ns-settings-link ns-settings-feedback-link"
          >
            Feedback &amp; Suggestions
          </a>

          {/*
            Support / Terms / Privacy — required by MiniPay's Mini App
            submission checklist to be reachable from *inside* the app, not
            just the marketing landing page (/game never renders Footer.tsx).
            This is the one place every player can reach via the Settings
            button regardless of where they entered the app.
          */}
          <div className="ns-settings-legal-row">
            <a
              href="https://t.me/nullstate_id"
              rel="noopener noreferrer"
              className="ns-settings-link"
            >
              Support
            </a>
            <span className="ns-settings-legal-sep" aria-hidden="true">·</span>
            <a href="/terms" className="ns-settings-link">
              Terms
            </a>
            <span className="ns-settings-legal-sep" aria-hidden="true">·</span>
            <a href="/privacy" className="ns-settings-link">
              Privacy
            </a>
          </div>

          <div className="ns-settings-footer-logos">
            <a
              href="https://github.com/0xward/NullState"
              rel="noopener noreferrer"
              aria-label="GitHub Repository"
              className="ns-settings-footer-logo-link"
            >
              <Image src="/footer-logos/github.png" alt="GitHub" width={26} height={26} />
            </a>
            <a
              href="https://celoscan.io/address/0xe6c471dd3c715db8b10457113867885afa12ec13"
              rel="noopener noreferrer"
              aria-label="Celoscan"
              className="ns-settings-footer-logo-link"
            >
              <Image src="/footer-logos/celoscan.png" alt="Celoscan" width={26} height={26} />
            </a>
            <a
              href="https://talent.app/~/projects/86c0509c-3167-46cd-8a58-36bb9c5b9777"
              rel="noopener noreferrer"
              aria-label="Talent Protocol"
              className="ns-settings-footer-logo-link"
            >
              <Image src="/footer-logos/talent-protocol.jpg" alt="Talent Protocol" width={26} height={26} />
            </a>
            <a
              href="https://www.minipay.xyz"
              rel="noopener noreferrer"
              aria-label="MiniPay"
              className="ns-settings-footer-logo-link"
            >
              <Image src="/footer-logos/minipay.png" alt="MiniPay" width={26} height={26} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
