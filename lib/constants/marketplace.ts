/**
 * Marketplace items — TypeScript source of truth for the React Marketplace UI
 * and the server-side purchase verifier. Mirrors public/game-engine/
 * marketplace-items.js (the in-canvas engine copy). Owner can append items
 * here + drop the sprite in /public/sprites/marketplace/ — the list is NOT
 * locked. Prices are in USD (paid 1:1 in USDm/USDC/USDT).
 *
 * All 10 sprites are generated 64x64 PNG icons (RGBA, transparent bg) and
 * already live in public/sprites/marketplace/ (Phase 5.2 — see naming below).
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
  fxTier: 1 | 2 | 3
  effect: {
    atkBonus?: number
    hpBonus?: number      // fraction, e.g. 0.4 = +40% max HP
    behavior?: string
    slowPct?: number
  }
  sprite: string
  desc: string
}

export const MARKETPLACE_ITEMS: MarketplaceItem[] = [
  // ── ARMOR ──
  { id:'leather_guard', name:'Leather Guard', type:'armor', slot:'body', price:0.5, fxTier:1,
    effect:{ hpBonus:0.15 }, sprite:'/sprites/marketplace/leather_guard.png',
    desc:'+15% Max HP. Worn hide, light but reliable.' },
  { id:'iron_plate', name:'Iron Plate', type:'armor', slot:'body', price:1.0, fxTier:1,
    effect:{ hpBonus:0.25 }, sprite:'/sprites/marketplace/iron_plate.png',
    desc:'+25% Max HP. Solid forged plating.' },
  { id:'rune_armor', name:'Rune Armor', type:'armor', slot:'body', price:2.0, fxTier:2,
    effect:{ hpBonus:0.40 }, sprite:'/sprites/marketplace/rune_armor.png',
    desc:'+40% Max HP. Etched with warding runes.' },
  // ── WEAPONS ──
  { id:'rusty_blade', name:'Rusty Blade', type:'weapon', slot:'mainhand', price:0.5, fxTier:1,
    effect:{ atkBonus:10, behavior:'slash' }, sprite:'/sprites/marketplace/rusty_blade.png',
    desc:'+10 ATK. A chipped old sword.' },
  { id:'hunters_bow', name:"Hunter's Bow", type:'weapon', slot:'mainhand', price:1.5, fxTier:2,
    effect:{ atkBonus:18, behavior:'ranged' }, sprite:'/sprites/marketplace/hunters_bow.png',
    desc:'+18 ATK, ranged. Fires arrows at distant foes.' },
  { id:'twin_daggers', name:'Twin Daggers', type:'weapon', slot:'mainhand', price:2.0, fxTier:2,
    effect:{ atkBonus:15, behavior:'double_hit' }, sprite:'/sprites/marketplace/twin_daggers.png',
    desc:'+15 ATK, strikes twice per swing.' },
  { id:'war_axe', name:'War Axe', type:'weapon', slot:'mainhand', price:3.5, fxTier:2,
    effect:{ atkBonus:30, behavior:'knockback' }, sprite:'/sprites/marketplace/war_axe.png',
    desc:'+30 ATK, heavy knockback on hit.' },
  { id:'ancient_blade', name:'Ancient Blade', type:'weapon', slot:'mainhand', price:5.0, fxTier:3,
    effect:{ atkBonus:40, behavior:'triple_slash' }, sprite:'/sprites/marketplace/ancient_blade.png',
    desc:'+40 ATK. Three blistering slashes.' },
  { id:'frost_spear', name:'Frost Spear', type:'weapon', slot:'mainhand', price:6.0, fxTier:3,
    effect:{ atkBonus:35, behavior:'slow', slowPct:0.5 }, sprite:'/sprites/marketplace/frost_spear.png',
    desc:'+35 ATK, chills and slows enemies.' },
  { id:'void_reaper', name:'Void Reaper', type:'weapon', slot:'mainhand', price:10.0, fxTier:3,
    effect:{ atkBonus:60, behavior:'aoe' }, sprite:'/sprites/marketplace/void_reaper.png',
    desc:'+60 ATK, area-of-effect void slash.' },
]

export function getMarketplaceItem(id: string): MarketplaceItem | undefined {
  return MARKETPLACE_ITEMS.find(i => i.id === id)
}

export const ACCEPTED_TOKENS = Object.keys(MARKETPLACE_TOKENS) as MarketplaceTokenSymbol[]
export { MARKETPLACE_TOKENS, TREASURY_WALLET }
export type { MarketplaceTokenSymbol }
