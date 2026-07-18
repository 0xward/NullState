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

export type EquipmentType = 'weapon' | 'armor'
export type EquipmentSlot = 'mainhand' | 'body'

export interface MarketplaceItem {
  id: string
  name: string
  type: EquipmentType
  slot: EquipmentSlot
  price: number          // USD
  tokenPrice?: number    // NullState Point price (off-chain swap) — only set
                         // for items $0.5–$2 (Phase 5.5 #8). Items without
                         // this field can only be bought with real
                         // USDm/USDC/USDT, never swapped for tokens.
  fxTier: 1 | 2 | 3
  fxColor?: string       // v67 T11: per-weapon attack-FX color (hex). Read by
                         // the engine (entities.js swing arcs, game.js arrows)
                         // via the marketplace-items.js mirror. Weapons only.
  effect: {
    atkBonus?: number
    hpBonus?: number      // fraction, e.g. 0.4 = +40% max HP
    behavior?: string
    slowPct?: number
  }
  sprite: string
  desc: string
}

// NullState Point swap rate: 6000 tokens per $1 (e.g. $0.5 = 3000 tokens,
// $2 = 12000 tokens). Only items priced $0.5–$2 are swap-eligible.
export const TOKEN_SWAP_RATE_PER_USD = 6000
export const TOKEN_SWAP_MAX_PRICE_USD = 2

export const MARKETPLACE_ITEMS: MarketplaceItem[] = [
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
]

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
