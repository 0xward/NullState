import Web3Providers from '@/lib/Web3Providers'
import '../../styles/game.css'

// ─── Preconnect ──────────────────────────────────────────────────────────────
// The world map cannot finish painting until the player's name arrives, and the
// name comes from Firestore. Before this, the browser only discovered
// firestore.googleapis.com when the first query fired, then paid DNS + TCP +
// TLS before a single byte moved — PageSpeed measured 300ms of that, and 310ms
// again for the Celo RPC. Warming both while the JS is still parsing takes that
// off the critical path.
//
// These live in the /game layout, not the root one: the landing page talks to
// neither origin, and a preconnect it never uses is a socket opened for
// nothing. Two hints only — the guidance is to stay under four.
const ORIGINS = [
  'https://firestore.googleapis.com',   // username + leaderboard: gates LCP
  'https://forno.celo.org',             // Celo RPC: pass SBT, balances, mints
]

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {ORIGINS.map(href => (
        <link key={href} rel="preconnect" href={href} crossOrigin="anonymous" />
      ))}
      <Web3Providers>
        {children}
      </Web3Providers>
    </>
  )
}
