# NullState — Network Manifest

Complete list of external network origins contacted by the NullState frontend and API routes.
This table is intended to be copy-paste-ready for the MiniPay submission form's network manifest
field.

**Last audited:** 2026-07-10  
**Audit method:** repo-wide grep for `https://`, `http://`, `images.domains`, `.env.example`,
`app/layout.tsx` font imports, `lib/firebase.ts`, `lib/Web3Providers.tsx`, and all API route
files.

---

| Domain | Purpose | Where used (file) | Required for core functionality? |
|---|---|---|---|
| `fonts.googleapis.com` | Google Fonts stylesheet (Share Tech Mono, Cinzel, Rajdhani, Orbitron) | `app/layout.tsx` | Yes |
| `fonts.gstatic.com` | Google Fonts font-file CDN | `app/layout.tsx` | Yes |
| `forno.celo.org` | Celo Mainnet JSON-RPC endpoint (on-chain reads/writes) | `lib/Web3Providers.tsx`, `lib/useContractPlayer.ts`, `.env.example` | Yes |
| `forno.celo-sepolia.celo-testnet.org` | Celo Sepolia testnet JSON-RPC (default transport for `celoSepolia` chain via wagmi) | `lib/Web3Providers.tsx` (wagmi chain default) | No (testnet only) |
| `pbs.twimg.com` | Twitter/X user avatar images | `next.config.js` (`images.domains`) | No (social feature) |
| `abs.twimg.com` | Twitter/X media images | `next.config.js` (`images.domains`) | No (social feature) |
| `api.twitter.com` | Twitter v2 API — tweet lookup for in-game tweet-to-earn feature | `app/api/groq/route.ts` | No (optional feature) |
| `twitter.com` | Twitter/X share-intent links and profile links (outbound links only, no fetch) | `lib/utils.ts`, `components/ui/Footer.tsx` | No (social feature) |
| `token-logos-static.s3.amazonaws.com` | USDm token logo image | `lib/tokens.ts`, `components/game/GameFullUI.tsx`, `.env.example` | Yes |
| `api.groq.com` | Groq LLM API — AI dungeon master narrative generation | `app/api/groq/route.ts` | Yes (core game narrative) |
| `firestore.googleapis.com` | Firebase Firestore — player data, leaderboard, game state persistence | `lib/firebase.ts` | Yes |
| `identitytoolkit.googleapis.com` | Firebase Authentication REST API | Firebase SDK (client-side) | Yes |
| `securetoken.googleapis.com` | Firebase Auth token exchange | Firebase SDK (client-side) | Yes |
| `*.firebaseio.com` | Firebase Realtime Database (used for `FIREBASE_DATABASE_URL` in admin SDK) | `.env.example` (`FIREBASE_DATABASE_URL`) | Yes |
| `firebasestorage.googleapis.com` | Firebase Storage (configured via `storageBucket` in `lib/firebase.ts`) | Firebase SDK | No (storage not actively used) |
| `celoscan.io` | Celo blockchain explorer — contract/transaction links shown in UI | `components/ui/Footer.tsx`, `app/terms/page.tsx` | No (informational links only) |
| `t.me` (`t.me/nullstate_id`) | Telegram support channel (outbound link only, no fetch) | `components/ui/Footer.tsx`, `app/terms/page.tsx`, `app/privacy/page.tsx` | No (support link) |
| `github.com` | GitHub repository link (outbound link only, no fetch) | `components/ui/Footer.tsx` | No (informational link) |
| `talent.app` | Talent Protocol project verification (meta tag + outbound link) | `app/layout.tsx`, `app/docs/page.tsx` | No (optional) |

---

## Notes

- **Firebase domains**: NullState uses Firebase Firestore (`lib/firebase.ts`) and Firebase Admin
  SDK (`firebase-admin` via server API routes). The specific Google API hostnames contacted
  depend on the Firebase project region and services active. The domains listed above cover all
  Firebase services referenced in the codebase.
- **Celo Sepolia**: The wagmi `celoSepolia` chain is registered in `lib/Web3Providers.tsx` for
  testnet support. Its transport is left as the default public RPC
  (`forno.celo-sepolia.celo-testnet.org`). This domain is only contacted when a user's wallet
  is connected to the testnet.
- **Twitter**: Twitter API calls are server-side only (Next.js API route) and require a
  `TWITTER_BEARER_TOKEN` — they are guarded by try/catch; the feature degrades gracefully if
  not configured.
- **WalletConnect**: WalletConnect infrastructure (e.g. `relay.walletconnect.com`) was
  **removed** in a previous PR (A1/A3). NullState now uses the `injected()` connector only
  (MiniPay's in-app browser injects the wallet). No WalletConnect relays are contacted.
