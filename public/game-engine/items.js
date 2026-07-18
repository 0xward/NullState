// items.js — NullState item/loot system
// Maps the 1244 icons in /sprites/items/library/item{1..1244}.png into real,
// nameable, valuable items. Everything here is deterministic from the item's
// numeric id, so the same id always produces the same rarity/name/value.
//
// Loaded BEFORE props.js and game.js (see ENGINE_SCRIPTS in DungeonGame.tsx).
// Exposes: window.NS_ITEMS = { ITEM_COUNT, RARITIES, getItem(id), rollItemDrop(tier) }

(function(){
  'use strict';

  var ITEM_COUNT = 1244;

  // Burn values are NullState Point (off-chain, faucet-only in-game asset —
  // NOT real USDm anymore, see Phase 5.5 #8). Whole-number token amounts,
  // rolled per-item within each rarity's range. stackCap limits how many of
  // one item a player can hold.
  var RARITIES = {
    common:    { weight: 100, burnMin: 1,   burnMax: 5,   stackCap: 99, color: '#9aa0a6' },
    uncommon:  { weight: 45,  burnMin: 10,  burnMax: 50,  stackCap: 60, color: '#4ade80' },
    rare:      { weight: 18,  burnMin: 50,  burnMax: 150, stackCap: 30, color: '#38bdf8' },
    epic:      { weight: 6,   burnMin: 150, burnMax: 350, stackCap: 12, color: '#c084fc' },
    legendary: { weight: 1,   burnMin: 350, burnMax: 500, stackCap: 5,  color: '#facc15' },
  };
  var RARITY_ORDER = ['common','uncommon','rare','epic','legendary'];

  // Small deterministic hash (mulberry32-ish) — same id always -> same float.
  function hashId(id, salt){
    var h = (id * 2654435761 + (salt||0) * 40503) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967295;
  }

  var NAME_PREFIX = ['Warded','Cracked','Gilded','Hollow','Ashen','Sunken','Forgotten','Runed',
    'Rusted','Blessed','Cursed','Dim','Bright','Silent','Screaming','Withered','Frozen','Ember',
    'Void-touched','Sacred','Rotten','Polished','Jagged','Faded','Radiant'];
  var NAME_NOUN = ['Sigil','Shard','Idol','Relic','Talisman','Charm','Emblem','Fragment','Coin',
    'Trinket','Icon','Rune','Amulet','Effigy','Token','Vessel','Seal','Medallion','Figurine','Core'];

  function rarityForId(id){
    var r = hashId(id, 1);
    var acc = 0, total = 0;
    for (var i=0;i<RARITY_ORDER.length;i++) total += RARITIES[RARITY_ORDER[i]].weight;
    var roll = r * total;
    for (i=0;i<RARITY_ORDER.length;i++){
      acc += RARITIES[RARITY_ORDER[i]].weight;
      if (roll <= acc) return RARITY_ORDER[i];
    }
    return 'common';
  }

  function nameForId(id, rarity){
    var pre = NAME_PREFIX[Math.floor(hashId(id,2) * NAME_PREFIX.length)];
    var noun = NAME_NOUN[Math.floor(hashId(id,3) * NAME_NOUN.length)];
    var num = String(id).padStart(4,'0');
    return pre + ' ' + noun + ' #' + num;
  }
  // Short display name — just the noun (e.g. "Relic", "Shard"), no prefix
  // and no id number. The grid cards are too small/dense to read the full
  // flavor name ("Withered Trinket #0332" wraps/overlaps), so cards show
  // this instead; the full name is still shown in the item zoom/detail
  // popup where there's room for it (see openItemZoom() in game.js).
  function shortNameForId(id){
    return NAME_NOUN[Math.floor(hashId(id,3) * NAME_NOUN.length)];
  }

  function burnValueForId(id, rarity){
    var cfg = RARITIES[rarity];
    var t = hashId(id, 4);
    var v = cfg.burnMin + t * (cfg.burnMax - cfg.burnMin);
    // whole NullState Point units — no decimals
    return Math.max(1, Math.round(v));
  }

  var _cache = Object.create(null);

  function getItem(id){
    id = ((id - 1) % ITEM_COUNT) + 1; // wrap into valid icon range, 1-indexed
    if (_cache[id]) return _cache[id];
    var rarity = rarityForId(id);
    var item = {
      id: id,
      icon: '/sprites/items/library/item' + id + '.png',
      name: nameForId(id, rarity),
      shortName: shortNameForId(id),
      rarity: rarity,
      color: RARITIES[rarity].color,
      burnValue: burnValueForId(id, rarity),
      stackCap: RARITIES[rarity].stackCap,
    };
    _cache[id] = item;
    return item;
  }

  // rollItemDrop(tier): tier 1-3, biases toward better rarity for
  // higher-value containers (chest/statue/tablet = tier 3, crate/cabinet = 1-2).
  function rollItemDrop(tier){
    tier = Math.max(1, Math.min(3, tier|0 || 1));
    // Bias: at higher tier, re-roll once and keep the better rarity.
    var id1 = 1 + Math.floor(Math.random() * ITEM_COUNT);
    var item1 = getItem(id1);
    if (tier === 1) return item1;

    var id2 = 1 + Math.floor(Math.random() * ITEM_COUNT);
    var item2 = getItem(id2);
    var rank = function(it){ return RARITY_ORDER.indexOf(it.rarity); };
    var best = rank(item2) > rank(item1) ? item2 : item1;

    if (tier === 3){
      var id3 = 1 + Math.floor(Math.random() * ITEM_COUNT);
      var item3 = getItem(id3);
      if (rank(item3) > rank(best)) best = item3;
    }
    return best;
  }

  window.NS_ITEMS = {
    ITEM_COUNT: ITEM_COUNT,
    RARITIES: RARITIES,
    RARITY_ORDER: RARITY_ORDER,
    getItem: getItem,
    rollItemDrop: rollItemDrop,
  };
})();
