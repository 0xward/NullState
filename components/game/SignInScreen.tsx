'use client'

import { useState } from 'react'
// Its own stylesheet, not styles/game.css — that one blocks the world map's
// first paint and this screen is two taps away. See the header in signin.css.
import '@/styles/signin.css'

// ─── Save-your-progress screen ───────────────────────────────────────────────
// Sits between "Play Game" and SET USERNAME, for players who are not in MiniPay
// and have no wallet. It exists because until now those players were guests
// forever: progress lived in one browser's localStorage under a random id, and
// clearing site data — or opening the game on another phone — lost everything.
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
//     declining once means declining for good (see rememberSignInSkipped).
//
//  3. No button may say "Connect Wallet". check:copy rejects the phrase
//     anywhere under components/ and app/, because inside MiniPay it is always
//     the wrong prompt — and a label that has to be special-cased per surface
//     is a label worth not having. "I already have a wallet" says the same
//     thing to the only people who need it.
//
// It is also honest about what an account is NOT. Signing in gives you a name
// and progress that follow you; it does not give you a wallet, so it cannot buy
// or claim. Saying so here is cheaper than a confused player discovering it at
// the Marketplace.

export type SignInMethod = 'google' | 'email' | 'wallet'

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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[rgba(0,0,0,0.95)] p-6">
      <div
        className="absolute pointer-events-none"
        style={{
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,255,136,0.1) 0%, rgba(0,170,255,0.03) 40%, transparent 70%)',
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        }}
      />

      <div className="relative z-10 max-w-md w-full text-center">
        <div className="font-mono text-[11px] tracking-[6px] text-null-green uppercase mb-6">
          {/* Braced on purpose. The bare form — the way the other screens write
              their `//` kickers — trips react/jsx-no-comment-textnodes, which
              is where 34 of this repo's lint errors already come from. Same
              rendered output, one fewer thing on the pile. */}
          {'// SAVE YOUR PROGRESS'}
        </div>

        <h2 className="font-display font-black text-null-white mb-2" style={{ fontSize: 40 }}>
          KEEP YOUR RUN
        </h2>

        <p className="text-null-muted text-sm mb-8 leading-relaxed">
          {emailSent
            ? <>Check <span className="text-null-green">{emailSent}</span> and open the link to finish. You can close this and come back.</>
            : <>Play now and keep your progress on any device. It is free and takes a second.</>}
        </p>

        {!emailSent && (
          <div className="space-y-3">
            <button
              onClick={() => run('google', onGoogle)}
              disabled={disabled}
              className="ns-signin-btn is-primary"
            >
              {busy === 'google' ? '// OPENING…' : 'Continue with Google'}
            </button>

            {showEmail ? (
              <div className="space-y-3">
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitEmail() }}
                  placeholder="you@example.com"
                  disabled={disabled}
                  className="ns-signin-input"
                />
                <button onClick={submitEmail} disabled={disabled || !email.trim()} className="ns-signin-btn is-primary">
                  {busy === 'email' ? '// SENDING…' : 'Send me a link'}
                </button>
              </div>
            ) : (
              <button onClick={() => setShowEmail(true)} disabled={disabled} className="ns-signin-btn">
                Continue with email
              </button>
            )}

            <button onClick={onWallet} disabled={disabled} className="ns-signin-btn">
              I already have a wallet
            </button>
          </div>
        )}

        {error && (
          <div className="mt-6 p-3 bg-[rgba(255,59,48,0.2)] border border-[rgba(255,59,48,0.5)] text-null-red font-mono text-xs">
            {error}
          </div>
        )}

        <button onClick={onSkip} disabled={disabled} className="ns-signin-skip">
          Skip for now →
        </button>

        <div className="mt-6 pt-6 border-t border-[rgba(0,255,136,0.2)]">
          <p className="font-mono text-[10px] text-null-muted leading-relaxed tracking-[1px]">
            An account saves your name and progress.
            <br />
            Buying items and claiming rewards needs a wallet — you can add one later.
          </p>
        </div>
      </div>
    </div>
  )
}
