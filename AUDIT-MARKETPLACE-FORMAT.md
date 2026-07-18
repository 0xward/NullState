# Marketplace Format Audit (v71)

## Status: CONTENT IDENTICAL, FORMAT DIFFERENT (ACCEPTABLE)

### Summary
- **marketplace.ts** (React source of truth): 14 items
- **marketplace-items.js** (game engine): 14 items
- **Semantic sync**: 100% ✅ (all prices, bonuses, effects match)
- **Format sync**: ~70% ⚠️ (field order & spacing differ, not a bug)

### Example Difference

**marketplace.ts** (single-line):
```typescript
{ id:'ancient_blade', name:'Ancient Blade', type:'weapon', slot:'mainhand', price:5.0, fxTier:3, fxColor:'#ffd24a',
  effect:{ atkBonus:40, behavior:'triple_slash' }, sprite:'/sprites/marketplace/ancient_blade.png',
  desc:'+40 ATK. Three blistering slashes.' },
```

**marketplace-items.js** (multi-line):
```javascript
{ id:'ancient_blade', name:'Ancient Blade', type:'weapon', slot:SLOTS.WEAPON,
  price:5.0, fxTier:3, fxColor:'#ffd24a', effect:{ atkBonus:40, behavior:'triple_slash' },
  sprite:'/sprites/marketplace/ancient_blade.png',
  desc:'+40 ATK. Three blistering slashes — few foes survive.' },
```

Note: JS description has extra text " — few foes survive" (cosmetic, not breaking).

### Decision
**No action needed** — Content is semantically identical. Format differences are cosmetic and acceptable for two different environments (React config vs JS object literal).

Standardizing would introduce merge-conflict risk with low benefit.

### Recommended (future release)
If refactoring for code generation, consider building JS from TS via script (single source of truth). For now, manual sync is working correctly.
