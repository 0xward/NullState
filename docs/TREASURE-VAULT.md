# Treasure Vault — how it works & owner setup

This is the weekly "crack-the-code" reward loop. A player who finds the two
weekly items and enters the correct 4-digit code at the Act 5 vault door gets
paid an on-chain reward. This doc explains the full flow and **exactly where
the owner sets the two numbers: the weekly CODE and the reward AMOUNT.**

---

## The loop, end to end

1. **Find the two items.** While dungeon-crawling, two special drops come out
   of the "vault-like" interactive containers — Rotten Armoire (`wardrobe`),
   Lost Cache (`chest`), Rusted Strongbox (`safe`), Iron Footlocker
   (`footlocker`), Old Dresser (`dresser`), Ornate Cabinet (`cabinet_ornate`)
   and Stocked Shelf (`shelf_stocked`):
   - **Golden Key** — capped 1 / wallet / week (`goldenKeyClaims/{weekId}/{wallet}`).
   - **Paper** — capped 1 / wallet / week (`paperClaims/{weekId}/{wallet}`).
   Drop chance is 16% per eligible container per item (client rolls in
   `public/game-engine/props.js` `rollLootSlots()`; server gates the weekly cap
   in `/api/paper/claim` and `/api/goldenkey/claim`).

2. **Read the code off the Paper.** Tapping the Paper in the inventory shows
   the current week's 4-digit **vault code**. The Paper itself has no unique
   code — it's the item that lets you *view* the one global weekly code stored
   at `vaultCodes/{weekId}`. The code is only returned to a wallet that has
   actually claimed Paper this week (`/api/paper/status`).

3. **Enter the code at the vault door.** Act 5's boss room contains the
   **Sealed Vault Door** (`vault_door` decor, spawned in `game.js`
   `spawnDecorInto` when `campaignActIndex===4`). The player submits the
   4-digit code — **max 3 attempts per week** (`vaultAttempts/{weekId}/{wallet}`).

4. **Backend validates & pays.** `POST /api/vault/submit` checks, in order:
   - the week's code exists at `vaultCodes/{weekId}` (else 404),
   - the wallet holds **both** Paper **and** Golden Key this week (ownership
     gate — a shared code alone can't unlock it),
   - not already solved this week, attempts < 3,
   - submitted code === stored code.
   On a correct code it signs `submitVaultCode(user, weekId, code)` on
   `TreasureVaultV2` with `BACKEND_PRIVATE_KEY`, which transfers `vaultReward`
   of `currentRewardToken` to the player, and records
   `vaultCompleted/{weekId}/{wallet}`.

**weekId** = `getISOWeekId()` → `YYYYWW`, resetting every **Monday 00:00 UTC**
(`lib/web3-client.ts`). Example: the week of 2026-07-22 is **`202630`**.

---

## OWNER SETUP — the two numbers

### 1. The weekly CODE  →  Firebase Realtime Database

Path: **`vaultCodes/{weekId}`**, value shape:

```json
{ "code": "1234", "generatedAt": 1750000000000 }
```

- **It auto-generates.** The first time *any* player opens their Paper in a new
  week, `/api/paper/status` (`ensureWeeklyCode`) writes a **random** 4-digit
  code via an atomic transaction. So if you do nothing, the loop still works —
  a random code is used that week.
- **To CHOOSE the code yourself**, write `vaultCodes/{weekId}` **before the
  first player views their Paper that week** (Firebase console → Realtime
  Database, or a small Admin-SDK script). `weekId` is the current ISO week as
  `YYYYWW` — e.g. `vaultCodes/202630` = `{ "code": "0729" }`.
- To **change** a code mid-week, overwrite the same path. Players who already
  read the old code will have the wrong one — only do this at a week boundary.
- There is intentionally **no admin UI** for this; it's a direct RTDB write.

> Sanity check: a missing `vaultCodes/{weekId}` makes `/api/vault/submit`
> return `404 "Vault code not found"` and the Paper shows no code — but in
> practice the lazy-generator fills it on the first Paper view, so this only
> happens if nobody has viewed a Paper yet that week.

### 2. The reward AMOUNT  →  on-chain, owner-only

Contract: **`TreasureVaultV2.sol`**, function **`setVaultReward(uint256 _newReward)`**
(`onlyOwner`).

- Units are **wei of the current reward token**. For an 18-decimal token
  (USDm/USDT/USDC on Celo), `1e18` = 1 token. Default is `1e18` = **1 USDm**.
  - 5 USDm → `setVaultReward(5000000000000000000)` (`5e18`).
  - 0.5 USDm → `setVaultReward(500000000000000000)` (`5e17`).
- Related owner-only knobs on the same contract:
  - `setRewardToken(addr)` — pick which supported token pays out
    (`currentRewardToken`; must be one of USDm/USDT/USDC/CELO).
  - `depositVaultPool(token, amount)` — **fund the pool** the payouts come
    from. If the pool is empty, a correct code can't be paid.
  - `withdrawVaultPool(token, amount)` — pull unused funds back out.
  - `setBackendAddress(backendWallet, true)` — authorize the backend signer.

### 3. One-time backend wiring (already configured in prod)

- `BACKEND_PRIVATE_KEY` env on the server = the wallet authorized via
  `setBackendAddress(..., true)`. This wallet signs every `submitVaultCode`.
- `TREASURE_VAULT_ADDRESS` / ABI in `lib/contract-abi.ts`, RPC via
  `CELO_RPC_URL` (falls back to `https://forno.celo.org`).
- Firebase Admin credentials (`getAdminDb()` in `firebase-config.ts`) so the
  API routes can read/write the RTDB paths above.

---

## Quick reference

| What | Where | Who sets it |
|------|-------|-------------|
| Weekly 4-digit code | Firebase RTDB `vaultCodes/{weekId}` = `{code}` | Auto-generated; owner overrides in RTDB to choose it |
| Reward amount | `TreasureVaultV2.setVaultReward(wei)` | Owner (on-chain tx) |
| Reward token | `TreasureVaultV2.setRewardToken(addr)` | Owner (on-chain tx) |
| Reward pool funding | `TreasureVaultV2.depositVaultPool(token, amount)` | Owner (on-chain tx) |
| Attempts / week | `3` (`MAX_VAULT_ATTEMPTS`, `lib/vault-utils.ts`) | Code constant |
| Drop rate per container | `16%` each, Paper & Golden Key | Code constant (`props.js`) |
| Week boundary | Monday 00:00 UTC (`getISOWeekId`) | Code constant |
