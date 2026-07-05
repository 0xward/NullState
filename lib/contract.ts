/**
 * NullState Smart Contract Interaction Layer
 * Communicates with 0xe6c471dd3c715db8b10457113867885afa12ec13
 * Player progress stored ON-CHAIN (username, XP, level)
 */

export const NULLSTATE_CONTRACT_ADDRESS = '0xe6c471dd3c715db8b10457113867885afa12ec13'

// Minimal ABI for the functions we need
export const NULLSTATE_CONTRACT_ABI = [
  {
    name: 'registerPlayer',
    type: 'function',
    inputs: [
      { name: 'username', type: 'string' },
      { name: 'characterClass', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'updatePlayerStats',
    type: 'function',
    inputs: [
      { name: 'xp', type: 'uint64' },
      { name: 'kills', type: 'uint32' },
      { name: 'characterClass', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getPlayerProfile',
    type: 'function',
    inputs: [{ name: 'playerAddress', type: 'address' }],
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
    name: 'getTopPlayers',
    type: 'function',
    inputs: [{ name: 'limit', type: 'uint8' }],
    outputs: [
      {
        name: 'players',
        type: 'tuple[]',
        components: [
          { name: 'playerAddress', type: 'address' },
          { name: 'username', type: 'string' },
          { name: 'xp', type: 'uint64' },
          { name: 'level', type: 'uint16' },
          { name: 'kills', type: 'uint32' },
        ],
      },
    ],
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
