/**
 * NullState Smart Contract Interaction Layer
 * Communicates with 0xe6c471dd3c715db8b10457113867885afa12ec13
 * Player progress stored ON-CHAIN (username, XP, level)
 */

export const NULLSTATE_CONTRACT_ADDRESS = '0xe6c471dd3c715db8b10457113867885afa12ec13'

// Minimal ABI for the functions we need (based on actual contract at Celoscan)
export const NULLSTATE_CONTRACT_ABI = [
  {
    name: 'registerPlayer',
    type: 'function',
    inputs: [
      { name: '_username', type: 'string' },
      { name: '_characterClass', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'updatePlayerProgress',
    type: 'function',
    inputs: [
      { name: '_xp', type: 'uint64' },
      { name: '_level', type: 'uint16' },
      { name: '_kills', type: 'uint32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getPlayerProfile',
    type: 'function',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [
      { name: 'username', type: 'string' },
      { name: 'xp', type: 'uint64' },
      { name: 'level', type: 'uint16' },
      { name: 'kills', type: 'uint32' },
      { name: 'characterClass', type: 'uint8' },
      { name: 'isRegistered', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getAllPlayers',
    type: 'function',
    inputs: [],
    outputs: [{ name: 'players', type: 'address[]' }],
    stateMutability: 'view',
  },
] as const

export interface PlayerProfile {
  username: string
  xp: number
  level: number
  kills: number
  characterClass: number
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
