# NULL_STATE // Web3 RPG on Celo

> A real-time, top-down dungeon crawler built on Celo. Every meaningful action is a real on-chain transaction. Death is permanent. Your wallet is your weapon.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Built on Celo](https://img.shields.io/badge/Built%20on-Celo-FCFF52)](https://celo.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)

---

## What is NULL_STATE?

NULL_STATE is a pixel-art dungeon crawler that runs directly in the browser — no installs, no app store. Pick a class, descend into a procedurally generated bunker, fight your way through Orc and Skeleton crews, and ride the lift between floors as you push deeper into the depths.

Every NULL_STRIKE costs **0.005 USD Mento*, sent as a real transaction on Celo Mainnet. There's no separate in-game currency to buy — your wallet balance *is* your resource bar.

---

## Gameplay

- **3 playable classes** — Knight, Rogue, and Wizzard, each with their own sprite set and class-flavored attack effects (steel slash, dagger flicker, fire burst).
- **Procedural bunker floors** — square, grid-aligned rooms connected by corridors and doors, generated fresh per floor and cached for the rest of the run so a cleared floor stays cleared if you backtrack.
- **Fog of war** — rooms you haven't entered render fully dark; walking through a door permanently reveals that room for the rest of the run.
- **The Lift** — replaces simple staircases. Approach it to open a floor-select menu: revisit any floor you've already cleared, or push forward to the next one (locked until every hostile on the current floor — including elites and the floor boss — is dead).
- **The Golden Key** — exactly one spawns per run, hidden on a random floor in a random room. If you die before finding it, it relocates. Once collected, it's yours for the rest of the run, ready to be traded with an NPC down the line.
- **Inventory panel** — tracks HP, XP, and collected items at a glance.
- **Permadeath, softened** — dying drops you back at the floor you died on with full HP, rather than sending you back to floor 1. Progress on floors you've already cleared is preserved.
- **NULL_STRIKE** — an on-chain ultimate attack you can trigger against elites, bosses, or when your HP runs critically low.

---

## Tech Stack

| Layer | Stack |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) + React 18 + TypeScript |
| Game engine | Vanilla JS / Canvas2D, mounted into a React component (no game-framework dependency) |
| Styling | Tailwind CSS |
| Web3 | [wagmi](https://wagmi.sh) + [RainbowKit](https://www.rainbow.me/rainbowkit) + [viem](https://viem.sh), targeting Celo Mainnet |
| Contracts | Solidity, deployed with Foundry |
| AI Dungeon Master | [Groq](https://groq.com) SDK |

---

## On-Chain Integration

| | |
|---|---|
| **Network** | Celo Mainnet (Chain ID `42220`) |
| **Currency** | Native CELO — no ERC-20 approval step needed |
| **Action cost** | `0.01 CELO` per dungeon action, sent directly as `msg.value` |
| **Wallet support** | MetaMask, Coinbase Wallet, Rainbow, WalletConnect, and MiniPay (auto-connects on launch) |

The deployed contract address lives in `contracts/NullState.sol` and is configured at deploy time via `deploy.sh` (Foundry-based, with Celoscan auto-verification).

---

## Getting Started

```bash
git clone https://github.com/0xward/NullState.git
cd NullState
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint the project |

### Environment Variables

The app needs a WalletConnect project ID for RainbowKit:

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

---

## Project Structure

```
app/                  Next.js App Router pages (landing page, /game)
components/game/      React wrapper that mounts the canvas engine
public/game-engine/   The actual game engine (dungeon gen, entities, rendering, audio)
public/sprites/       Character, monster, and decoration sprite sheets
contracts/            Solidity contract (NullState.sol)
lib/                  Web3 provider setup (wagmi/RainbowKit) and wallet context
deploy.sh             Foundry deploy + Celoscan verification script
```

---

## License

Released under the [MIT License](./LICENSE).

---

**Built on Celo :: MiniPay Proof of Ship :: AI_DM Powered by Groq**
