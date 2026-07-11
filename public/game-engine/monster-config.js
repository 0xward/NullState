/* ============================================================
   NULL_STATE :: MONSTER SCALING CONFIG  (Phase 5)
   Data-driven per-floor monster difficulty scaling.
   All values are multipliers applied ON TOP of the base
   Enemy constructor scaling (1 + (depth-1)*0.14).
   ============================================================ */

const MONSTER_FLOOR_CONFIG = {
  // Global scale factor applied per floor tier (compounding multiplier).
  // Formula: finalScale = base * (FLOOR_SCALE_FACTOR ^ (floor - 1))
  FLOOR_SCALE_FACTOR: 1.08,   // +8% HP & DMG per floor tier

  // Per-tier overrides (optional). Keys are floor numbers.
  // These REPLACE the formula scale for that specific floor.
  floorOverrides: {
    5:  { hpMul: 2.2,  dmgMul: 1.8,  xpMul: 2.5,  label: 'Boss Floor' },
    10: { hpMul: 4.2,  dmgMul: 2.8,  xpMul: 4.0,  label: 'Boss Floor II' },
    15: { hpMul: 7.5,  dmgMul: 4.2,  xpMul: 6.5,  label: 'Boss Floor III' },
    20: { hpMul: 13.0, dmgMul: 6.5,  xpMul: 10.0, label: 'Boss Floor IV' },
  },

  // Elite bonus stacks on top of floor scaling.
  elite: { hpMul: 2.3, dmgMul: 1.45, xpMul: 2.6, rMul: 1.28 },

  // Boss-scale stacks on top of everything else.
  boss: { hpMul: 2.0, dmgMul: 1.4, rMul: 1.7, scMul: 1.85 },

  // ---- Game-feel knobs (used by effects.js) ----
  // Hit-stop duration (seconds) scaled by damage dealt.
  hitStop: {
    minDmg:    5,    // below this: no hitstop
    maxDmg:    80,   // at this dmg and above: maxDuration
    minDur:    0.04, // seconds for a light hit
    maxDur:    0.16, // seconds for a heavy hit
    bossMul:   1.5,  // extra multiplier on boss hits
  },

  // Screen shake per event (shake units — decays at 22/s in game.js).
  shake: {
    playerHit:   10,
    playerAttack: 6,
    enemyDeath:   8,
    critHit:     14,
    bossHit:     18,
    bossKill:    28,
  },

  // Knockback velocities (px/s).
  knockback: {
    base:      { x: 240, y: 155 },
    knockback:  { x: 420, y: 270 },  // weapon behavior 'knockback'
    aoe:        { x: 320, y: 210 },  // weapon behavior 'aoe'
    boss:       { x: 180, y: 120 },  // bosses resist knockback
  },

  // Particle burst counts on impact.
  particles: {
    lightHit:   6,
    heavyHit:  14,
    critHit:   20,
    death:     28,
    bossKill:  60,
  },
};

// Helper: compute total floor scaling for a given floor number.
// Returns { hpMul, dmgMul, xpMul } ready to multiply into base stats.
function getFloorScale(floor) {
  const cfg = MONSTER_FLOOR_CONFIG;
  const ov = cfg.floorOverrides[floor];
  if (ov) return { hpMul: ov.hpMul, dmgMul: ov.dmgMul, xpMul: ov.xpMul };
  const factor = Math.pow(cfg.FLOOR_SCALE_FACTOR, floor - 1);
  return { hpMul: factor, dmgMul: factor, xpMul: factor };
}

// Expose globally (loaded via <script> in the game page).
if (typeof window !== 'undefined') {
  window.NS_MONSTER_CONFIG = MONSTER_FLOOR_CONFIG;
  window.NS_FLOOR_SCALE = getFloorScale;
}
