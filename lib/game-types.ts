// =============================================
// NULLSTATE :: GAME TYPES
// =============================================

export interface PlayerState {
  name: string
  hp: number
  maxHp: number
  xp: number
  level: number
  walletAddress: string | null
  artifacts: Artifact[]
  passportVerified: boolean
  kills: number
  deaths: number
}

export interface Artifact {
  id: string
  name: string
  type: 'weapon' | 'armor' | 'consumable' | 'relic'
  power: number
  description: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  onChain: boolean
}

export interface Enemy {
  id: string
  name: string
  class: string
  hp: number
  maxHp: number
  power: number
  description: string
  weakness?: string
  reward: {
    xp: number
    CELO?: number
    artifact?: Partial<Artifact>
  }
  sprite: string
}

export interface GameAction {
  id: string
  label: string
  description: string
  costCELO: number
  requiresArtifact?: boolean
  effect: 'attack' | 'defend' | 'special' | 'flee' | 'inspect'
}

export interface NarrativeMessage {
  id: string
  role: 'dm' | 'player' | 'system'
  content: string
  timestamp: number
  type?: 'combat' | 'lore' | 'event' | 'reward' | 'death'
}

export interface RaidBoss {
  id: string
  name: string
  title: string
  currentHp: number
  maxHp: number
  phase: 1 | 2 | 3
  attackers: number
  tweetCount: number
  reward: string
  sprite: string
  activeUntil: number // timestamp
}

export interface WorldEvent {
  id: string
  type: 'raid' | 'invasion' | 'festival' | 'drop'
  title: string
  description: string
  active: boolean
  progress: number
  maxProgress: number
  endsAt: number
}

export interface GameState {
  player: PlayerState
  currentEnemy: Enemy | null
  narrative: NarrativeMessage[]
  actions: GameAction[]
  raidBoss: RaidBoss | null
  worldEvents: WorldEvent[]
  phase: 'menu' | 'exploring' | 'combat' | 'victory' | 'death' | 'shop' | 'raid'
  turn: number
  txPending: boolean
}

// =============================================
// GAME CONSTANTS
// =============================================

export const CELO_CHAIN_ID = 42220
export const CELO_ACTION_COST = '0.01'

export const ENEMIES: Enemy[] = [
  {
    id: 'gas-goblin',
    name: 'Gas Goblin',
    class: 'NETWORK DAEMON',
    hp: 80,
    maxHp: 80,
    power: 15,
    description: 'A creature born from failed transactions, hoarding gas fees to fuel its dark magic.',
    weakness: 'Smart Contract exploits',
    reward: { xp: 45, CELO: 0.02 },
    sprite: '👺',
  },
  {
    id: 'null-pointer',
    name: 'Null Pointer',
    class: 'CORRUPTED MEMORY',
    hp: 60,
    maxHp: 60,
    power: 20,
    description: 'An ancient exception escaped from a deprecated smart contract. Instantly lethal if underestimated.',
    weakness: 'Null checks',
    reward: { xp: 60, CELO: 0.03 },
    sprite: '💀',
  },
  {
    id: 'rug-phantom',
    name: 'Rug Phantom',
    class: 'LIQUIDITY GHOST',
    hp: 100,
    maxHp: 100,
    power: 25,
    description: 'Materializes when liquidity is drained. Pulls the ground from beneath your feet.',
    weakness: 'Locked liquidity NFTs',
    reward: { xp: 80, CELO: 0.05, artifact: { name: 'Phantom Shards', type: 'weapon', power: 12 } },
    sprite: '👻',
  },
  {
    id: 'fork-wraith',
    name: 'Fork Wraith',
    class: 'CHAIN SPLIT ENTITY',
    hp: 120,
    maxHp: 120,
    power: 30,
    description: 'Born from contested hard forks. Exists in two states simultaneously — impossible to predict.',
    weakness: 'Consensus protocols',
    reward: { xp: 100, CELO: 0.08 },
    sprite: '🔮',
  },
]

export const RAID_BOSS: RaidBoss = {
  id: 'the-51-percent',
  name: 'THE 51%',
  title: 'CONSENSUS DESTROYER',
  currentHp: 10000,
  maxHp: 10000,
  phase: 1,
  attackers: 247,
  tweetCount: 1834,
  reward: 'Legendary Artifact Drop + 1 CELO',
  sprite: '🔴',
  activeUntil: Date.now() + 72 * 60 * 60 * 1000, // 72h
}

export const INITIAL_PLAYER: PlayerState = {
  name: 'NOMAD',
  hp: 85,
  maxHp: 100,
  xp: 420,
  level: 4,
  walletAddress: null,
  artifacts: [
    {
      id: 'debug-blade',
      name: 'Debug Blade',
      type: 'weapon',
      power: 15,
      description: 'Forged from 1000 failed stack traces.',
      rarity: 'rare',
      onChain: true,
    },
  ],
  passportVerified: true,
  kills: 12,
  deaths: 3,
}

export const COMBAT_ACTIONS: GameAction[] = [
  {
    id: 'attack-artifact',
    label: 'Attack with Artifact',
    description: 'Strike using your equipped artifact — max damage',
    costCELO: 0.01,
    requiresArtifact: true,
    effect: 'attack',
  },
  {
    id: 'basic-attack',
    label: 'Basic Attack',
    description: 'Standard wallet-signed strike',
    costCELO: 0.01,
    effect: 'attack',
  },
  {
    id: 'defend',
    label: 'Defend',
    description: 'Block incoming damage — reduces next hit by 60%',
    costCELO: 0.01,
    effect: 'defend',
  },
  {
    id: 'inspect',
    label: 'Inspect Enemy',
    description: 'Ask the AI DM for strategic intel',
    costCELO: 0.01,
    effect: 'inspect',
  },
  {
    id: 'flee',
    label: 'Emergency Fork',
    description: 'Attempt to escape — 40% success rate',
    costCELO: 0.01,
    effect: 'flee',
  },
]
