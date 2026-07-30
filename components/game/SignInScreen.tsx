'use client'

import { useState } from 'react'
// Its own stylesheet, not styles/game.css — that one blocks the world map's
// first paint and this screen is two taps away. See the header in signin.css.
import '@/styles/signin.css'

// ─── Save-your-progress screen ───────────────────────────────────────────────
// Sits between starting a run and SET USERNAME, for players who are not in
// MiniPay and have no wallet. It exists because until now those players were
// guests forever: progress lived in one browser's localStorage under a random
// id, so clearing site data — or opening the game on another phone — lost
// everything.
//
// THREE RULES, none of them cosmetic:
//
//  1. It is never rendered inside MiniPay. MiniPay's listing requirements are
//     explicit that connection there is zero-click, and a screen between the
//     player and the game is exactly the friction they reject. GameFlowManager
//     owns that check.
//
//  2. Skip is a real option and looks like one. A dismissable prompt that is
//     hard to dismiss is worse than no prompt. The choice is remembered, so
//     declining once means declining for good.
//
//  3. No button may say "Connect Wallet". check:copy rejects the phrase
//     anywhere under components/ and app/, because inside MiniPay it is always
//     the wrong prompt. "I already have a wallet" says the same thing to the
//     only people who need it.
//
// It is also honest about what an account is NOT. Signing in gives you a name
// and progress that follow you; it does not give you a wallet, so it cannot buy
// or claim. Saying so here is cheaper than a confused player discovering it at
// the Marketplace.

export type SignInMethod = 'google' | 'email' | 'wallet'

// Google's mark, inlined. It has to be the real four-colour G — a monochrome
// or recoloured version is off-guideline, and players recognise the actual one
// at a glance, which is the entire point of putting it here. Inline because a
// strict CSP blocks external images and this must never cost a request.
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  )
}

function MailMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false">
      <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
      <path d="M3 6.5 12 13l9-6.5" />
    </svg>
  )
}

function WalletMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v2" />
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <circle cx="16.5" cy="13.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

interface SignInScreenProps {
  onGoogle: () => Promise<void>
  onEmail: (email: string) => Promise<void>
  onWallet: () => void
  onSkip: () => void
  /** Shown after an email link is sent, so the player knows to go look. */
  emailSent?: string | null
}

export default function SignInScreen({
  onGoogle, onEmail, onWallet, onSkip, emailSent = null,
}: SignInScreenProps) {
  const [busy, setBusy] = useState<SignInMethod | null>(null)
  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const run = async (method: SignInMethod, fn: () => Promise<void>) => {
    setBusy(method)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const submitEmail = () => {
    const trimmed = email.trim()
    // Deliberately loose. The real check is whether the link arrives; a strict
    // pattern here only ever rejects addresses that would have worked.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError('That does not look like an email address.')
      return
    }
    run('email', () => onEmail(trimmed))
  }

  const disabled = busy !== null

  return (
    <div className="ns-signin-root">
      <div className="ns-signin-orb" aria-hidden="true" />

      <div className="ns-signin-panel">
        {/* Corner brackets, the same device the world map uses to mark a
            selected bunker. They are what stops this reading as a web form
            dropped into a game. */}
        <span className="ns-signin-frame" aria-hidden="true" />

        <div className="ns-signin-kicker">
          {/* Braced on purpose. The bare form — the way the other screens write
              their `//` kickers — trips react/jsx-no-comment-textnodes, which
              is where 34 of this repo's lint errors already come from. Same
              rendered output, one fewer thing on the pile. */}
          {'// SAVE YOUR PROGRESS'}
        </div>

        <h2 className="ns-signin-title">
          {emailSent ? 'CHECK YOUR INBOX' : 'KEEP YOUR RUN'}
        </h2>

        <p className="ns-signin-lede">
          {emailSent
            ? <>We sent a link to <span className="ns-signin-em">{emailSent}</span>. Open it and you are in.</>
            : <>Your run lives in this browser only. Sign in and it follows you anywhere.</>}
        </p>

        {!emailSent && (
          <div className="ns-signin-stack">
            <button
              onClick={() => run('google', onGoogle)}
              disabled={disabled}
              className="ns-signin-btn is-google"
            >
              <span className="ns-signin-ico"><GoogleMark /></span>
              <span>{busy === 'google' ? 'Opening…' : 'Continue with Google'}</span>
            </button>

            {showEmail ? (
              <div className="ns-signin-stack">
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitEmail() }}
                  placeholder="you@example.com"
                  disabled={disabled}
                  className="ns-signin-input"
                />
                <button onClick={submitEmail} disabled={disabled || !email.trim()} className="ns-signin-btn is-send">
                  <span className="ns-signin-ico"><MailMark /></span>
                  <span>{busy === 'email' ? 'Sending…' : 'Send me a link'}</span>
                </button>
              </div>
            ) : (
              <button onClick={() => setShowEmail(true)} disabled={disabled} className="ns-signin-btn">
                <span className="ns-signin-ico"><MailMark /></span>
                <span>Continue with email</span>
              </button>
            )}

            <button onClick={onWallet} disabled={disabled} className="ns-signin-btn">
              <span className="ns-signin-ico"><WalletMark /></span>
              <span>I already have a wallet</span>
            </button>
          </div>
        )}

        {error && <div className="ns-signin-error">{error}</div>}

        <button onClick={onSkip} disabled={disabled} className="ns-signin-skip">
          Skip for now →
        </button>

        <p className="ns-signin-foot">
          An account saves your name and progress. Buying items and claiming
          rewards needs a wallet — you can add one later.
        </p>
      </div>
    </div>
  )
}
