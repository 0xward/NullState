'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { PlayerProfile } from '@/lib/contract'
import { usernameSchema } from '@/lib/validation'

interface SessionStats {
  depth: number
  kills: number
}

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  address: string | null
  playerProfile: PlayerProfile | null
  sessionStats: SessionStats | null
  soundMuted: boolean
  onToggleSound: () => void
  musicVolume: number
  onMusicVolumeChange: (value: number) => void
  sfxEnabled: boolean
  onToggleSfx: () => void
  onSaveGame: () => Promise<boolean>
  setPlayerUsername: (username: string) => Promise<{ success: boolean; username: string }>
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
  onSaveGame,
  setPlayerUsername,
}: SettingsModalProps) {
  const [usernameInput, setUsernameInput] = useState(playerProfile?.username || '')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

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
            src="/NullState_Logo_Transparent.png"
            alt="NullState"
            width={106}
            height={26}
            className="ns-settings-logo-corner"
          />

          <button className="ns-settings-close" onClick={onClose} aria-label="Close settings">
            [CLOSED]
          </button>
        </div>

        {/* Progress */}
        <div className="ns-settings-section">
          <div className="ns-settings-label">Progress</div>
          <div className="ns-settings-progress-grid">
            <div className="ns-settings-stat">
              <span className="v">{playerProfile?.level ?? '—'}</span>
              <span className="k">Level (on-chain)</span>
            </div>
            <div className="ns-settings-stat">
              <span className="v">{playerProfile?.xp ?? '—'}</span>
              <span className="k">XP (on-chain)</span>
            </div>
            <div className="ns-settings-stat">
              <span className="v">{sessionStats?.depth ?? '—'}</span>
              <span className="k">Floor (this run)</span>
            </div>
            <div className="ns-settings-stat">
              <span className="v">{sessionStats?.kills ?? '—'}</span>
              <span className="k">Kills (this run)</span>
            </div>
          </div>
          <p className="ns-settings-hint">
            On-chain stats update only when your character dies. Floor and kills for
            this run aren&apos;t recorded on-chain yet.
          </p>
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
        </div>

        {/* Wallet + Username */}
        <div className="ns-settings-section">
          <div className="ns-settings-label">Wallet</div>
          <p className="ns-settings-wallet">{address || 'Not connected'}</p>

          <div className="ns-settings-label" style={{ marginTop: 14 }}>
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
        </div>

        {/* Links */}
        <div className="ns-settings-section ns-settings-links">
          <a
            href="mailto:0xward.dev@gmail.com?subject=NullState%20Feedback"
            className="ns-settings-link ns-settings-feedback-link"
          >
            Feedback &amp; Suggestions
          </a>

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
          </div>
        </div>
      </div>
    </div>
  )
}
