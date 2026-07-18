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
| `twitter.com` | Twitter/X share-intent links and profile links (outbound links only, no fetch) | `lib/utils.ts`, `components/ui/Footer.tsx` | No (social feature) |
| `token-logos-static.s3.amazonaws.com` | USDm token logo image | `lib/tokens.ts`, `components/game/GameFullUI.tsx`, `.env.example` | Yes |
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

- **Session v59 (2026-07-14) — crosscheck vs official MiniPay/Celopedia docs +
  asset optimization. Still awaiting deploy + real PSI re-run (v58's fixes
  have STILL never been measured live — see v58 entry below, unchanged).**
  Work done this session:
  - **Crosscheck task**: fetched and read `celopedia-skills` reference docs
    (`minipay-requirements.md`, `minipay-guide.md`, `minipay-templates.md`,
    `odis-socialconnect.md`, `minipay-live-apps.md` — all from
    `github.com/celo-org/celopedia-skills`), plus live-fetched
    `minipay.to/mini-apps`, `developer.minipay.to/mini-app-listing`, and
    `docs.celo.org/build/build-on-minipay/deeplinks` directly. Verified
    against actual code (not assumed): no `personal_sign`/`signMessage`/
    `signTypedData` anywhere (clean); no raw `0x…` address shown as primary
    identifier anywhere (Leaderboard/Marketplace use the username system,
    clean); wallet auto-connect exists but does **not** gate on
    `window.ethereum?.isMiniPay` the way the official pattern in
    `minipay-guide.md` does — connects any injected wallet unconditionally
    (`lib/WalletProvider.tsx`) — **flagged, not changed, needs an explicit
    decision** (see NEXT-SESSION-PROMPT-v60.txt).
  - **IMPORTANT CORRECTION — do NOT change `MINIPAY_ADD_CASH_URL` again**:
    the `celopedia-skills` reference docs (`minipay-requirements.md` /
    `minipay-templates.md`) state the Add Cash deeplink is
    `https://link.minipay.xyz/add_cash`. This was cross-checked directly
    against the primary source, `docs.celo.org/build/build-on-minipay/deeplinks`
    (fetched live 2026-07-14), which states clearly:
    `https://minipay.opera.com/add_cash`. **The primary source wins.** The
    code (`lib/errorUtils.ts` → `MINIPAY_ADD_CASH_URL`) already had the
    correct value — a prior session (2026-07-13) had already investigated
    this exact question and reached the right answer. The `celopedia-skills`
    community doc appears to be stale/wrong on this one specific point.
  - **Asset optimization — PNG → WebP (lossless)**: `NullState_Logo_Transparent.png`
    + `backgrounds/{forest,desert,snow,field,back}.png` (all 256-color
    indexed/palette PNGs) converted to lossless WebP. 1668 KB → 1392 KB
    (-277 KB, -16.6%). Updated: `components/game/SettingsModal.tsx` (logo
    `src`), `public/game-engine/assets.js` (`backgrounds` array +
    `BG_BY_KEY`), and fixed a hidden dependency in `public/game-engine/game.js`
    line ~537 — the floor-name banner parsed the background filename via
    `.replace('.png','')`, which would have shown "FOREST.WEBP" instead of
    "FOREST" if left unfixed; changed to a generic extension-stripping regex.
    Old PNGs deleted after confirming (repo-wide grep) no other references.
    Validated: `tsc --noEmit` 0 errors, and a full `next build` (via the
    same font-fetch-stub trick as v58, see below) completed successfully —
    root `/` still 240 kB First Load JS, `/game` 313 kB, unchanged from
    before this session's asset work (only byte-weight of images changed).
  - **NOT touched this session** (in scope for later, low-to-medium risk):
    `NullState_Logo.png` (2.7 MB) and `icon-512.png` — confirmed via grep to
    be unused at runtime (only referenced by `scripts/generate-icon.js` as a
    build-time source/output), so they don't affect PSI or user-facing load
    weight; left as PNG since converting them has zero measurable benefit.
    `catacombs_main.png`, `paper-scroll-large.png`, `Season_1-6.png`, and the
    LPC character sprite sheets — not yet converted.
  - **Wallet-connect pattern — investigated, changed, then reverted, same
    session (2026-07-14)**: initially changed `lib/WalletProvider.tsx` /
    `lib/Web3Providers.tsx` to gate auto-connect on `isMiniPay` and target
    the `metaMask` connector, per the *example code* in `minipay-guide.md`.
    On closer re-read of the actual requirement text
    (`minipay-requirements.md` line 46/79: **"no 'Connect Wallet' button
    when `window.ethereum.isMiniPay === true`"**), that's a narrower,
    conditional rule about the *button* — it does not forbid auto-connecting
    to non-MiniPay injected wallets too. The original code (no button ever,
    anywhere, silent auto-connect to any injected wallet) already fully
    satisfied the actual written requirement. The `isMiniPay`-gated version
    was an unnecessary narrowing (would have dropped MetaMask in-app-browser
    compatibility) based on treating an illustrative code sample as if it
    were a compliance rule. **Reverted back to the original behavior**
    (connector: plain `injected()`; auto-connect effect: no `isMiniPay`
    gate) per explicit user decision. `isMiniPay` remains available as a
    display/analytics flag only, same as before this session started.
    **Lesson for future sessions**: `minipay-guide.md` code samples show
    *one way* to implement something for MiniPay specifically — they are
    not automatically compliance requirements. Always check
    `minipay-requirements.md`'s actual checklist wording (or the primary
    docs.celo.org/docs.minipay.xyz source) before treating a guide's sample
    code as mandatory. Validated: `tsc --noEmit` 0 errors, `next build`
    succeeded, bundle sizes unchanged (root 240 kB, `/game` 313 kB).
  - **Sandbox caveat (same as v58)**: this session's sandbox also blocks
    `fonts.googleapis.com`/`fonts.gstatic.com` (confirmed again). `next build`
    fails at the `next/font` fetch step unless `lib/fonts.ts` is temporarily
    stubbed in a throwaway copy of the project (not shipped) — same
    workaround as v58, confirmed to still work.

- **PageSpeed session v58 (2026-07-14) — fixes applied, awaiting re-run on
  Vercel to confirm actual score.** Starting point: Performance 83 (see v57
  entry below for full breakdown). Work done this session:
  1. **Render-blocking font requests — fixed.** Fonts were actually loaded
     **twice**: once via `<link href="https://fonts.googleapis.com/...">`
     in `app/layout.tsx`, and again via `@import` at the top of
     `styles/globals.css` (a duplicate render-blocking request that hadn't
     been caught before). Both removed. All 4 fonts (Share Tech Mono,
     Cinzel, Rajdhani, Orbitron) migrated to `next/font/google` — see new
     `lib/fonts.ts` — which self-hosts the font files at build time (no
     external network round-trip) and injects them as CSS variables
     (`--font-mono`, `--font-cinzel`, `--font-hud`, `--font-display`)
     applied to `<html>` in `app/layout.tsx`. Every literal font-family
     reference in `styles/globals.css` (37 occurrences), `tailwind.config.ts`
     (`font-mono`/`font-hud`/`font-display` utility classes, used in 24+
     component files), and one inline style in `TokenBalanceWidget.tsx` was
     updated to reference the new CSS variables instead — otherwise the
     self-hosted fonts would load but never actually get applied. Weights
     kept identical to what was requested before (Share Tech Mono: 400;
     Cinzel: 500,700; Rajdhani: 300–700; Orbitron: 400,700,900) — no visual
     change, purely a loading-mechanism fix.
  2. **Unused JavaScript on `/game` — partially fixed.** `GameFlowManager.tsx`
     was statically importing every game screen (Leaderboard, RewardsScreen,
     SeasonPassScreen, MarketplaceScreen, UsernameSetup, and
     DungeonGameWrapper — which wraps the 808-line DungeonGame.tsx canvas
     engine) even though only one screen renders at a time based on
     `phase` state. All 6 are now `next/dynamic` with `ssr:false` and a
     lightweight themed loading fallback. Measured locally (font-fetch
     stubbed to work around this sandbox's network allowlist — see caveat
     below): `/game` First Load JS dropped from **336 kB → 314 kB**, own
     page chunk from 142 kB → 120 kB.
     **Important caveat found this session: the PSI run was against the
     ROOT page (`/`), not `/game`.** This code-split fix only helps
     `/game` — it made zero difference to root's 240 kB First Load JS in
     local testing, since the landing page never imports GameFlowManager.
     The actual dominant contributor to root's "unused JS" looks to be
     wagmi/viem code (~350 KB raw / one of the largest chunks) pulled in by
     `Web3Providers` wrapping *every* route in `app/layout.tsx`, including
     pages that don't need wallet code on first paint (`/`, `/terms`,
     `/privacy`, `/docs`). **Deliberately NOT touched this session** — this
     is a wallet-flow change (MiniPay's silent-connect-on-load requirement
     makes this fragile) and was explicitly out of scope. Flagged here as
     the highest-value follow-up for a future session, once the risk can be
     properly tested against a live MiniPay environment.
  3. **Unused CSS (~17 KiB) — investigated, not fixed this session.** Found
     the actual source: a ~280-line block in `styles/globals.css` scoped
     under `.ns-game-root` (the dungeon canvas engine's UI, already
     commented in the file as "scoped ... so they never leak into the
     landing page" — but it still ships in the same global stylesheet to
     every route since Tailwind's purge only touches `@tailwind` utility
     classes, not hand-written CSS in the same file). Splitting this into
     a separate stylesheet loaded only by the game route looked
     straightforward at first, but `.ns-confirm-overlay`/`.ns-settings-*`
     rules in that same section are also used by `NewGameConfirmModal`,
     which renders on the very first `/game` screen (not behind the new
     dynamic imports) — so a naive split risks breaking those without a
     real browser to visually verify against. Left alone this session;
     flagged as a follow-up once there's a way to check the rendered result
     against actual PSI/browser, not just a build log.
  4. **Legacy JavaScript / no modern-bundle targeting (~12 KiB) — fixed.**
     Added a `browserslist` field to `package.json` (evergreen
     Chrome/Android Chrome/Firefox/Safari/iOS Safari only), so Next.js
     ships modern JS without transpiling/polyfilling for legacy browsers
     MiniPay's Android WebView users will never hit.
  5. **Raw `<img>` tags — checked, left alone.** `MarketplaceScreen.tsx`
     and `RewardsScreen.tsx` have small pixel-art sprite icons where
     `next/image`'s automatic re-encoding risks messing with
     `image-rendering:pixelated`, for very little payload gain, and both
     are inside `/game` (not what PSI measured). `DungeonGame.tsx`'s
     `<img id="itemZoomIcon">` has its `src` set imperatively by the
     vanilla-JS engine in `/public/game-engine/*.js`, not by React state —
     this one is **not safely portable** to `next/image` at all without
     touching game engine logic, which is out of scope.
  - **Sandbox caveat**: this session's build verification ran in a
    container whose network allowlist doesn't include
    `fonts.googleapis.com`/`fonts.gstatic.com`, so `next build` can't
    complete the `next/font` fetch step locally here — confirmed via
    `curl` (403 `host_not_allowed`). Code correctness was verified with
    `tsc --noEmit` (0 errors) instead, and the code-splitting measurement
    above used a temporary local stub of `lib/fonts.ts` (not shipped in
    the delivered files) just to get past that one build step. Vercel's
    build environment has normal internet access, so `next build` will
    complete normally there — but this means **the actual post-fix PSI
    score still needs to be measured for real** after deploying to a
    preview URL. Regression-check Accessibility/Best Practices/SEO (all
    100 before this session) on that same run.
- **PageSpeed score (recorded 2026-07-14, session v57 — corrected with actual
  screenshots from Fa's run): Performance 83, Accessibility 100, Best
  Practices 100, SEO 100, Agentic Crawling 2/2.** Mobile, run against
  `https://nullstate-ten.vercel.app`. (An earlier "86" mentioned in this
  session's chat was Fa's rough recollection before checking the actual
  report — 83 is the real number, correcting the record here.)
  MiniPay's submission doc doesn't state a numeric pass/fail threshold —
  it just says "High performance is a prerequisite for listing" and asks
  you to attach the score. 83 is in Google's "needs improvement" band
  (50–89; 90+ is "good"/green), and Accessibility/Best Practices/SEO are
  already a clean sweep at 100, so Performance is the one category worth
  a look if there's time before submitting.
  - Metrics: FCP 2.6s, LCP 3.6s, TBT 0ms (green), CLS 0 (green), Speed
    Index 5.2s.
  - Top flagged opportunities (highest impact first): render-blocking
    requests (~1,160ms potential saving), unused JavaScript (~96 KiB),
    unused CSS (~17 KiB), legacy JavaScript / no modern-bundle targeting
    (~12 KiB).
  - TBT and CLS are already perfect, so this isn't a jank/stability
    problem — it's specifically initial-paint/load-weight: what loads
    before first paint and how much JS/CSS ships that isn't used on that
    first screen. Typical fixes for this stack (Next.js + Google Fonts +
    Firebase SDK) would be: code-splitting/lazy-loading anything not
    needed for the landing screen, checking whether the full Firebase SDK
    is being imported where only a subset is used, and deferring
    non-critical CSS/fonts. Not urgent for this submission, but worth a
    follow-up punch-list item since "83" leaves easy room to clear 90+
    later.
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
- **Contract verification (2026-07-13)**: Owner (Yurk) confirmed all 4 deployed contracts
  (NullState.sol, PassSBTv3, NullStateRewardV2, TreasureVaultV2) are verified on Celoscan
  (green checkmark). Sample transaction links for each user-facing contract method
  (`register()`, `mintFreePass()`, `mintPaidPass()`, marketplace ERC-20 `transfer()`) still
  need to be collected for the MiniPay submission form — not done yet.
