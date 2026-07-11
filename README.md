# NULL_STATE // Web3 RPG on Celo

> A real-time, top-down dungeon crawler built on Celo. Every meaningful action is a real on-chain transaction. Death is permanent. Your wallet is your weapon.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Built on Celo](https://img.shields.io/badge/Built%20on-Celo-FCFF52)](https://celo.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)

---

## What is NULL_STATE?

NULL_STATE is a pixel-art dungeon crawler that runs directly in the browser — no installs, no app store. Pick a class, descend into a procedurally generated bunker, fight your way through Orc and Skeleton crews, and ride the lift between floors as you push deeper into the depths.

Every NULL_STRIKE costs **0.005 USDm (Mento stablecoin)**, sent as a real ERC-20 transaction on Celo Mainnet. There's no separate in-game currency to buy — your wallet balance *is* your resource bar.

---

## Gameplay

- **3 playable classes** — Knight, Rogue, and Wizzard, each with their own sprite set and class-flavored attack effects (steel slash, dagger flicker, fire burst).
- **Procedural bunker floors** — square, grid-aligned rooms connected by corridors and doors, generated fresh per floor and cached for the rest of the run so a cleared floor stays cleared if you backtrack.
- **Fog of war** — rooms you haven't entered render fully dark; walking through a door permanently reveals that room for the rest of the run.
- **The Lift** — replaces simple staircases. Approach it to open a floor-select menu: revisit any floor you've already cleared, or push forward to the next one (locked until every hostile on the current floor — including elites and the floor boss — is dead).
- **The Golden Key** — exactly one spawns per run, hidden on a random floor in a random room. If you die before finding it, it relocates. Once collected, it's yours for the rest of the run, ready to be traded with an NPC down the line.
- **Inventory panel** — three-tab wooden-theme UI (LOOT / FOOD / GEAR) with equip, eat, and sell actions.
- **Marketplace** — buy weapons and armor with USDm, USDC, or USDT via on-chain ERC-20 transfer. Ownership is verified server-side and stored in Firebase.
- **Permadeath, softened** — dying drops you back at the floor you died on with full HP, rather than sending you back to floor 1. Progress on floors you've already cleared is preserved.
- **NULL_STRIKE** — an on-chain ultimate attack you can trigger against elites, bosses, or when your HP runs critically low.
- **Floor scaling** — monsters grow stronger every floor (+8% HP & damage per tier by default, configurable in `monster-config.js`). Boss floors (every 5th floor) have hardcoded overrides for dramatic difficulty spikes.

---

## Tech Stack

| Layer | Stack |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) + React 18 + TypeScript |
| Game engine | Vanilla JS / Canvas2D, mounted into a React component (no game-framework dependency) |
| Styling | Tailwind CSS + custom wooden-theme CSS |
| Web3 | [wagmi](https://wagmi.sh) + [RainbowKit](https://www.rainbow.me/rainbowkit) + [viem](https://viem.sh), targeting Celo Mainnet |
| Tokens | Mento USDm / USDC / USDT (ERC-20, 6- and 18-decimal aware) |
| Database | Firebase Realtime DB (player profiles, marketplace ownership, leaderboard) |
| Contracts | Solidity, deployed with Foundry |

---

## On-Chain Integration

| | |
|---|---|
| **Network** | Celo Mainnet (Chain ID `42220`) |
| **Tokens** | USDm (Mento), USDC, USDT — ERC-20 transfers via `buyMarketplaceItem()` |
| **Wallet support** | MetaMask, Coinbase Wallet, Rainbow, WalletConnect, and MiniPay (auto-connects on launch) |
| **Verification** | `POST /api/marketplace/verify` validates on-chain transfer, prevents replay, records ownership |

---

## Getting Started

```bash
git clone https://github.com/0xward/NullState.git
cd NullState
npm ci          # install exact deps from package-lock.json
npm run dev     # development server — http://localhost:3000
```

### Build & Test Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Production build (static bundle) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript type check |

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
FIREBASE_DATABASE_URL=your_firebase_url
FIREBASE_SERVICE_ACCOUNT_JSON=your_service_account_json
```

---

## Project Structure

```
app/                       Next.js App Router pages (landing, /game, /leaderboard, /profile)
app/api/marketplace/       Server routes: verify purchase, return owned items
components/game/           React wrappers (GameFlowManager, MainMenu, MarketplaceScreen, …)
public/game-engine/        The game engine
  assets.js                Sprite-sheet descriptors + archetype stats
  entities.js              Player & Enemy classes (stats, AI, animation)
  game.js                  Main loop, render, input, combat, floor management
  items.js                 Item definitions, loot tables, eat/equip logic
  marketplace-items.js     Marketplace catalogue (10 weapons/armor with USD pricing)
  monster-config.js        Data-driven per-floor scaling knobs (Phase 5)
  effects.js               Hit-stop, enhanced particles, floating damage numbers (Phase 5)
  dungeon.js               Procedural dungeon generator
  audio.js                 Sound effects manager
public/sprites/            Character, monster, and decoration sprite sheets
  player/                  knight/rogue/wizzard — idle, run, death
  monsters/                Orc & Skeleton crews — idle, run, death
  monsters2/               Skel Reaper & Vampire — full idle/walk/attack/death sheets
styles/globals.css         Tailwind base + wooden inventory UI theme
lib/                       Web3 provider setup (wagmi/RainbowKit/viem) + WalletProvider
contracts/                 Solidity contract (NullState.sol)
```

---

## Monster Scaling (Phase 5)

Enemy difficulty scales automatically per floor. The configuration lives in
`public/game-engine/monster-config.js` and exposes:

- **`FLOOR_SCALE_FACTOR`** — compound multiplier per floor (default `1.08` = +8%/floor).
- **`floorOverrides`** — per-floor HP/DMG/XP overrides (used for boss floors 5, 10, 15, 20).
- **`hitStop`** — damage thresholds that control freeze duration on hit (0.04s–0.16s).
- **`shake`** — screen-shake amounts per event type (player attack, death, boss kill…).
- **`knockback`** — velocity vectors per weapon-behavior type.
- **`particles`** — burst counts per hit severity.

The helper `window.NS_FLOOR_SCALE(floor)` returns `{hpMul, dmgMul, xpMul}` for any floor.

---

## License

Released under the [MIT License](./LICENSE).

---

**Built on Celo · MiniPay Ready · ERC-20 Marketplace**
