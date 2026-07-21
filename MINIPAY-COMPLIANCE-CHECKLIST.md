# MiniPay Compliance Checklist — NULL_STATE

**Last updated:** 2026-07-21
**Scope:** Current state after the economy/listing work (retired `NullState.sol`, free NULL_STRIKE, off-chain registration, guest mode, flexible stablecoin). Complements the broader `MINIPAY-COMPLIANCE-AUDIT-v71.md`; this file is the focused listing checklist.

---

## Core MiniPay requirements

| # | Requirement | Status | Where it's handled |
|---|---|---|---|
| 1 | **No "Connect Wallet" button inside MiniPay** — connection is implicit | ✅ | `lib/WalletProvider.tsx` auto-connects the injected connector on load (`WalletExtrasProvider` effect); MiniPay is detected via `window.ethereum.isMiniPay`. No UI element calls `connect()` — verified: zero `.connect()` call sites in `components/` or `app/`. |
| 2 | **Wallet balance is readable** | ✅ | Native/CELO balance via wagmi `useBalance` (`celoBalance` in `WalletProvider`). Stablecoin balances read via `balanceOf` in `pickBestPaymentToken`/`pickBestFeeCurrency` (`lib/constants/tokens.ts`). NullState Point balance shown in Marketplace/Rewards. `insufficientFunds` + `addCashUrl` drive an "Add cash in MiniPay" prompt. |
| 3 | **Transaction errors are shown to the user** | ✅ | `lib/errorUtils.ts` `getUserFriendlyError()` turns viem/wallet errors into clean human strings. Surfaced in `MarketplaceScreen` (`setMsg{kind:'err'}`), `SeasonPassScreen` (`setMintError`/`setPerkMsg`), and Crafting. User-rejected and insufficient-funds cases are distinguished. |

---

## Economy & payments (MiniPay-relevant)

- ✅ **No speculative token** — economy is stablecoin (USDm/USDC/USDT) + in-game **NullState Point** (faucet-only, non-withdrawable). No project token is minted or sold.
- ✅ **NULL_STRIKE is free** — no per-action fee or wallet prompt during combat; it is gated by an in-engine cooldown. (Retired the old 0.005 USDm fee and `NullState.sol`.)
- ✅ **Flexible stablecoin (fee-abstraction)** — payments and gas default to whichever of USDm/USDC/USDT the wallet holds the most of, via CIP-64 `feeCurrency` and `pickBestPaymentToken`; the user can still switch manually.
- ✅ **Registration is off-chain** — no `register()` transaction; a wallet is a player the moment it holds a Firebase username. First-time users are never blocked by a signing step.
- ✅ **Purchases are explicit** — Marketplace and Season Pass are the only player-signed transactions; each shows price, token, and a confirm step.

---

## Access & play

- ✅ **Guest mode (outside MiniPay)** — playable with no wallet; progress stored in `localStorage` and migrated onto the wallet on first connect (`lib/guestMigration.ts`). Stablecoin claims are gated behind a connected wallet with a clear message.
- ✅ **Mobile/touch** — on-screen joystick + action buttons for touch; WASD/arrows + mouse for desktop; OS cursor is never hidden off the landing page.
- ✅ **Readable UI** — body/subtitle contrast raised to ~5:1 (`--null-muted`), meeting legibility expectations on small screens.

---

## Legal & disclosure

- ✅ **Privacy Policy** (`/privacy`) and **Terms of Service** (`/terms`) reflect the actual flow: on-chain vs off-chain (Firebase) vs local-device (guest) data, stablecoin rewards, NullState Point as non-money, and guest-mode migration. Operated by 1892 Studio.
- ✅ **Not affiliated** disclaimers for MiniPay / Opera / Celo Foundation are present in both docs.
- ⏳ **Owner confirmation still needed** (flagged in the Privacy Policy draft note): exact data-retention timelines and the formal deletion-request process.

---

## Pre-submission manual checks (device)

These require a real MiniPay devmode session and cannot be asserted from code alone:

- [ ] Open in MiniPay devmode — confirm no "Connect Wallet" button appears and the wallet is already connected.
- [ ] Confirm the wallet balance renders and updates after a purchase.
- [ ] Make a Marketplace purchase — confirm the tx signs, succeeds, and the item unlocks.
- [ ] Reject a transaction — confirm a friendly "transaction cancelled" style message appears (no raw stack trace).
- [ ] Trigger an insufficient-funds purchase — confirm the "Add cash in MiniPay" prompt appears.
- [ ] Play a run as a guest (plain browser), then connect a wallet — confirm progress migrates.
