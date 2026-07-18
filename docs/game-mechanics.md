# Game Mechanics

## 🏰 Bunker System

NullState features **6 procedurally generated bunkers**, each with **3 floors**. Progress deeper to unlock rarer items.

### Bunker Progression

| Bunker | Enemy Difficulty | Items Available | New Items |
|--------|------------------|-----------------|----------|
| 1 | Beginner | Common only | Tier 1 Base |
| 2 | Easy | Common + Uncommon | Tier 2 Unlocked |
| 3 | Medium | + Rare | Tier 3 Unlocked |
| 4 | Hard | + Epic | Tier 4 Unlocked |
| 5 | Very Hard | + Legendary | Tier 5 Unlocked |
| 6 | Extreme | All rarities | Tier 6 (Final) |

### Progression Rules

- **Must clear all enemies** on a floor before descending to next bunker
- **Fog of War** - Rooms you haven't visited are dark
- **Golden Lift** - Revisit cleared floors or push forward
- **Permadeath, Softened** - Die = respawn on same floor with full HP

---

## 📦 Container Loot System

When you open a container, you get **3-8 random items** loading left-to-right over ~2.5 seconds.

### How It Works

1. **Open Container** → Animation starts
2. **Items Load** → See each item appear with rarity glow
3. **Auto to Inventory** → Items go straight to your inventory
4. **No Floor Drop** → Items never lie on ground

### Rarity Colors

- 🟩 **Common** (40%) - Gray
- 🟩 **Uncommon** (30%) - Green  
- 🟦 **Rare** (20%) - Blue
- 🟪 **Epic** (8%) - Purple
- 🟨 **Legendary** (2%) - Gold

---

## 🎯 Item Rarity & Values

Each item has a hidden burn value (random within its rarity range):

| Rarity | Burn Value (NullState Point) | Can Burn? |
|--------|-----------|----------|
| Common | N/A | ❌ NO |
| Uncommon | 10 - 50 | ✅ YES |
| Rare | 50 - 150 | ✅ YES |
| Epic | 150 - 350 | ✅ YES |
| Legendary | 350 - 500 | ✅ YES |

> Burn values are **NullState Point** (off-chain, faucet-only in-game currency — spendable on Marketplace "Swap" purchases, not withdrawable/real money), not USDm. See `docs/rewards-system.md` and `public/game-engine/items.js` for the source of truth.

**Special Items:**
- 📄 **Paper (Epic)** - Cannot burn, contains vault code
- 🔑 **Golden Key (Legendary)** - Cannot burn, opens vault
- Both disappear after run ends

---

## 🎮 Classes

### Knight
- High HP, medium damage
- Steel Slash attack effect
- Best for tank gameplay

### Rogue  
- Medium HP, high damage
- Dagger Flicker attack effect
- Best for fast combat

### Wizzard
- Low HP, magic damage
- Fire Burst attack effect
- Best for ranged combat

---

## ⚡ NULL_STRIKE Ultimate

When your HP drops critically low (or you want to gamble), trigger **NULL_STRIKE** for a powerful all-consuming attack.

- **Cost**: Real on-chain transaction
- **Effect**: Massive damage to elites/bosses
- **Risk**: If it fails, you lose

---

## 💾 Your Progress is Safe

**When you click "Save Game", your data is NOT reset.**

- All items saved
- Inventory preserved  
- Bunker progress locked in
- Stats recorded

You can close anytime and return exactly where you left off. Your game is persistent and yours alone.

---

## 📊 Player Stats

Your profile tracks:

- **Total Items Collected** (lifetime)
- **Total USDm Earned** (from Vault Quest + Season bonuses)
- **NullState Point Balance** (from burning items — spendable on Marketplace gear)
- **Enemies Killed** (combat metric)
- **Days Active** (loyalty metric)
- **Current Rank** (monthly leaderboard position)

*Stats reset monthly for seasonal competition.*

---

*Learn more: [Rewards System](./rewards-system.md) | [Leaderboard](./leaderboard.md)*
