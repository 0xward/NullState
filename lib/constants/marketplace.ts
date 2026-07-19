/**
 * Marketplace items — TypeScript source of truth for the React Marketplace UI
 * and the server-side purchase verifier. Mirrors public/game-engine/
 * marketplace-items.js (the in-canvas engine copy). Owner can append items
 * here + drop the sprite in /public/sprites/marketplace/ — the list is NOT
 * locked. Prices are in USD (paid 1:1 in USDm/USDC/USDT).
 *
 * Every icon is a 64x64 RGBA PNG in public/sprites/marketplace/. Since v76 the
 * weapon icon art is ALSO the sprite the hero holds (public/sprites/weapons/
 * <id>.png is the same artwork rotated to a canonical grip-down pose), so the
 * shop preview and the equipped weapon can never drift apart.
 */
import { MARKETPLACE_TOKENS, TREASURY_WALLET, type MarketplaceTokenSymbol } from './tokens'

// Phase 9 adds a THIRD equipment slot for pure cosmetics ('outfit'). Outfits
// change ONLY how the Knight looks (an LPC sprite layer — see assets.js
// LPC_OUTFIT) and carry ZERO gameplay effect; the discriminated union below
// enforces "no stats on an outfit" at COMPILE TIME.
export type EquipmentType = 'weapon' | 'armor' | 'outfit'
export type EquipmentSlot = 'mainhand' | 'body' | 'outfit'

// Weapon Evolution (Phase 4, blueprint §3). A weapon is bought once at its
// base tier (tier 1) then leveled with Glitch Shards. Each entry describes ONE
// upgrade step: evolutionTiers[0] = tier1->2, evolutionTiers[1] = tier2->3.
// The array is built deterministically from the weapon's fxTier/fxColor/
// atkBonus (see buildWeaponEvolution) so the owner only tunes base stats.
export interface WeaponEvolutionTier {
  materialsRequired: { t1?: number; t2?: number; t3?: number } // shards for THIS step
  atkBonusDelta: number      // ATK added on top of base (ADDITIVE, never HP)
  spriteOverrideTint?: string // -> NS_WEAPON.ovlTint at runtime (hex)
  fxColorOverride?: string    // -> player._fxColor swing-FX color (hex)
  glowOverride?: string       // -> NS_WEAPON.glow premium aura (hex)
  unlockUtility?: 'grapple' | 'melt_wall' // DEFER to Phase 8 — data only, no runtime effect yet
}

// Fields common to every marketplace entry (weapon, armor, or cosmetic outfit).
interface MarketplaceItemBase {
  id: string
  name: string
  price: number          // USD
  tokenPrice?: number    // NullState Point price (off-chain swap) — only set
                         // for items $0.5–$2 (Phase 5.5 #8). Items without
                         // this field can only be bought with real
                         // USDm/USDC/USDT, never swapped for tokens.
  fxTier: 1 | 2 | 3      // drives shop-card glow richness (higher price = flashier)
  sprite: string
  desc: string
}

// Weapons & armor: they carry gameplay stats, and weapons carry an evolution
// ladder (Phase 4). This is the ONLY item shape allowed to hold an `effect`.
export interface GearItem extends MarketplaceItemBase {
  type: 'weapon' | 'armor'
  slot: 'mainhand' | 'body'
  fxColor?: string       // v67 T11: per-weapon attack-FX color (hex). Read by
                         // the engine (entities.js swing arcs, game.js arrows)
                         // via the marketplace-items.js mirror. Weapons only.
  effect: {
    atkBonus?: number
    hpBonus?: number      // fraction, e.g. 0.4 = +40% max HP
    behavior?: string
    slowPct?: number
  }
  evolutionTiers?: WeaponEvolutionTier[] // weapons only; empty for armor
}

// Phase 9 — Cosmetic Skin. A skin is a NEW LPC sprite LAYER (assets.js
// LPC_OUTFIT, keyed by the item id) with ZERO gameplay effect: the HP-100 cap
// and combat balance are untouched, there is no pay-to-win. The type FORBIDS
// atkBonus/hpBonus/behavior — `effect` is the empty object and `fxColor`/
// `evolutionTiers` are `never`, so TS rejects any attempt to give a skin stats.
// `skinTint` is a purely-cosmetic flex colour (UI only, never combat).
export interface OutfitItem extends MarketplaceItemBase {
  type: 'outfit'
  slot: 'outfit'
  effect: Record<string, never> // no stats — enforced by the type
  skinTint?: string
  fxColor?: never
  evolutionTiers?: never
}

export type MarketplaceItem = GearItem | OutfitItem

// ── Phase 4 evolution tuning (owner decisions 2026-07-19) ────────────────────
// Q1: shard cost per upgrade step (tier1->2, tier2->3), paid in shards of the
// weapon's own fxTier. Q2: each step adds this fraction of the weapon's base
// atkBonus (additive, no monster rebalance for MVP).
export const EVOLUTION_SHARD_COSTS = [8, 14] as const
export const EVOLUTION_ATK_DELTA_PCT = 0.20

// Brighten a hex color toward white by `amt` (0..1) — evolved tiers glow hotter.
function brightenHex(hex: string, amt: number): string {
  const h = (hex || '#ffffff').replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amt)
  const to2 = (c: number) => (isNaN(c) ? 255 : mix(c)).toString(16).padStart(2, '0')
  return `#${to2(r)}${to2(g)}${to2(b)}`
}

// Phase 8: reaching a weapon's MAX tier can grant a traversal utility that
// opens sealed caches in the dungeon (props.js cache_grapple / cache_melt).
// Only a few top-tier weapons grant one, so the ability is an aspirational
// end-of-ladder reward. Keys must match the engine's sealedUtility values.
export const UTILITY_AT_MAX_TIER: Record<string, 'grapple' | 'melt_wall'> = {
  void_katana: 'grapple',
  sunfire_bow: 'grapple',
  verdant_reaper: 'melt_wall',
  ancient_blade: 'melt_wall',
}

// Build the evolution ladder for a weapon. maxTier = max(2, fxTier) so every
// weapon evolves at least once; a fxTier-3 weapon can reach tier 3 (two steps).
export function buildWeaponEvolution(item: MarketplaceItem): WeaponEvolutionTier[] {
  if (item.type !== 'weapon') return []
  const maxTier = Math.max(2, item.fxTier)
  const steps = maxTier - 1
  const shardKey = (`t${item.fxTier}`) as 't1' | 't2' | 't3'
  const baseAtk = item.effect.atkBonus || 0
  const delta = Math.max(1, Math.round(baseAtk * EVOLUTION_ATK_DELTA_PCT))
  const fx = item.fxColor || '#ffffff'
  const util = UTILITY_AT_MAX_TIER[item.id]
  const tiers: WeaponEvolutionTier[] = []
  for (let i = 0; i < steps; i++) {
    const cost = EVOLUTION_SHARD_COSTS[i] ?? EVOLUTION_SHARD_COSTS[EVOLUTION_SHARD_COSTS.length - 1]
    const materialsRequired: { t1?: number; t2?: number; t3?: number } = {}
    materialsRequired[shardKey] = cost
    const tier: WeaponEvolutionTier = {
      materialsRequired,
      atkBonusDelta: delta,
      spriteOverrideTint: brightenHex(fx, 0.20 + 0.20 * i),
      fxColorOverride: brightenHex(fx, 0.30 + 0.25 * i),
      glowOverride: fx, // premium aura in the weapon's signature color
    }
    if (util && i === steps - 1) tier.unlockUtility = util // granted at MAX tier only
    tiers.push(tier)
  }
  return tiers
}

// Highest tier a weapon can reach (base tier is 1).
export function maxWeaponTier(item: MarketplaceItem): number {
  return 1 + (item.evolutionTiers?.length || 0)
}

// NullState Point swap rate: 6000 tokens per $1 (e.g. $0.5 = 3000 tokens,
// $2 = 12000 tokens). Only items priced $0.5–$2 are swap-eligible.
export const TOKEN_SWAP_RATE_PER_USD = 6000
export const TOKEN_SWAP_MAX_PRICE_USD = 2

const BASE_MARKETPLACE_ITEMS: MarketplaceItem[] = [
  // ── ARMOR ── ($0.5-$2 items also get tokenPrice — swappable for NullState Point)
  { id:'leather_guard', name:'Leather Guard', type:'armor', slot:'body', price:0.5, tokenPrice:3000, fxTier:1,
    effect:{ hpBonus:0.15 }, sprite:'/sprites/marketplace/leather_guard.png',
    desc:'+15% Max HP. Worn hide, light but reliable.' },
  { id:'iron_plate', name:'Iron Plate', type:'armor', slot:'body', price:1.0, tokenPrice:6000, fxTier:1,
    effect:{ hpBonus:0.25 }, sprite:'/sprites/marketplace/iron_plate.png',
    desc:'+25% Max HP. Solid forged plating.' },
  { id:'rune_armor', name:'Rune Armor', type:'armor', slot:'body', price:3.0, fxTier:2,
    effect:{ hpBonus:0.40 }, sprite:'/sprites/marketplace/rune_armor.png',
    desc:'+40% Max HP. Etched with warding runes that shimmer on hit.' },
  // ── WEAPONS (v76 Task #7) ── cheapest -> dearest. Mirrors
  // public/game-engine/marketplace-items.js exactly; keep both in sync.
  { id:'rusty_blade', name:'Rusty Blade', type:'weapon', slot:'mainhand', price:0.5, tokenPrice:3000, fxTier:1, fxColor:'#d8dde2',
    effect:{ atkBonus:10, behavior:'slash' }, sprite:'/sprites/marketplace/rusty_blade.png',
    desc:'+10 ATK. A chipped old sword — better than fists.' },
  { id:'emberwood_maul', name:'Emberwood Maul', type:'weapon', slot:'mainhand', price:2.0, tokenPrice:12000, fxTier:2, fxColor:'#d98a4a',
    effect:{ atkBonus:18, behavior:'knockback' }, sprite:'/sprites/marketplace/emberwood_maul.png',
    desc:'+18 ATK. Spiked emberwood — every blow sends foes flying.' },
  { id:'ironbolt_crossbow', name:'Ironbolt Crossbow', type:'weapon', slot:'mainhand', price:3.0, fxTier:2, fxColor:'#e0b25a',
    effect:{ atkBonus:24, behavior:'ranged' }, sprite:'/sprites/marketplace/ironbolt_crossbow.png',
    desc:'+24 ATK, ranged. Punches a heavy bolt clean through the dark.' },
  { id:'argent_waraxe', name:'Argent Waraxe', type:'weapon', slot:'mainhand', price:4.0, fxTier:2, fxColor:'#cfd8e3',
    effect:{ atkBonus:30, behavior:'cleave' }, sprite:'/sprites/marketplace/argent_waraxe.png',
    desc:'+30 ATK. A broad silver bite that cleaves everything in the arc.' },
  { id:'ancient_blade', name:'Ancient Blade', type:'weapon', slot:'mainhand', price:5.0, fxTier:3, fxColor:'#ffd24a',
    effect:{ atkBonus:40, behavior:'double_hit' }, sprite:'/sprites/marketplace/ancient_blade.png',
    desc:'+40 ATK. Two blistering slashes — few foes survive.' },
  { id:'frost_spear', name:'Frost Spear', type:'weapon', slot:'mainhand', price:6.0, fxTier:3, fxColor:'#bdeeff',
    effect:{ atkBonus:35, behavior:'slow', slowPct:0.5 }, sprite:'/sprites/marketplace/frost_spear.png',
    desc:'+35 ATK, chills and slows enemies.' },
  { id:'verdant_reaper', name:'Verdant Reaper', type:'weapon', slot:'mainhand', price:10.0, fxTier:3, fxColor:'#57e389',
    effect:{ atkBonus:60, behavior:'aoe' }, sprite:'/sprites/marketplace/verdant_reaper.png',
    desc:'+60 ATK. A wide living arc that reaps everything around you.' },
  { id:'void_katana', name:'Voidedge Katana', type:'weapon', slot:'mainhand', price:12.0, fxTier:3, fxColor:'#b46bff',
    effect:{ atkBonus:70, behavior:'triple_slash' }, sprite:'/sprites/marketplace/void_katana.png',
    desc:'+70 ATK. Three void-lit cuts land before the first is seen.' },
  { id:'sunfire_bow', name:'Sunfire Longbow', type:'weapon', slot:'mainhand', price:15.0, fxTier:3, fxColor:'#ffcf3d',
    effect:{ atkBonus:80, behavior:'volley' }, sprite:'/sprites/marketplace/sunfire_bow.png',
    desc:'+80 ATK, ranged. Looses a fan of three sunfire arrows.' },
  // ── SKINS (outfit) — Phase 9 cosmetics ── PURE VISUALS, zero stats. Each is a
  // distinct LPC clothing/armour layer set (assets.js LPC_OUTFIT) drawn over the
  // body; `effect` MUST stay empty (the type forbids stats). The skin only
  // changes how the Knight LOOKS — the game is fully playable without any of
  // them (the FREE default outfit renders exactly as before when none is worn).
  // Icons in public/sprites/marketplace/<id>.png are composited from the SAME
  // LPC layers the skin renders, so the shop preview == what you wear.
  { id:'ashen_warden', name:'Ashen Warden', type:'outfit', slot:'outfit', price:5.0, fxTier:2, skinTint:'#8f95a0',
    effect:{}, sprite:'/sprites/marketplace/ashen_warden.png',
    desc:'Cosmetic only. Ash-grey full plate — a silent sentinel of the bunkers.' },
  { id:'emberguard', name:'Emberguard', type:'outfit', slot:'outfit', price:7.0, fxTier:3, skinTint:'#c85a1e',
    effect:{}, sprite:'/sprites/marketplace/emberguard.png',
    desc:'Cosmetic only. Ember-forged warden leathers with a warm coal glow.' },
  { id:'voidweave', name:'Voidweave', type:'outfit', slot:'outfit', price:9.0, fxTier:3, skinTint:'#6a24b0',
    effect:{}, sprite:'/sprites/marketplace/voidweave.png',
    desc:'Cosmetic only. A hooded violet weave that drinks the dark around you.' },
  { id:'sungild', name:'Sungild Regalia', type:'outfit', slot:'outfit', price:10.0, fxTier:3, skinTint:'#e0b23a',
    effect:{}, sprite:'/sprites/marketplace/sungild.png',
    desc:'Cosmetic only. Gilded champion regalia that catches every torchlight.' },
]

// Attach the Phase 4 evolution ladder to every weapon (armor stays as-is).
// Keep this the single source of truth the upgrade route reads; the engine
// copy (public/game-engine/marketplace-items.js) mirrors the same rules.
export const MARKETPLACE_ITEMS: MarketplaceItem[] = BASE_MARKETPLACE_ITEMS.map(item =>
  item.type === 'weapon' ? { ...item, evolutionTiers: buildWeaponEvolution(item) } : item,
)

// Pre-v76 ids for weapons re-skinned in Task #7. Read-side alias so a wallet
// that bought the old item still resolves to its replacement; nothing writes
// these ids back. Items deleted outright (void_reaper, hunters_bow,
// ancient_aegis, warden_plate) have no replacement and are intentionally absent.
export const LEGACY_ITEM_IDS: Record<string, string> = {
  voidcaller_scythe: 'sunfire_bow',
  ancient_warblade: 'void_katana',
  war_axe: 'argent_waraxe',
  twin_daggers: 'emberwood_maul',
}

export function resolveItemId(id: string): string {
  return LEGACY_ITEM_IDS[id] || id
}

export function getMarketplaceItem(id: string): MarketplaceItem | undefined {
  const rid = resolveItemId(id)
  return MARKETPLACE_ITEMS.find(i => i.id === rid)
}

export const ACCEPTED_TOKENS = Object.keys(MARKETPLACE_TOKENS) as MarketplaceTokenSymbol[]
export { MARKETPLACE_TOKENS, TREASURY_WALLET }
export type { MarketplaceTokenSymbol }
