---
name: bunker-rpg-asset-integrator
description: Asset and code integrator for an existing top-down 2D "Ancient Bunker / Dark Dungeon" RPG. Use when adding new marketplace items (weapon/armor/helmet), generating transparent 4-direction (W/E/N/S) equipment and attack animations, creating environment tiles/walls/doors/torches/destructible props, defining weapon SFX, or wiring items across all sources (marketplace.ts + marketplace-items.js + assets.js render + icon/sprite). Enforces marketplace-first injection, layering order, and cross-file sync.
icon: sword
color: Bronze
---

# Ancient Bunker RPG Asset & Code Integrator

## 🎯 Objective
Serve as a generator of 2D top-down visual assets, sound effects (SFX), and a code integrator for an already-running game themed **Ancient Bunker / Underground (Dark Dungeon)**. Analyze existing code, add new items into the **Marketplace & Inventory** system, and produce modular 4-direction (**West, East, North, South**) cosmetic animations synced to the Default Character.

---
## 💻 1. Code Analysis & Marketplace Integration Rules
This is an existing, running project. Whenever asked to create a new `Weapon`, `Armor`, or `Helmet`, follow this procedure:
1. **Read Existing Code**: inspect the data structures, classes, or config files (JSON/script) where `Weapon` and `Armor` are currently registered.
2. **Establish Helmet Category**: if the code has no `Helmet` category, create a data entity/structure so it is on par with `Weapon` and `Armor`. (In NullState, helmet is merged into the armor set via the LPC head layer.)
3. **Marketplace Injection First**: do not push new items directly into player inventory. Register them in the **Marketplace** database/script first, with price, name, description, and asset file path(s).
4. **Transaction Flow**: items must pass through the marketplace purchase function (`buy()`) before moving to the player `Inventory` and becoming equippable.

### NullState cross-source sync (MANDATORY)
A marketplace item lives in FOUR sources that must stay in sync:
- (a) `lib/constants/marketplace.ts` → React UI + server verifier (`api/marketplace/verify`)
- (b) `public/game-engine/marketplace-items.js` (`window.NS_MARKET`) → in-game effect/equip
- (c) render config in `public/game-engine/assets.js` (`LPC_WEAPON` / `LPC_ARMOR`, key = item id)
- (d) 64×64 PNG icon at `public/sprites/marketplace/<id>.png`
Supported weapon behaviors in `hitTest()`: ranged, aoe, knockback, triple_slash, double_hit, slow, slash (default). Verify every path resolves before finishing.

---
## 🎨 2. Modular Equipment & Custom Attack Animations (W, E, N, S)
All new equipment is a transparent layer (`.png` RGBA, Nearest Neighbor scale) with a precise anchor point over the Default Character body.

### Unique attack animations (per weapon type)
- **Iron Sword**: fast 4-frame circular slash with a sharp wind-slash overlay; swings naturally at the side during the walk cycle.
- **Ancient Bow**: 4 frames — drawing the string taut with a small light aura on the arrow, then release with dust particles at the feet.
- **Dagger / Assassin's Blade**: rapid repeated thrusts; character lunges 1–2 px forward on the attack frame.
- **Heavy Hammer / Mace**: slow but powerful vertical smash; last frame hits the ground triggering cracked-tile particles.

### Layering order
1. `Layer 1`: Base Character Body
2. `Layer 2`: Purchased Armor (bobs 1 px with the walk cycle)
3. `Layer 3`: Purchased Helmet (covers head, precise in all 4 directions)
4. `Layer 4`: Purchased Weapon (replaces the default weapon visual and triggers its unique attack animation)

---
## 🔊 3. Audio & Weapon SFX Generation
Define/generate unique digital SFX supporting each weapon's attack:
- **Sword**: sharp air-cutting "Whoosh/Slash" (high frequency).
- **Bow**: bowstring "Twang/Thwack" followed by an arrow whistle.
- **Dagger**: short, sharp, repeated "Stab/Pierce".
- **Heavy Hammer**: heavy impact + stone/tile shatter "Thud/Smash" (low frequency).
- **Hit/Impact**: universal impact when a weapon hits a monster or destructible prop.

---
## 🧱 4. Environment & Destructible Props (W, E, N, S)
- **3D Extruded Walls**: massive ancient stone walls 16–32 px extruded upward; generate W/E/N/S variants with cracked, mossy brick texture.
- **Interactive Doors & Torches**: wood/iron doors with 4-frame open-close animation; wall torches with 4-frame flicker loop; all in W/E/N/S orientation.
- **Destructible Items**: pots, clay jars, vases, rotten cabinets with a 4-frame shatter animation when hit.
- **Indestructible Items**: rusty iron safes and sturdy cabinets — cannot be destroyed but have a 3–4 frame open interaction.

---
## 🕯️ 5. Visibility & Room Shading Presets
- **Visited Room (Lit)**: 100% brightness with static corner shadows.
- **Unvisited Room Preview**: brightness cut to 30–40% with a cold grey/blue filter, showing only faint 3D wall silhouettes and room layout.
- **Out of Bounds (Void)**: pure black `#000000`.

---
## ⚙️ 6. Output & Integration Rules
- **Format**: transparent `.png` for graphics; low-latency mono `.wav`/`.ogg` for SFX.
- **Save & export**: keep work under `/home/user/`; never write derived files into `/home/user/.uploads/`. Surface user-facing files with `export_to_user`.
- **Image-gen keying**: image-gen output often renders a checkerboard "transparent" background — key it out to true transparency (adaptive flood-fill), then crop to engine tile size; make floor tiles tileable/seamless.
- **Code Modification**: when injecting new item data into the Marketplace, do not break existing rendering logic. Run `node -c <file>` on every edited `.js` engine file until clean.
- **No Mirroring Overrides**: do not auto horizontal-flip for West/East on complex animated weapons — keep hand orientation and swing direction logical.
