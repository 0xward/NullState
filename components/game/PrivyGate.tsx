'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PrivyProvider, usePrivy } from '@privy-io/react-auth'
import { privyAppId } from '@/lib/privyGateFlag'
import '@/styles/signin.css'

// ─── One button that is both a wallet and a Google login ─────────────────────
//
// OWNER: *"aku mau ada koneksi wallet barengan dengan login google, muncul
// setelah loading/splash pertama, pake privy aja."*
//
// Privy's own modal does both in one flow, which is the whole reason it is here:
// the screen it replaces had three buttons (Google, email, wallet) and made the
// player choose a mechanism before they knew what any of them were for.
//
// ── WHY THIS FILE EXISTS AT ALL, RATHER THAN A PROVIDER AT THE ROOT ─────────
//
// `@privy-io/react-auth` is a large SDK. Putting its provider in the app layout
// would ship it to every player on every route — including MiniPay, which must
// never see this screen and whose players would pay for it in download size on
// exactly the connection least able to afford it. /game's bundle was already a
// PageSpeed finding once.
//
// So the provider is mounted HERE, inside a component that is itself lazily
// imported, and only rendered when the gate is on. With the flag off — the
// default, and the state this ships in — nothing in this file is downloaded.

interface PrivyGateProps {
  /**
   * Called once Privy reports an authenticated user, with the id to key the
   * player's progress by and a human label for Settings.
   *
   * The id is Privy's own user id (a `did:privy:…` string), NOT a wallet
   * address. It is fed to the same deriveAuthAddress() the Firebase path uses,
   * which is what makes the promise on this screen true: the same Privy account
   * on another device derives the same address and finds the same save. A
   * wallet address would key the account on something the app cannot verify a
   * signature for, which is exactly the two-layer split lib/authIdentity.ts
   * describes — account keys identify, they never authorise.
   */
  onAuthenticated: (uid: string, label?: string | null) => void | Promise<void>
  /** "Skip for now" — the player declines and plays as a guest. */
  onSkip: () => void
}

/** The inner half: everything that needs the Privy context. */
function GateInner({ onAuthenticated, onSkip }: PrivyGateProps) {
  const { ready, authenticated, user, login } = usePrivy()
  const [busy, setBusy] = useState(false)
  const adopted = useRef(false)

  // Privy restores an existing session asynchronously. Someone who already
  // linked an account must not be asked again — that is the same rule the
  // Firebase path follows via getStoredAuthAddress().
  //
  // Guarded by a ref because adopting migrates guest progress onto the derived
  // address, and Privy re-renders this component several times as it settles
  // (ready → authenticated → user hydrated). Running that twice would be a
  // second migration over documents the first one already moved.
  useEffect(() => {
    if (!ready || !authenticated || !user || adopted.current) return
    adopted.current = true
    void onAuthenticated(
      user.id,
      user.google?.email ?? user.email?.address ?? user.wallet?.address ?? null,
    )
  }, [ready, authenticated, user, onAuthenticated])

  const start = useCallback(() => {
    setBusy(true)
    try {
      // Privy owns the modal from here: Google, email and wallet all live
      // inside it, so there is no second choice to present.
      login()
    } finally {
      // The modal is Privy's, so there is no promise to await — clear the
      // pending state once it has been asked to open, or a dismissed modal
      // would leave the button stuck.
      setTimeout(() => setBusy(false), 1200)
    }
  }, [login])

  return (
    <div className="ns-signin-root">
      <div className="ns-signin-card">
        <p className="ns-signin-kicker">// SAVE YOUR PROGRESS</p>
        <h1 className="ns-signin-title">KEEP YOUR RUN</h1>
        <p className="ns-signin-sub">
          Your run lives in this browser only. Sign in and it follows you anywhere.
        </p>

        <button
          type="button"
          onClick={start}
          disabled={!ready || busy}
          className="ns-signin-btn ns-signin-btn-primary"
        >
          <span>{!ready ? 'Loading…' : busy ? 'Opening…' : 'Sign in'}</span>
        </button>

        <button type="button" onClick={onSkip} className="ns-signin-skip">
          Skip for now →
        </button>

        <p className="ns-signin-foot">
          {/* Deliberately not the phrase MiniPay's copy rules ban — and this
              screen is never shown inside MiniPay anyway. It describes what the
              player gets, not the machinery they have to operate. */}
          Signing in saves your name and progress across devices. Buying items and
          claiming rewards needs an account — you can add one later.
        </p>
      </div>
    </div>
  )
}

/**
 * The provider wrapper. Returns null when there is no app id, so a deployment
 * that turns the flag on and forgets the credential falls back to the ordinary
 * flow instead of rendering a login that can never complete.
 */
export default function PrivyGate(props: PrivyGateProps) {
  const appId = privyAppId()
  if (!appId) return null
  return (
    <PrivyProvider
      appId={appId}
      config={{
        // Both, in one modal — that is the entire point of the change.
        loginMethods: ['google', 'wallet', 'email'],
        appearance: { theme: 'dark', accentColor: '#39ff9a' },
        // An embedded wallet for anyone who arrives without one, so a Google
        // sign-in still ends with an address the rewards system can pay.
        // Nested under `ethereum` — Privy v3 splits the setting per chain
        // family, and the flat form silently does nothing.
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
      }}
    >
      <GateInner {...props} />
    </PrivyProvider>
  )
}
