# Game Mechanics

## 🏰 Bunker System

NullState has **5 bunkers**, each with **5 procedurally generated floors**.
Floor 5 of every bunker is a boss floor. The sealed Vault door sits on floor 5
of Bunker 5, "The Last Light".

### Bunker Progression

| Bunker | Name | Enemies |
|--------|------|---------|
| 1 | The Treeline Bunker | Beginner |
| 2 | The Sunken Field | Easy |
| 3 | The Frostline Bunker | Medium |
| 4 | The Hollow Market | Hard |
| 5 | The Last Light | Very Hard — holds the Vault |

Enemy difficulty scales two ways: their stats rise with the **floor depth**,
and the **monster roster widens with each bunker**, so later bunkers throw
crews you have not met before.

**Item rarity is not gated by bunker.** Every rarity can drop anywhere from
Bunker 1 onward — what changes is the *container*. Richer containers roll
several times and keep the best result, so a Lost Cache is far likelier to
hand you something legendary than a Supply Crate is, on any floor.

### Progression Rules

- **Must clear all enemies** on a floor before the lift will take you deeper
- **Fog of War** - Rooms you haven't visited are dark
- **Golden Lift** - Travel freely to any floor you have already reached in
  this bunker. Monsters you killed stay dead, containers you emptied stay
  empty, and props you smashed stay broken — the floor is exactly as you
  left it.
- **Permadeath, Softened** - Die = respawn with full HP. Deaths do cost you:
  the shard payout for the run drops 20% per death after the first, down to
  a floor of 40%.

---

## 📦 Container Loot System

Interactive containers — the ones with an **OPEN** button — roll **2-4 loot
slots**. Some slots come up empty, so a container can yield fewer than that.
Breakable props (crates, barrels, urns) are different: smash them and their
loot lands as pickups on the spot.

### How It Works

1. **Open Container** → a two-panel window opens: the container's LOOT on one
   side, YOUR INVENTORY on the other
2. **Take What You Want** → tap a slot to take it, or hit **TAKE ALL**
3. **No Floor Drop** → container loot goes straight to your stash, never onto
   the ground
4. **Stays Emptied** → a container you have looted stays looted for the rest
   of that bunker visit

### Rarity Colors

- ⬜ **Common** (~59%) - Gray
- 🟩 **Uncommon** (~26%) - Green
- 🟦 **Rare** (~11%) - Blue
- 🟪 **Epic** (~3.5%) - Purple
- 🟨 **Legendary** (~0.6%) - Gold

Those are the odds for a **single roll**. Richer containers roll two or three
times and keep the best result, which is what makes a Lost Cache worth far
more than a Supply Crate. An active **Drop-Rate Elixir** adds one extra
keep-the-better roll to everything for 30 minutes.

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

> Burn values are **NullState Point** (off-chain, faucet-only in-game currency — spendable on Marketplace "Swap" purchases, not withdrawable/real money), not USDT. See `docs/rewards-system.md` and `public/game-engine/items.js` for the source of truth.

**Special Items:**
- 📄 **Old Paper (Epic)** - Cannot burn. Tap it in your inventory to read this week's 4-digit vault code.
- 🔑 **Golden Key (Legendary)** - Cannot burn. Opens the sealed vault door in Bunker 5.
- **Both stay in your stash.** They carry between bunkers and survive a Save & Exit — you do not lose them when a run ends. Each is capped at **one per wallet per week** (server-enforced, resets Monday 00:00 UTC).

---

## 🎮 Your Character

You play as the **Knight** — the sole playable character.

- High HP, medium damage
- Steel Slash attack effect

Your power comes from **gear**, not class choice: buy weapons and armour in
the Marketplace, then evolve your weapon with Glitch Shards earned in-run.

---

## ⚡ NULL_STRIKE Ultimate

When your HP drops critically low (or a boss is in range), trigger **NULL_STRIKE** for a powerful all-consuming attack.

- **Cost**: Free — no wallet transaction; gated only by a short cooldown
- **Effect**: Massive damage to elites/bosses

---

## 💾 Your Progress is Safe

**When you click "Save Game", your data is NOT reset.**

- All items saved
- Inventory preserved
- Bunker and floor progress locked in
- Level, XP and equipped gear recorded
- Old Paper and Golden Key stay in your stash

You can close anytime and come back to the same bunker, on the same floor,
with everything you were carrying.

> **Known limitation:** the *floor layout itself* is rebuilt when you return.
> Come back to floor 3 and it is still floor 3 of the same bunker with all
> your loot intact — but the rooms are laid out differently and its monsters
> are back on their feet. Your weekly Old Paper and Golden Key are unaffected;
> those are held per wallet on the server. Tracked in
> [`GAME-DESIGN.md`](./GAME-DESIGN.md) §8.

---

## 📊 Player Stats

Your profile tracks:

- **Level & XP** — your career progression, carried across every run
- **Enemies Killed** — a lifetime total, not a per-run one
- **NullState Point Balance** — from burning items; spendable on Marketplace gear
- **Glitch Shards** (t1/t2/t3) — banked at the end of each bunker, spent on weapon evolution
- **Leaderboard rank** — computed from XP

Your **stablecoin reward history** (vault wins and season bonuses actually
paid out) lives on the Rewards screen rather than the profile.

Level, XP and kills are **cumulative and do not reset** between seasons. What
is seasonal is the Season Pass and the monthly top-3 bonus.

---

*Learn more: [Rewards System](./rewards-system.md) | [Leaderboard](./leaderboard.md)*
