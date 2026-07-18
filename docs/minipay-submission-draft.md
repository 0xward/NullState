# MiniPay Listing — Submission Draft

Draft copy for https://developer.minipay.to/mini-app-listing. Review and edit
before submitting — I'm not filling/sending this form myself, this is just
prep so Fa can copy-paste and adjust.

| Field | Draft value |
|---|---|
| **App name** | NULL_STATE |
| **Tagline** | A real-time dungeon crawler on Celo — descend the depths, sign on-chain NULL_STRIKEs, survive. |
| **Publisher** | 1892 Studio |
| **Support URL** | mailto:0xward.dev@gmail.com |
| **Terms of Service** | https://nullstate-ten.vercel.app/terms |
| **Privacy Policy** | https://nullstate-ten.vercel.app/privacy |
| **Category** | Games |
| **App URL (linkUrl)** | https://nullstate-ten.vercel.app *(confirm this is the final production domain before submitting)* |
| **Icon** | `public/icon-512.png` (512×512, already exists) |

## Notes / things to double-check before submitting
- **Publisher = "1892 Studio"** — this follows the Publisher rename from session
  v55. Separate from the `<meta name="author">` SEO tag in `app/layout.tsx`,
  which stays "0xward" per your decision this session — different field,
  different purpose, no conflict.
- **Tagline** — pulled from `app/layout.tsx` OpenGraph description, trimmed.
  Swap it if you want something punchier for the listing card specifically.
- **Support URL** — currently a `mailto:`. MiniPay's own guidance prefers
  Telegram/WhatsApp/web support portal *ideally*, but email is explicitly
  allowed. If the Discord mentioned in `docs/faq.md` is live and public,
  that could be a stronger Support URL than a personal Gmail — your call.
- **App URL** — flagged in the gap list already: confirm `nullstate-ten.vercel.app`
  is the domain you're actually shipping with, not a placeholder/dev deploy.

---

# Proof of Ship S2 — Talent App registration draft

Draft context for https://talent.app/~/earn/celo-proof-of-ship. Same rule:
prep only, you register/submit yourself.

**Reminder from this session's live-fetch (verify again if time has passed):**
- Current cycle window shown on Talent App: **Jul 1–27, 2026** — not Jul 31.
  Confirm the live page again before treating any date here as final.
- Requires a **Proof of Humanity credential** on your Talent Protocol profile
  (personal, not project-level) — not yet checked this session.
- Three required steps per Talent App: Build for MiniPay (hook — already
  have this, injected connector), Deploy on Celo (already have this — 4
  verified contracts), Submit Your Project.

**Project blurb draft** (for wherever a description field is needed):

NULL_STATE is a real-time dungeon crawler built for MiniPay on Celo Mainnet.
Players connect their wallet as their identity — no separate account — and
descend procedurally generated bunkers, fighting enemies and looting
containers. Most of a run happens instantly off-chain; what settles on Celo
is what carries real value: Season Pass mints, Vault Quest rewards,
Marketplace purchases, and the on-chain NULL_STRIKE ultimate. Four contracts
are live and verified on Celoscan (NullState.sol, PassSBTv3,
NullStateRewardV2, TreasureVaultV2).

- **GitHub repo**: https://github.com/0xward/NullState — **confirmed PUBLIC**
  this session (v57) via GitHub API (`"private": false, "visibility": "public"`).
  No longer a blocker for the open-source requirement.
- **Contracts (Celoscan)**: fill in the 4 verified contract links here —
  addresses are in `docs/sample-transactions.md` (updated v57)
- **Live app**: https://nullstate-ten.vercel.app

---

## v57 session update

- **GitHub visibility**: ✅ confirmed public (see above). Item #3 from the
  v56 pending list is resolved.
- **Proof of Ship S2 cycle window**: re-fetched live from
  https://talent.app/~/earn/celo-proof-of-ship — still shows **"Jul 1–27"**
  and **$5,000 / 50 Winners**, unchanged from the v56 live-fetch. As of
  today (Jul 14, 2026) the cycle is roughly half over, so there's still
  time but it's closer than it sounds — don't sit on this too long. Same
  three required steps as before (Build for MiniPay, Deploy on Celo,
  Submit Your Project). Proof of Humanity credential on your personal
  Talent Protocol profile still not verified this session — that one needs
  Fa to check directly on the site (it's account-specific, not something
  fetchable generically).
- **Sample transactions**: method names for the marketplace and reward-claim
  rows are now confirmed exact (see `docs/sample-transactions.md`) — turns
  out the marketplace "buy" is a plain ERC-20 `transfer()` to the treasury
  wallet, not a TreasureVaultV2 method as the v56 placeholder implied.
  Actual tx hashes still need Fa to pull from Celoscan/wallet history —
  Celoscan isn't reachable from this sandbox.
- **PageSpeed Insights**: attempted the public API endpoint
  (`googleapis.com/pagespeedonline/v5/runPagespeed`) directly against
  `nullstate-ten.vercel.app` from here — got rate-limited (HTTP 429,
  no API key available in this environment). Still needs Fa to run
  https://pagespeed.web.dev/ manually and record the score.
- **Support URL & final domain decisions** (items #7–8 from v56): still
  open, still Fa's call — nothing new to report on either.
