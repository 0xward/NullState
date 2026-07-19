/**
 * Game Configuration Constants
 * Season, Rewards, and Game Economy Settings
 */

export const GAME_CONFIG = {
  // Season Configuration
  season: {
    duration: 'monthly', // 1st to last day of UTC month
    resetTime: '00:00 UTC', // Season start/end time
    timezone: 'UTC',
  },

  // Pass System Configuration
  pass: {
    priceUSDm: 0.3, // in USDm
    freePassesAvailable: 50, // FCFS for first 50 users
    seasonsDuration: 5, // 5 seasons of SBT passes pre-generated
    playLimitFree: 1, // 1 free play per week without pass
    playLimitWithPass: Infinity, // Unlimited with pass
    seasonResetDay: 1, // Reset on 1st of month
    dropRateModifier: {
      withoutPass: 1.0, // Normal drop rates
      withPass: 1.0, // Same as without for MVP
    },
  },

  // Energy / Action system (Genius blueprint Phase 1 — finally implements
  // the long-dead `pass.playLimitFree` intent as a real, generous daily cap).
  // One energy = one fresh bunker entry (RunSession start). Continuing a
  // saved run costs nothing. Owner decision (2026-07-19): 5 free runs per
  // rolling 24h window, $1 refill grants +5 bonus runs, free runs do NOT
  // roll over (bonus runs persist until spent — they were paid for).
  energy: {
    freeRunsPerDay: 5,
    refillPriceUSD: 1,
    refillRuns: 5,
    windowHours: 24,
  },

  // Burn Reward System — NullState Point (Phase 5.5 #8)
  // Burning is off-chain and instant: no weekly pool, no owner deposit, no
  // per-user cap, no claim step. Items convert straight into the player's
  // NullState Point balance (Firestore-tracked, see /api/burn/record).
  // NullState Point is a faucet-only in-game asset — it cannot be
  // withdrawn/cashed out; its only use is swapping for Marketplace gear
  // priced $0.5–$2 (see lib/constants/marketplace.ts tokenPrice + the
  // Marketplace "Swap" button).
  burnRewards: {
    // NullState Point value ranges (whole numbers, random per item)
    itemValues: {
      common: { min: 1, max: 5 },
      uncommon: { min: 10, max: 50 },
      rare: { min: 50, max: 150 },
      epic: { min: 150, max: 350 },
      legendary: { min: 350, max: 500 },
    },

    // Rarity distribution percentages
    distribution: {
      common: 0.4, // 40%
      uncommon: 0.3, // 30%
      rare: 0.2, // 20%
      epic: 0.08, // 8%
      legendary: 0.02, // 2%
    },
  },

  // Season Rewards (Leaderboard Top 3)
  seasonRewards: {
    rank1USDm: 20,
    rank2USDm: 5,
    rank3USDm: 3,
    requireOwnerDeposit: true, // Must owner deposit before players can claim
    claimableAfterSeasonEnd: true,
    claimWindow: '7 days', // Players have 7 days after season end to claim
  },

  // Loot System
  loot: {
    containerItemCount: { min: 3, max: 8 }, // Items per container
    loadingAnimationDuration: 2.5, // seconds
    containerDropLocation: 'inventory', // Direct to inventory, not floor
    loadingDirection: 'left-to-right',
  },

  // Bunker Progression System
  bunkers: {
    totalBunkers: 6,
    floorsPerBunker: 3,
    mustClearFloorToDescend: true, // Can't go to next bunker without clearing all enemies

    // Rarity unlock by bunker level
    rarityByBunker: {
      1: ['common'],
      2: ['common', 'uncommon'],
      3: ['common', 'uncommon', 'rare'],
      4: ['common', 'uncommon', 'rare', 'epic'],
      5: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
      6: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    },

    // New items introduced per bunker (player discovery)
    newItemsIntroducedPerBunker: {
      1: 'tier_1_items', // Base items
      2: 'tier_2_items', // New items unlock at Bunker 2
      3: 'tier_3_items',
      4: 'tier_4_items',
      5: 'tier_5_items',
      6: 'tier_6_legendary_items',
    },
  },

  // Special Items & Treasure Vault Quest
  specialItems: {
    paper: {
      name: 'Code Paper',
      rarity: 'epic',
      location: { bunker: 2, floor: 2 },
      description: 'Contains a 4-digit vault code (mysterious)',
      value: 0, // Cannot be burned
      stackable: false,
      unique: false, // Can find multiple
    },
    goldenKey: {
      name: 'Golden Key',
      rarity: 'legendary',
      location: { bunker: 1, floor: 3 },
      description: 'Unlocks the treasure vault on final bunker (mysterious)',
      value: 0, // Cannot be burned
      stackable: false,
      unique: true, // Only 1 per run
      relocateOnDeath: true, // Relocates if player dies before collecting
    },
    treasureVault: {
      name: 'Treasure Vault',
      location: { bunker: 6, floor: 3 },
      rewardUSDm: 1,
      requirePaper: true,
      requireGoldenKey: true,
      description: 'Final quest reward - combine paper code + golden key',
      inputMethod: 'keyboard-4digit',
      maxAttempts: 3,
    },
  },

  // Data Persistence Configuration
  persistence: {
    backend: 'firebase', // Firebase Realtime DB
    saveOnProgress: true,
    autoSaveInterval: 30, // seconds
    encryptSensitiveData: true,
    neverResetOnSave: true, // Data persists when user clicks "Save Game"
  },

  // Main Menu UI Configuration
  ui: {
    mainMenuOptions: ['Continue', 'New Game', 'Leaderboard', 'Reward'],
    rewardPanelStats: [
      'username',
      'walletAddress',
      'totalItemsCollected',
      'itemBreakdownWithImages',
      'nullstateTokenBalance',
      'totalEarnedUSDm',
      'daysActive',
    ],
  },

  // Documentation Notes (for docs.md)
  docNotes: {
    paperLocation: 'Keep mysterious - do not reveal Paper location in docs',
    goldenKeyLocation: 'Keep mysterious - do not reveal Golden Key location in docs',
    useImages: 'Include official Paper and Golden Key item images as visual hints',
    seasonResetExplanation: 'Clearly explain UTC monthly reset times',
    passSeasonExplanation: 'Explain that Pass is per-season, 1 season = 1 month',
    bonusRewardExplanation: 'Explain that bonuses are ranked and require owner deposit',
    dataNotReset: 'Clearly state that Save Game does NOT reset player progress',
  },
} as const;

export default GAME_CONFIG;
