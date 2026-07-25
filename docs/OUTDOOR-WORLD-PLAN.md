# Outdoor World — Implementation Plan

> **Status: PLAN ONLY — not built.** Captures the design so it survives across
> sessions. Companion to [`WORLD-MAP-HUB-PLAN.md`](./WORLD-MAP-HUB-PLAN.md),
> which covers the map hub this world hangs off.

## 0. What this is

Beyond the five story bunkers, the map gains **small outdoor zones** the player
enters to **gather** — chop trees, break rocks, pick berries. They are not open
worlds: each is a compact area you enter, work, and leave. Availability is
**scheduled** (some daily, some 2–3× a week) and some only open after you finish
something elsewhere, so the map has a rhythm instead of being static.

Reference: Last Day on Earth's global map. Top-down, dark, same lighting rules
as the bunkers — you only see what's near you.

## 1. Why this is cheaper than it looks

Most of the mechanics already exist in the engine. This adds a **new scene
type** on top of a running machine; it is not a rewrite.

| Need | Status |
|---|---|
| Chop tree / break rock → drop loot | **Exists.** `props.js` defines breakables with HP + weighted loot tables (`barrel hp:2`, `wardrobe hp:3`, `column hp:3`). A tree is `{hp:3, loot:[['wood',2,80]]}`; a rock is `{hp:4, loot:[['stone',2,70],['diamond',1,5]]}` |
| Berry that heals on pickup | **Exists.** `['hp',6,50]` is already a loot kind |
| Top-down movement + collision | **Exists.** Tile system (`TILE=40`) and solid tiles in `dungeon.js` |
| Inventory, crafting, materials | **Exists** |
| Light pool around the character | **Exists in the bunkers** — reuse the same treatment outdoors |

**Genuinely new work:**
1. Pannable map (drag) with region unlock state
2. An outdoor zone *generator* — open clearings instead of rooms + corridors
3. Tilesets per biome (art)
4. Resource item types + how they feed crafting
5. A schedule: when each zone opens and closes
6. Mission hooks (a zone opens because a mission says so)

## 2. Zone model

A zone is small and purposeful — think one screen or a few, not a world.

```
{ id, name, biome, size,
  nodes:   [ { type:'tree'|'rock'|'berry'|'crate', count } ],
  hazard:  [ { enemy, count } ],       // optional — some zones are quiet
  schedule: { … see §4 },
  unlock:  { … see §5 },
  exit:    'walk to the edge'          // same pattern the outdoor scene uses now
}
```

**Biomes** (dark throughout — only the area near the player is lit):
- `frost` — snow, dead pines, cracked ice
- `abyss` — purple void stone, floating debris
- `dunes` — night desert, wind, buried ruins
- `marsh` — drowned ruins, shallow black water
- `quarry` — broken rock faces, ore veins

## 3. Resources & tools

| Node | Tool | Yields |
|---|---|---|
| Tree | Axe | Wood (common), Resin (rare) |
| Rock | Pickaxe | Stone (common), **Diamond** (rare) |
| Berry bush | — | Heals on pickup, no inventory slot |
| Crate | — | Existing loot table |

Open questions: do tools have **durability** (LDoE does, and it's what keeps
players gathering)? Do resources feed **existing** crafting (Glitch Shards) or a
new track? Decide before building — it changes the economy.

## 4. Schedule — the thing that brings players back

Each zone carries a schedule. Three shapes cover everything discussed:

- `daily` — open every day for a window (e.g. 06:00–22:00 UTC)
- `weekly` — open on set days (e.g. Mon / Wed / Sat)
- `event` — a limited run with an end time, then it disappears entirely

LDoE's lesson: when a timed location expires, **the location and everything in
it disappears**, and every timer lives in one **Calendar** view so players can
plan. Worth copying — a visible "opens in 4h" is a reason to come back.

**Server-authoritative.** The schedule must be computed server-side, not from
the device clock, or changing the phone's time unlocks everything.

## 5. Unlocking

Two independent gates, both shown on the map (never hidden — say the condition,
LDoE-style):

- **Progress** — clear bunker N, reach level N, own item X
- **Mission** — finishing a mission opens a zone; some missions only exist while
  a zone is open

## 6. Map: from static image to pannable world

The hub today is one fixed image. This turns it into a world you can drag
around, with the bunkers as one region and outdoor zones filling the rest.

- Drag to pan, clamped to the world bounds; pinch/zoom is optional and probably
  not worth it on cheap phones
- Locked regions stay under fog with their condition stated
- The map art becomes a **grid of tiles** rather than one file, so it can grow
  without re-generating everything and phones only fetch what they look at

## 7. Phasing

Ordered so each phase is playable on its own and nothing is wasted.

- **Phase A — Pannable map.** Drag + bounds + region unlock state. No new zones
  yet. Small, and it makes room for everything after.
- **Phase B — One gather zone.** A single biome, trees + rocks + berries, always
  open. This is where the zone generator and the outdoor tileset get built.
  Proves the loop before multiplying it.
- **Phase C — Schedule.** Server-side open/close, the Calendar view, "opens in
  Xh" on locked zones.
- **Phase D — Missions.** Mission → zone unlock, and zone-limited missions.
- **Phase E — More biomes.** Now it's mostly art plus a config entry each.

## 8. Honest risks

- **Scope.** This is the largest thing on the roadmap. Phase B alone (generator
  + tileset + node types) is a real chunk of work.
- **Fit with MiniPay.** MiniPay's audience wants short sessions on cheap phones.
  Zones must stay **small and quick** — enter, gather, leave in a couple of
  minutes. If a zone becomes a 15-minute expedition, it fights the channel.
- **Art volume.** Each biome needs a tileset, not just a backdrop.
- **Economy.** New resources can quietly break crafting balance. Decide what
  they feed (§3) before the first drop table is written.
- **Don't block listing on this.** Ship the listing with what exists; this is
  the content that keeps players afterwards.

## 9. Open decisions

1. Tool durability — yes or no?
2. New resources feed existing crafting, or their own track?
3. Do zones cost energy to enter (LDoE's rate-limiter), or are they free?
4. Are zones combat-free (pure gathering) or do some carry enemies?
5. Zone size — one screen, or a few screens to walk across?

---

_Plan only. Nothing here is implemented. Phase A is the smallest useful start._
