/**
 * NullState Smart Contract ABIs & Addresses
 *
 * Contracts deployed on Celo Mainnet (chainId: 42220)
 * - PassSBT       : NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS
 * - NullStateReward: NEXT_PUBLIC_REWARD_CONTRACT_ADDRESS
 * - TreasureVault : NEXT_PUBLIC_TREASURE_VAULT_ADDRESS
 */

// ─── Contract Addresses ───────────────────────────────────────────────────────
// Live & verified on Celo Mainnet. Env vars still override if set, but these
// hardcoded values act as the source of truth so the app never silently falls
// back to '0x'.

export const PASS_SBT_ADDRESS = (process.env
  .NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS ||
  '0x5235ffBb4C02fCabf29b76Aa0011DA3E1eD96f0e') as `0x${string}`

export const REWARD_CONTRACT_ADDRESS = (process.env
  .NEXT_PUBLIC_REWARD_CONTRACT_ADDRESS ||
  '0x5AAd65B25F004fa953Bc3Cd9f6Bf7D04FDd5cAaC') as `0x${string}`

export const TREASURE_VAULT_ADDRESS = (process.env
  .NEXT_PUBLIC_TREASURE_VAULT_ADDRESS ||
  '0x81ba7b08fd4E618b00025d7Ec37C1a7B47e14FA9') as `0x${string}`

// USDm (Mento Dollar, migrated from cUSD) — used for NULL_STRIKE fee & burn
// rewards. Standard 18-decimal ERC20.
export const USDM_ADDRESS = (process.env.NEXT_PUBLIC_USDM_ADDRESS ||
  '0x765DE816845861e75A25fCA122bb6898B8B1282a') as `0x${string}`

export const USDM_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

// Mirrors PassSBT.sol's `PASS_PRICE` constant (0.3 USDm, 18 decimals).
// Kept here (not re-read on-chain) since it's a Solidity `constant` and can
// never change without a redeploy — same assumption the contract itself makes.
export const PASS_PRICE_WEI = BigInt('300000000000000000') // 0.3 USDm

// ─── PassSBT ABI ─────────────────────────────────────────────────────────────

export const PASS_SBT_ABI = [
  // Season management (owner only)
  {
    name: 'initializeSeason',
    type: 'function',
    inputs: [
      { name: '_seasonId', type: 'uint256' },
      { name: '_startDate', type: 'uint256' },
      { name: '_endDate', type: 'uint256' },
      { name: '_maxSupply', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Whitelist management (owner only)
  {
    name: 'addToWhitelist',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_seasonId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'removeFromWhitelist',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_seasonId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'addBatchWhitelist',
    type: 'function',
    inputs: [
      { name: '_users', type: 'address[]' },
      { name: '_seasonId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'removeBatchWhitelist',
    type: 'function',
    inputs: [
      { name: '_users', type: 'address[]' },
      { name: '_seasonId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Pass minting
  {
    name: 'mintFreePass',
    type: 'function',
    inputs: [{ name: '_seasonId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'mintPaidPass',
    type: 'function',
    inputs: [{ name: '_seasonId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Query functions
  {
    name: 'hasPass',
    type: 'function',
    inputs: [{ name: '_user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'getUserPassSeason',
    type: 'function',
    inputs: [{ name: '_user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'isWhitelisted',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_seasonId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'getSeasonInfo',
    type: 'function',
    inputs: [{ name: '_seasonId', type: 'uint256' }],
    outputs: [
      { name: 'supply', type: 'uint256' },
      { name: 'minted', type: 'uint256' },
      { name: 'startDate', type: 'uint256' },
      { name: 'endDate', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'userPassSeason',
    type: 'function',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'whitelistClaimed',
    type: 'function',
    inputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  // Events
  {
    name: 'PassMinted',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'seasonId', type: 'uint256', indexed: false },
      { name: 'isFree', type: 'bool', indexed: false },
    ],
  },
] as const

// ─── NullStateReward ABI ──────────────────────────────────────────────────────

export const REWARD_ABI = [
  // Burn tracking (backend only)
  {
    name: 'recordBurn',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_itemCount', type: 'uint256' },
      { name: '_burnValue', type: 'uint256' },
      { name: '_rewardToken', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Weekly pool management
  {
    name: 'depositWeeklyPool',
    type: 'function',
    inputs: [
      { name: '_week', type: 'uint256' },
      { name: '_rewardToken', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'claimWeeklyRewards',
    type: 'function',
    inputs: [{ name: '_week', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Leaderboard
  {
    name: 'updateLeaderboard',
    type: 'function',
    inputs: [
      { name: '_seasonId', type: 'uint256' },
      { name: '_topPlayers', type: 'address[3]' },
      { name: '_topScores', type: 'uint256[3]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'depositSeasonBonus',
    type: 'function',
    inputs: [
      { name: '_seasonId', type: 'uint256' },
      { name: '_rewardToken', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'claimSeasonBonus',
    type: 'function',
    inputs: [{ name: '_seasonId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Query functions
  {
    name: 'getSeasonLeaderboard',
    type: 'function',
    inputs: [{ name: '_seasonId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'seasonId', type: 'uint256' },
          { name: 'topPlayers', type: 'address[3]' },
          { name: 'topScores', type: 'uint256[3]' },
          { name: 'rewardToken', type: 'address' },
          { name: 'totalDeposited', type: 'uint256' },
          { name: 'deposited', type: 'bool' },
          { name: 'finalized', type: 'bool' },
          { name: 'updatedAt', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getUserWeeklyBurn',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_week', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'getUserWeeklyClaimed',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_week', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'hasClaimedSeasonBonus',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_seasonId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'weeklyPools',
    type: 'function',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'week', type: 'uint256' },
      { name: 'rewardToken', type: 'address' },
      { name: 'depositedAmount', type: 'uint256' },
      { name: 'claimedAmount', type: 'uint256' },
      { name: 'createdAt', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'weeklyPoolSize',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'maxPerUserPerWeek',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Constants
  {
    name: 'RANK1_REWARD',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'RANK2_REWARD',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'RANK3_REWARD',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Events
  {
    name: 'BurnRecorded',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'itemCount', type: 'uint256', indexed: false },
      { name: 'burnValue', type: 'uint256', indexed: false },
      { name: 'rewardToken', type: 'address', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'BurnClaimed',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'week', type: 'uint256', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'rewardToken', type: 'address', indexed: false },
    ],
  },
  {
    name: 'LeaderboardUpdated',
    type: 'event',
    inputs: [
      { name: 'seasonId', type: 'uint256', indexed: true },
      { name: 'topPlayers', type: 'address[3]', indexed: false },
      { name: 'topScores', type: 'uint256[3]', indexed: false },
    ],
  },
  {
    name: 'SeasonBonusClaimed',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'seasonId', type: 'uint256', indexed: false },
      { name: 'rank', type: 'uint256', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const

// ─── TreasureVault ABI ────────────────────────────────────────────────────────

export const TREASURE_VAULT_ABI = [
  // Vault pool management (owner only)
  {
    name: 'depositVaultPool',
    type: 'function',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'withdrawVaultPool',
    type: 'function',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Code management (backend only)
  {
    name: 'storeWeeklyVaultCode',
    type: 'function',
    inputs: [
      { name: '_weekId', type: 'uint256' },
      { name: '_code', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'submitVaultCode',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_weekId', type: 'uint256' },
      { name: '_code', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'unlockVaultForNewWeek',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_newWeekId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Query functions
  {
    name: 'getUserAttempts',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_weekId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'getRemainingAttempts',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_weekId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'hasClaimedThisWeek',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_weekId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'isLockedThisWeek',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_weekId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'getVaultPoolStats',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'deposited', type: 'uint256' },
      { name: 'claimed', type: 'uint256' },
      { name: 'available', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getAvailableVaultFunds',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'isCodeSetForWeek',
    type: 'function',
    inputs: [{ name: '_weekId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'currentRewardToken',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'VAULT_REWARD',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'MAX_ATTEMPTS_PER_WEEK',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Events
  {
    name: 'VaultCodeCorrect',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'weekId', type: 'uint256', indexed: true },
      { name: 'reward', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'VaultCodeIncorrect',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'weekId', type: 'uint256', indexed: true },
      { name: 'attemptNumber', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'VaultLocked',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'weekId', type: 'uint256', indexed: true },
    ],
  },
] as const
