'use client'

import { ReactNode, createContext, useContext, useState, useCallback } from 'react'
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useBalance,
  useSwitchChain,
  useConnect,
  useDisconnect,
} from 'wagmi'
import { celo } from 'wagmi/chains'
import { encodeFunctionData } from 'viem'

// ─── Contract config ─────────────────────────────────────────────────────────

export const NULLSTATE_ADDRESS  = '0xE6C471DD3C715DB8B10457113867885AFA12eC13' as `0x${string}`
export const CELO_CHAIN_ID      = 42220
export const ALFAJORES_CHAIN_ID = 44787
export const ACTION_COST_WEI   = BigInt('10000000000000000') // 0.01 CELO

// JSON ABI — parseAbi does not support named tuple params in human-readable
// format (abitype throws InvalidParameterError), so we use JSON ABI instead.
export const NULLSTATE_ABI = [
  { name: 'register',       type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'verifyPassport', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'respawn',        type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    name: 'executeAction', type: 'function', stateMutability: 'payable',
    inputs: [
      { name: 'actionType',     type: 'uint8'  },
      { name: 'damageDealt',    type: 'uint32' },
      { name: 'damageReceived', type: 'uint32' },
      { name: 'xpGained',       type: 'uint64' },
      { name: 'enemyKilled',    type: 'bool'   },
    ],
    outputs: [],
  },
  {
    name: 'attackRaidBoss', type: 'function', stateMutability: 'payable',
    inputs:  [{ name: 'damage', type: 'uint32' }],
    outputs: [],
  },
  {
    name: 'registerTweetAttack', type: 'function', stateMutability: 'nonpayable',
    inputs:  [{ name: 'attacker', type: 'address' }],
    outputs: [],
  },
  {
    name: 'getPlayer', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [
      { name: 'exists',           type: 'bool'   },
      { name: 'hp',               type: 'uint32' },
      { name: 'maxHp',            type: 'uint32' },
      { name: 'xp',               type: 'uint64' },
      { name: 'level',            type: 'uint16' },
      { name: 'kills',            type: 'uint32' },
      { name: 'deaths',           type: 'uint32' },
      { name: 'passportVerified', type: 'bool'   },
      { name: 'artifactCount',    type: 'uint32' },
    ],
  },
  {
    name: 'getArtifacts', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [
      {
        name: '', type: 'tuple[]',
        components: [
          { name: 'id',           type: 'uint32' },
          { name: 'artifactType', type: 'uint8'  },
          { name: 'rarity',       type: 'uint8'  },
          { name: 'power',        type: 'uint16' },
          { name: 'onChain',      type: 'bool'   },
          { name: 'exists',       type: 'bool'   },
        ],
      },
    ],
  },
  {
    name: 'getCurrentRaid', type: 'function', stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'id',          type: 'uint64'  },
      { name: 'currentHp',   type: 'uint64'  },
      { name: 'maxHp',       type: 'uint64'  },
      { name: 'phase',       type: 'uint8'   },
      { name: 'attackers',   type: 'uint32'  },
      { name: 'tweets',      type: 'uint32'  },
      { name: 'endsAt',      type: 'uint64'  },
      { name: 'active',      type: 'bool'    },
      { name: 'topAttacker', type: 'address' },
      { name: 'topDamage',   type: 'uint32'  },
    ],
  },
  {
    name: 'getMyRaidContribution', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'uint32' }],
  },
  {
    name: 'paused', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'bool' }],
  },
] as const

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExecuteActionParams {
  actionType: number
  damageDealt: number
  damageReceived: number
  xpGained: number
  enemyKilled: boolean
}

export interface PlayerData {
  exists: boolean
  hp: number
  maxHp: number
  xp: number
  level: number
  kills: number
  deaths: number
  passportVerified: boolean
  artifactCount: number
}

export interface RaidData {
  id: string
  currentHp: string
  maxHp: string
  phase: number
  attackers: number
  tweets: number
  endsAt: number
  active: boolean
  topAttacker: string
  topDamage: number
}

// Extra context values that GameFullUI expects beyond wagmi hooks
interface WalletExtras {
  isMiniPay: boolean
  celoBalance: string
  error: string | null
  executeAction: (params: ExecuteActionParams) => Promise<string>
  attackRaid: (damage: number) => Promise<string>
  readPlayer: (addr?: string) => Promise<PlayerData | null>
  readRaid: () => Promise<RaidData | null>
  registerPlayer: () => Promise<string>
  respawnPlayer: () => Promise<string>
}

const WalletExtrasContext = createContext<WalletExtras | null>(null)

// ─── Convenience hook (keeps GameFullUI API unchanged) ────────────────────────
// Returns a merged object with both wagmi state and contract helpers.
export function useWallet() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const extras = useContext(WalletExtrasContext)

  if (!extras) throw new Error('useWallet must be inside WalletProvider')

  const connectWallet = useCallback(async () => {
    // Prefer the injected connector (MetaMask / MiniPay) if available,
    // otherwise fall back to WalletConnect (shows the modal)
    const injected = connectors.find(c => c.id === 'injected')
    const wc       = connectors.find(c => c.id === 'walletConnect')
    const target   = injected ?? wc ?? connectors[0]
    if (!target) return
    connect({ connector: target, chainId: CELO_CHAIN_ID })
  }, [connect, connectors])

  const switchToCelo = useCallback(async () => {
    try { switchChain({ chainId: CELO_CHAIN_ID }) } catch {}
  }, [switchChain])

  return {
    address:      address ?? null,
    chainId:      chain?.id ?? null,
    isConnected,
    isConnecting: false, // wagmi tracks this per-connector; keep API compat
    isMiniPay:    extras.isMiniPay,
    celoBalance:  extras.celoBalance,
    error:        extras.error,
    connect:      connectWallet,
    disconnect,
    switchToCelo,
    executeAction:  extras.executeAction,
    attackRaid:     extras.attackRaid,
    readPlayer:     extras.readPlayer,
    readRaid:       extras.readRaid,
    registerPlayer: extras.registerPlayer,
    respawnPlayer:  extras.respawnPlayer,
  }
}

// ─── Inner provider (needs wagmi hooks, so must be a child of WagmiProvider) ─

function WalletExtrasProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount()
  const publicClient  = usePublicClient({ chainId: CELO_CHAIN_ID })
  const { data: walletClient } = useWalletClient({ chainId: CELO_CHAIN_ID })
  const { data: balanceData }  = useBalance({ address, chainId: CELO_CHAIN_ID })

  const [error, setError] = useState<string | null>(null)

  // Detect MiniPay (injected wallet with isMiniPay flag)
  const isMiniPay =
    typeof window !== 'undefined' &&
    !!(window as unknown as { ethereum?: { isMiniPay?: boolean } }).ethereum?.isMiniPay

  const celoBalance = balanceData
    ? (Number(balanceData.value) / 10 ** balanceData.decimals).toFixed(2)
    : '0.00'

  // ── Send transaction helper ───────────────────────────────────────────────

  const sendTx = useCallback(
    async (data: `0x${string}`, value?: bigint): Promise<string> => {
      if (!walletClient || !address) throw new Error('Wallet not connected')
      setError(null)
      try {
        const hash = await walletClient.sendTransaction({
          account: address,
          chain:   celo,
          to:      NULLSTATE_ADDRESS,
          data,
          value:   value ?? BigInt(0),
          // Let the wallet estimate gas — safer than hardcoding
          // gas is omitted intentionally so the RPC estimates it
        })
        return hash
      } catch (e: unknown) {
        const msg = (e as Error).message ?? 'Transaction failed'
        setError(msg)
        throw e
      }
    },
    [walletClient, address]
  )

  // ── Contract write functions ──────────────────────────────────────────────

  const registerPlayer = useCallback(async (): Promise<string> => {
    const data = encodeFunctionData({
      abi:          NULLSTATE_ABI,
      functionName: 'register',
    })
    return sendTx(data)
  }, [sendTx])

  const respawnPlayer = useCallback(async (): Promise<string> => {
    const data = encodeFunctionData({
      abi:          NULLSTATE_ABI,
      functionName: 'respawn',
    })
    return sendTx(data)
  }, [sendTx])

  const executeAction = useCallback(
    async (params: ExecuteActionParams): Promise<string> => {
      // Validate params before encoding — prevents hex corruption
      const { actionType, damageDealt, damageReceived, xpGained, enemyKilled } = params
      if (
        typeof actionType    !== 'number' || isNaN(actionType)    ||
        typeof damageDealt   !== 'number' || isNaN(damageDealt)   ||
        typeof damageReceived !== 'number' || isNaN(damageReceived) ||
        typeof xpGained      !== 'number' || isNaN(xpGained)
      ) {
        throw new Error('Invalid action params')
      }

      const data = encodeFunctionData({
        abi:          NULLSTATE_ABI,
        functionName: 'executeAction',
        args: [
          actionType,
          damageDealt,
          damageReceived,
          BigInt(xpGained), // uint64 — use BigInt to avoid JS number precision issues
          enemyKilled,
        ],
      })
      return sendTx(data, ACTION_COST_WEI)
    },
    [sendTx]
  )

  const attackRaid = useCallback(async (damage: number): Promise<string> => {
    if (typeof damage !== 'number' || isNaN(damage) || damage <= 0) {
      throw new Error('Invalid damage value')
    }
    const data = encodeFunctionData({
      abi:          NULLSTATE_ABI,
      functionName: 'attackRaidBoss',
      args:         [damage],
    })
    return sendTx(data, ACTION_COST_WEI)
  }, [sendTx])

  // ── Contract read functions ───────────────────────────────────────────────

  const readPlayer = useCallback(
    async (addr?: string): Promise<PlayerData | null> => {
      const target = (addr ?? address) as `0x${string}` | undefined
      if (!target || !publicClient) return null
      try {
        const result = await publicClient.readContract({
          address:      NULLSTATE_ADDRESS,
          abi:          NULLSTATE_ABI,
          functionName: 'getPlayer',
          args:         [target],
        }) as readonly [boolean, number, number, bigint, number, number, number, boolean, number]

        return {
          exists:           result[0],
          hp:               result[1],
          maxHp:            result[2],
          xp:               Number(result[3]),
          level:            result[4],
          kills:            result[5],
          deaths:           result[6],
          passportVerified: result[7],
          artifactCount:    result[8],
        }
      } catch {
        return null
      }
    },
    [address, publicClient]
  )

  const readRaid = useCallback(async (): Promise<RaidData | null> => {
    if (!publicClient) return null
    try {
      const result = await publicClient.readContract({
        address:      NULLSTATE_ADDRESS,
        abi:          NULLSTATE_ABI,
        functionName: 'getCurrentRaid',
      }) as readonly [bigint, bigint, bigint, number, number, number, bigint, boolean, `0x${string}`, number]

      return {
        id:          result[0].toString(),
        currentHp:   result[1].toString(),
        maxHp:       result[2].toString(),
        phase:       result[3],
        attackers:   result[4],
        tweets:      result[5],
        endsAt:      Number(result[6]),
        active:      result[7],
        topAttacker: result[8],
        topDamage:   result[9],
      }
    } catch {
      return null
    }
  }, [publicClient])

  const extras: WalletExtras = {
    isMiniPay,
    celoBalance,
    error,
    executeAction,
    attackRaid,
    readPlayer,
    readRaid,
    registerPlayer,
    respawnPlayer,
  }

  return (
    <WalletExtrasContext.Provider value={extras}>
      {children}
    </WalletExtrasContext.Provider>
  )
}

// ─── Public WalletProvider (drop-in replacement) ─────────────────────────────
// Wagmi + QueryClient + RainbowKit are set up in app/layout.tsx.
// This component only provides the extras context.

export default function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WalletExtrasProvider>
      {children}
    </WalletExtrasProvider>
  )
}
