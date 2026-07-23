# NullState — Owner Runbook

What the owner does to keep the live game (and its MiniPay listing) healthy,
now that development is done. Operational companion to
[`TREASURY-OPS.md`](./TREASURY-OPS.md) (the funding/command cheat-sheet).

All treasury commands below are `node scripts/deposit-reward.js <command>`, run
from Termux, signed by the **deployer key** in `scripts/.env` (gitignored — see
Security at the bottom).

---

## 🗓️ Daily (5–10 min)

1. **Support** — check Telegram (`t.me/nullstate_id`) and reply. MiniPay
   requires **critical issues fixed within 24h** or the listing can be
   suspended. This is the single most important recurring task.
2. **Backend gas** — the backend wallet `0xAb73e0E9…F92f2eb6` auto-signs vault
   payouts and stores the weekly code. **If its CELO runs out, payouts fail.**
   Keep a small CELO balance on it.
3. **Quick health check** — open the game (Continue / New Game both work?),
   glance at Vercel (no red errors) and `/stats` (no weird spikes).

## 📅 Weekly — Treasure Vault

The weekly code is stored on-chain **automatically** by the backend on the first
correct submit — you never set it by hand. Your only weekly job is keeping the
pool funded:

```bash
node scripts/deposit-reward.js vault-deposit --token USDT --amount 1   # +$1 ≈ 20 wins @ $0.05
node scripts/deposit-reward.js status                                   # check pool + per-win reward
```

Top up so there's enough USDT for the week's expected wins. Depositing mid-week
is always safe (it accumulates).

## 🗓️ Monthly — Season (end of month, UTC)

Season id = `YYYYMM` (e.g. July 2026 → `202607`).

```bash
# 1. Publish the top-3 winners on-chain
node scripts/deposit-reward.js update-leaderboard --season 202607 \
  --p1 0x.. --p2 0x.. --p3 0x.. --s1 120 --s2 90 --s3 70

# 2. Set rank amounts (if changing) and fund the pool (amount ≥ r1+r2+r3)
node scripts/deposit-reward.js season-rewards --token USDT --r1 20 --r2 5 --r3 3
node scripts/deposit-reward.js season-deposit --season 202607 --token USDT --amount 28
```

The next season (`YYYYMM`) starts automatically. Announce winners on
Telegram/Twitter for retention.

## 🔧 As needed

- **Top up gas (CELO)** on both wallets: deployer `0x2A6b5204…b7d912F7` (Termux
  ops) and backend `0xAb73e0E9…F92f2eb6` (Vercel).
- **Watch `/stats`** — a rising failed-tx rate usually means something broke.
- **Ship fixes/features** — but **batch** several changes into one PR/deploy so
  Vercel builds don't pile up (Hobby plan runs one build at a time).
- **Growth** — referrals, socials, community.

## ⚠️ Don't let these slip (they take the game "down")

| Risk | Effect | Prevent |
|------|--------|---------|
| Backend gas runs out | Payouts & pass mints fail | Daily gas check |
| Vault / season pool empty | Rewards can't be paid | Weekly / monthly top-up |
| Critical issue open > 24h | MiniPay may suspend the listing | Monitor support |
| Private key leaks | Treasury funds can be drained | Keep keys out of the repo (below) |

**Realistic priority:** the only truly non-negotiable routines are
**(1) support**, **(2) backend gas**, **(3) topping up the vault/season pools.**

---

## 🔐 Security (this repo is PUBLIC)

- **Never commit a private key.** Wallet + contract *addresses* are public
  on-chain and fine to have in the repo; **private keys are not.**
- **Where keys live:** `DEPLOYER_PRIVATE_KEY` → `scripts/.env` (gitignored, on
  your Termux device only). `BACKEND_PRIVATE_KEY` + `FIREBASE_PRIVATE_KEY` →
  Vercel Environment Variables (never in code).
- **Verified clean** (2026-07-24 audit): no `.env` with real values tracked, no
  private keys / API keys / Firebase service-account committed. Keep it that way
  — if you ever paste a key into a file, make sure that file is gitignored
  before committing.
- If a key is ever exposed: rotate it immediately (move funds to a new wallet /
  set a new backend signer via `setBackendAddress`) — a leaked key means anyone
  can act as that wallet.
