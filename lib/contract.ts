/**
 * NullState Smart Contract Interaction Layer
 * Communicates with 0xe6c471dd3c715db8b10457113867885afa12ec13
 * 
 * ON-CHAIN: XP, Level, Kills (immutable game progress)
 * OFF-CHAIN (Firebase): Username (mutable, can change anytime)
 */

export const NULLSTATE_CONTRACT_ADDRESS = '0xe6c471dd3c715db8b10457113867885afa12ec13'

// Minimal ABI for the functions we need (based on actual Solidity contract)
// Note: Contract only has register(), executeAction(), respawn(), raid functions
// It does NOT have username field - username is stored off-chain in Firebase
export const NULLSTATE_CONTRACT_ABI = [
  {
    name: 'register',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'executeAction',
    type: 'function',
    inputs: [
      { name: 'actionType', type: 'uint8' },
      { name: 'damageDealt', type: 'uint32' },
      { name: 'damageReceived', type: 'uint32' },
      { name: 'xpGained', type: 'uint64' },
      { name: 'enemyKilled', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'respawn',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getPlayer',
    type: 'function',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [
      { name: 'exists', type: 'bool' },
      { name: 'hp', type: 'uint32' },
      { name: 'maxHp', type: 'uint32' },
      { name: 'xp', type: 'uint64' },
      { name: 'level', type: 'uint16' },
      { name: 'kills', type: 'uint32' },
      { name: 'deaths', type: 'uint32' },
      { name: 'passportVerified', type: 'bool' },
      { name: 'artifactCount_', type: 'uint32' },
    ],
    stateMutability: 'view',
  },
] as const

export interface PlayerProfile {
  username: string
  xp: number
  level: number
  kills: number
  isRegistered: boolean
  walletAddress: string
}

export interface LeaderboardEntry {
  rank: number
  walletAddress: string
  username: string
  xp: number
  level: number
  kills: number
}

/**
 * Character class constants (align with contract)
 */
export const CHARACTER_CLASSES = {
  WARRIOR: 0,
  MAGE: 1,
  ROGUE: 2,
  PALADIN: 3,
} as const

export const CHARACTER_CLASS_NAMES = {
  [CHARACTER_CLASSES.WARRIOR]: 'Warrior',
  [CHARACTER_CLASSES.MAGE]: 'Mage',
  [CHARACTER_CLASSES.ROGUE]: 'Rogue',
  [CHARACTER_CLASSES.PALADIN]: 'Paladin',
}
