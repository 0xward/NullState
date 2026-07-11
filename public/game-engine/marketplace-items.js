// marketplace-items.js — NullState OFFCHAIN Marketplace + Equipment + Food config
// ---------------------------------------------------------------------------
// This is a CONFIG-ONLY module (no engine wiring here). It is safe to load on
// its own and exposes everything the game + marketplace UI need via
// window.NS_MARKET. Owner can add new equipment by appending to EQUIPMENT.
//
// Design (agreed in build discussion):
//  • Purchases are paid as a plain ERC20 transfer() of USDT / USDC / USDm on
//    Celo to the TREASURY wallet (NO smart contract needed — confirmed by
//    MiniPay docs). Ownership is recorded OFFCHAIN (Firebase), the payment tx
//    is the on-chain proof and is verified server-side before unlock.
//  • Equipment is PERMANENT (never consumed), can be equipped/unequipped.
//  • Food (loot ids 321–515) is CONSUMABLE: Eat -> heal % of maxHp by rarity.
//  • FX tier drives attack visual richness (higher price = flashier effect).
// ---------------------------------------------------------------------------

(function () {
  'use strict';

  // ── Treasury + accepted tokens (Celo Mainnet 42220) ──────────────────────
  var TREASURY = '0xAb73e0E942ecAAF634216EFb78786fa0F92f2eb6';

  var TOKENS = {
    USDm: { address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18 },
    USDC: { address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', decimals: 6  },
    USDT: { address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', decimals: 6  },
  };

  // ── Equipment slots ──────────────────────────────────────────────────────
  // mainhand = weapon (affects atkDmg + attack FX/behavior)
  // body     = armor  (affects maxHp %)
  var SLOTS = { WEAPON: 'mainhand', ARMOR: 'body' };

  // ── 10 starter items (owner can append more; list is NOT locked) ─────────
  // sprite: path in the repo/GitHub. All 10 icons are 64x64 PNG (RGBA,
  // transparent bg) and live in public/sprites/marketplace/ (added Phase 5.2).
  // effect fields are read by the engine when the item is equipped.
  var EQUIPMENT = [
    // ── ARMOR (body) : hpBonus = fraction added to base maxHp ──
    { id:'leather_guard', name:'Leather Guard', type:'armor', slot:SLOTS.ARMOR,
      price:0.5, fxTier:1, effect:{ hpBonus:0.15 },
      sprite:'/sprites/marketplace/leather_guard.png',
      desc:'+15% Max HP. Worn hide, light but reliable.' },
    { id:'iron_plate', name:'Iron Plate', type:'armor', slot:SLOTS.ARMOR,
      price:1.0, fxTier:1, effect:{ hpBonus:0.25 },
      sprite:'/sprites/marketplace/iron_plate.png',
      desc:'+25% Max HP. Solid forged plating.' },
    { id:'rune_armor', name:'Rune Armor', type:'armor', slot:SLOTS.ARMOR,
      price:2.0, fxTier:2, effect:{ hpBonus:0.40 },
      sprite:'/sprites/marketplace/rune_armor.png',
      desc:'+40% Max HP. Etched with warding runes that shimmer on hit.' },

    // ── WEAPONS (mainhand) : atkBonus adds to Player.atkDmg ──
    { id:'rusty_blade', name:'Rusty Blade', type:'weapon', slot:SLOTS.WEAPON,
      price:0.5, fxTier:1, effect:{ atkBonus:10, behavior:'slash' },
      sprite:'/sprites/marketplace/rusty_blade.png',
      desc:'+10 ATK. A chipped old sword — better than fists.' },
    { id:'hunters_bow', name:"Hunter's Bow", type:'weapon', slot:SLOTS.WEAPON,
      price:1.5, fxTier:2, effect:{ atkBonus:18, behavior:'ranged' },
      sprite:'/sprites/marketplace/hunters_bow.png',
      desc:'+18 ATK, ranged. Fires arrows at distant foes.' },
    { id:'twin_daggers', name:'Twin Daggers', type:'weapon', slot:SLOTS.WEAPON,
      price:2.0, fxTier:2, effect:{ atkBonus:15, behavior:'double_hit' },
      sprite:'/sprites/marketplace/twin_daggers.png',
      desc:'+15 ATK, strikes twice per swing.' },
    { id:'war_axe', name:'War Axe', type:'weapon', slot:SLOTS.WEAPON,
      price:3.5, fxTier:2, effect:{ atkBonus:30, behavior:'knockback' },
      sprite:'/sprites/marketplace/war_axe.png',
      desc:'+30 ATK, heavy knockback on hit.' },
    { id:'ancient_blade', name:'Ancient Blade', type:'weapon', slot:SLOTS.WEAPON,
      price:5.0, fxTier:3, effect:{ atkBonus:40, behavior:'triple_slash' },
      sprite:'/sprites/marketplace/ancient_blade.png',
      desc:'+40 ATK. Three blistering slashes — few foes survive.' },
    { id:'frost_spear', name:'Frost Spear', type:'weapon', slot:SLOTS.WEAPON,
      price:6.0, fxTier:3, effect:{ atkBonus:35, behavior:'slow', slowPct:0.5 },
      sprite:'/sprites/marketplace/frost_spear.png',
      desc:'+35 ATK, chills and slows enemies.' },
    { id:'void_reaper', name:'Void Reaper', type:'weapon', slot:SLOTS.WEAPON,
      price:10.0, fxTier:3, effect:{ atkBonus:60, behavior:'aoe' },
      sprite:'/sprites/marketplace/void_reaper.png',
      desc:'+60 ATK, area-of-effect void slash. The ultimate arm.' },
  ];

  // ── FOOD (consumables) ────────────────────────────────────────────────────
  // Any loot item whose id falls in FOOD_RANGES is edible. Eating heals a % of
  // the player's maxHp scaled by the item's (deterministic) rarity.
  var FOOD_RANGES = [ [321, 515] ]; // owner-tunable; see item_contact_sheet_2
  var FOOD_OPTIONAL_RANGES = [ [1045, 1075] ]; // seafood — disabled by default
  var FOOD_HEAL_BY_RARITY = {
    common:    0.03,  // 3%
    uncommon:  0.035, // 3.5%
    rare:      0.04,  // 4%
    epic:      0.045, // 4.5%
    legendary: 0.05,  // 5%
  };

  function isFood(id) {
    for (var i = 0; i < FOOD_RANGES.length; i++) {
      if (id >= FOOD_RANGES[i][0] && id <= FOOD_RANGES[i][1]) return true;
    }
    return false;
  }
  function foodHealFraction(rarity) {
    return FOOD_HEAL_BY_RARITY[rarity] || FOOD_HEAL_BY_RARITY.common;
  }
  function getEquipment(id) {
    for (var i = 0; i < EQUIPMENT.length; i++) if (EQUIPMENT[i].id === id) return EQUIPMENT[i];
    return null;
  }

  window.NS_MARKET = {
    TREASURY: TREASURY,
    TOKENS: TOKENS,
    SLOTS: SLOTS,
    EQUIPMENT: EQUIPMENT,
    FOOD_RANGES: FOOD_RANGES,
    FOOD_OPTIONAL_RANGES: FOOD_OPTIONAL_RANGES,
    FOOD_HEAL_BY_RARITY: FOOD_HEAL_BY_RARITY,
    isFood: isFood,
    foodHealFraction: foodHealFraction,
    getEquipment: getEquipment,
  };
})();
