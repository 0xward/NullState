'use client'

import { ReactNode, createContext, useContext, useState, useCallback, useEffect } from 'react'
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
import { USDM_ADDRESS, USDM_ABI } from './contract-abi'
import { getUserFriendlyError, WalletFriendlyError, MINIPAY_ADD_CASH_URL } from './errorUtils'
import { NavbarWalletContext } from './NavbarWalletContext'
import { MARKETPLACE_TOKENS, TREASURY_WALLET, parseTokenAmount, MarketplaceTokenSymbol, getFeeCurrency, pickBestFeeCurrency } from './constants/tokens'

// ─── Contract config ─────────────────────────────────────────────────────────

export const NULLSTATE_ADDRESS  = '0xE6C471DD3C715DB8B10457113867885AFA12eC13' as `0x${string}`
export const CELO_CHAIN_ID      = 42220
export const CELO_SEPOLIA_CHAIN_ID = 11142220
// NULL_STRIKE fee: 0.005 USDm (18 decimals), sent as a plain ERC20 transfer
// to the NullStateReward contract address (funds the weekly pool). This is
// NOT executeAction() on NullState.sol — that contract hard-requires exactly
// 0.01 native CELO and cannot accept USDm without a redeploy.
export const NULL_STRIKE_FEE_USDM_WEI = BigInt('5000000000000000') // 0.005 USDm

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
// NOTE (removed 2026-07-12): `ExecuteActionParams`, `PlayerData`, and
// `RaidData` were only used by the dead functions removed above (see the
// NOTE comments further down this file) — deleted alongside them.

// Extra context values that GameFullUI expects beyond wagmi hooks
interface WalletExtras {
  isMiniPay: boolean
  celoBalance: string
  error: string | null
  insufficientFunds: boolean
  addCashUrl: string | null
  // Plain ERC20 USDm transfer() to an arbitrary address (e.g. the reward
  // contract, to fund the weekly pool for a NULL_STRIKE cast). Does NOT
  // touch NullState.sol / executeAction.
  payUsdmFee: (amountWei: bigint, toAddress: `0x${string}`) => Promise<string>
  // Marketplace purchase: plain ERC20 transfer() of `priceUsd` worth of the
  // chosen stablecoin (USDm/USDC/USDT) to the treasury wallet. No contract.
  buyMarketplaceItem: (priceUsd: number, token: MarketplaceTokenSymbol) => Promise<string>
  // Same function as buyMarketplaceItem, generic name — used by PassSBT
  // minting (usePassSBT.ts) so that call site doesn't read like it's
  // buying a marketplace item.
  payToTreasury: (priceUsd: number, token: MarketplaceTokenSymbol) => Promise<string>
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

  // Context-safe: return safe defaults when called outside WalletProvider
  // (e.g. Navbar on public routes where Web3Providers is not loaded).
  if (!extras) {
    return {
      address:      null,
      chainId:      null,
      isConnected:  false,
      isConnecting: false,
      isMiniPay:    false,
      celoBalance:  '0.00',
      error:        null,
      insufficientFunds: false,
      addCashUrl:   null,
      connect:      async () => {},
      disconnect:   () => {},
      switchToCelo: async () => {},
      payUsdmFee:     async () => { throw new Error('No wallet context') },
      buyMarketplaceItem: async () => { throw new Error('No wallet context') },
      payToTreasury:  async () => { throw new Error('No wallet context') },
    }
  }

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
    insufficientFunds: extras.insufficientFunds,
    addCashUrl:   extras.addCashUrl,
    connect:      connectWallet,
    disconnect,
    switchToCelo,
    payUsdmFee:     extras.payUsdmFee,
    buyMarketplaceItem: extras.buyMarketplaceItem,
    payToTreasury:  extras.payToTreasury,
  }
}

// ─── Inner provider (needs wagmi hooks, so must be a child of WagmiProvider) ─

function WalletExtrasProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount()
  const publicClient  = usePublicClient({ chainId: CELO_CHAIN_ID })
  const { data: walletClient } = useWalletClient({ chainId: CELO_CHAIN_ID })
  const { data: balanceData }  = useBalance({ address, chainId: CELO_CHAIN_ID })

  const [error, setError] = useState<string | null>(null)
  const [insufficientFunds, setInsufficientFunds] = useState(false)

  // Detect MiniPay (injected wallet with isMiniPay flag)
  const isMiniPay =
    typeof window !== 'undefined' &&
    !!(window as unknown as { ethereum?: { isMiniPay?: boolean } }).ethereum?.isMiniPay

  // MiniPay requirement: no manual "connect wallet" button — connection is
  // silent on load. The written requirement is specifically "no Connect
  // Wallet button when window.ethereum.isMiniPay === true" — it does not
  // forbid connecting outside MiniPay too. Auto-connecting any injected
  // wallet (MiniPay, MetaMask in-app browser, etc.) keeps that broader
  // compatibility while still fully satisfying the requirement, since
  // there is no manual connect button anywhere in the UI regardless.
  // isMiniPay is kept for display/analytics purposes but does NOT gate
  // connection (confirmed decision, 2026-07-14 — see network-manifest.md).
  const { connect, connectors } = useConnect()
  useEffect(() => {
    if (isConnected) return
    const injectedConnector = connectors.find(c => c.id === 'injected') ?? connectors[0]
    if (injectedConnector) connect({ connector: injectedConnector, chainId: CELO_CHAIN_ID })
  }, [isConnected, connect, connectors])

  const celoBalance = balanceData
    ? (Number(balanceData.value) / 10 ** balanceData.decimals).toFixed(2)
    : '0.00'

  // ── Send transaction helper ───────────────────────────────────────────────

  const sendTx = useCallback(
    async (data: `0x${string}`, value?: bigint): Promise<string> => {
      if (!walletClient || !address) throw new Error('Wallet not connected')
      setError(null)
      setInsufficientFunds(false)
      try {
        // MiniPay Custom Fee Abstraction (CIP-64): most MiniPay users hold
        // stablecoins, not native CELO, so pick whichever of USDm/USDC/USDT
        // the user actually holds the most of (falls back to USDm if the
        // balance check can't run). MiniPay may still ignore this and pick
        // whichever token the user holds most of on its own — that's
        // documented/expected behavior, not a bug.
        const feeCurrency = await pickBestFeeCurrency(publicClient, address)
        const hash = await walletClient.sendTransaction({
          account: address,
          chain:   celo,
          to:      NULLSTATE_ADDRESS,
          data,
          value:   value ?? BigInt(0),
          feeCurrency,
          // Let the wallet estimate gas — safer than hardcoding
          // gas is omitted intentionally so the RPC estimates it
        })
        return hash
      } catch (e: unknown) {
        const friendlyError = getUserFriendlyError(e)
        setError(friendlyError.message)
        setInsufficientFunds(friendlyError.insufficientFunds)
        throw new WalletFriendlyError(friendlyError, e)
      }
    },
    [walletClient, address]
  )

  // ── Contract write functions ──────────────────────────────────────────────
  // NOTE (removed 2026-07-12): this file used to also export `registerPlayer`,
  // `respawnPlayer`, `executeAction`, and `attackRaid` — thin wrappers around
  // NullState.sol's register()/respawn()/executeAction()/attackRaidBoss().
  // None of them were ever called by any component: the live registration
  // flow goes through `useContractPlayer.ts`'s own `registerPlayer` (a
  // separate, still-used implementation), NULL_STRIKE goes through
  // `payUsdmFee()` below, and the raid-boss/respawn mechanics they supported
  // were already gone from the game. Removed as confirmed-dead code, not
  // touching the live paths (registerPlayer in useContractPlayer.ts,
  // payUsdmFee, buyMarketplaceItem below).

  // Plain ERC20 USDm transfer() — used for the NULL_STRIKE fee. Sends
  // directly to `toAddress` (the reward contract), NOT through NullState.sol.
  const payUsdmFee = useCallback(
    async (amountWei: bigint, toAddress: `0x${string}`): Promise<string> => {
      if (!walletClient || !address) throw new Error('Wallet not connected')
      if (typeof amountWei !== 'bigint' || amountWei <= BigInt(0)) {
        throw new Error('Invalid USDm fee amount')
      }
      setError(null)
      setInsufficientFunds(false)
      const data = encodeFunctionData({
        abi:          USDM_ABI,
        functionName: 'transfer',
        args:         [toAddress, amountWei],
      })
      try {
        // The 0.005 USDm fee itself is always paid in USDm (fixed, by
        // design) — this only picks which token covers GAS. A user sitting
        // on just enough USDm for the fee but nothing left over shouldn't
        // fail here if they're holding USDC/USDT for gas instead.
        const feeCurrency = await pickBestFeeCurrency(publicClient, address)
        const hash = await walletClient.sendTransaction({
          account: address,
          chain:   celo,
          to:      USDM_ADDRESS,
          data,
          value:   BigInt(0),
          feeCurrency,
        })
        return hash
      } catch (e: unknown) {
        const friendlyError = getUserFriendlyError(e)
        setError(friendlyError.message)
        setInsufficientFunds(friendlyError.insufficientFunds)
        throw new WalletFriendlyError(friendlyError, e)
      }
    },
    [walletClient, address]
  )

  // ── Generic treasury payment ─────────────────────────────────────────────
  // Sends `priceUsd` of the chosen stablecoin (1:1 USD) to the treasury as a
  // plain ERC20 transfer(). Returns the tx hash; a backend route then
  // verifies it on-chain before granting whatever it unlocks. Originally
  // written for Marketplace item purchases (offchain ownership in Firebase)
  // — reused as-is for PassSBTv2 minting (v2.1, this session), since it's
  // already fully generic: it doesn't know or care what the payment is for,
  // only that `priceUsd` gets sent to TREASURY_WALLET in `token`. Exported
  // under both names below so each call site reads clearly.
  const payToTreasury = useCallback(
    async (priceUsd: number, token: MarketplaceTokenSymbol): Promise<string> => {
      if (!walletClient || !address) throw new Error('Wallet not connected')
      const cfg = MARKETPLACE_TOKENS[token]
      if (!cfg) throw new Error('Unsupported token')
      const amountWei = parseTokenAmount(String(priceUsd), token)
      if (amountWei <= BigInt(0)) throw new Error('Invalid price')
      setError(null)
      setInsufficientFunds(false)
      const data = encodeFunctionData({
        abi:          USDM_ABI, // ERC20 transfer(address,uint256) — same for all 3 tokens
        functionName: 'transfer',
        args:         [TREASURY_WALLET as `0x${string}`, amountWei],
      })
      try {
        const hash = await walletClient.sendTransaction({
          account: address,
          chain:   celo,
          to:      cfg.address as `0x${string}`,
          data,
          value:   BigInt(0),
          // USDC/USDT use a separate fee-adapter contract per docs.minipay.xyz
          // — passing the raw token address here would be wrong for those two.
          feeCurrency: getFeeCurrency(token),
        })
        return hash
      } catch (e: unknown) {
        const friendlyError = getUserFriendlyError(e)
        setError(friendlyError.message)
        setInsufficientFunds(friendlyError.insufficientFunds)
        throw new WalletFriendlyError(friendlyError, e)
      }
    },
    [walletClient, address]
  )

  // NOTE (removed 2026-07-12): `attackRaid`, `readPlayer`, and `readRaid`
  // were also dead code — same as the write functions removed above. None
  // had any caller anywhere in components/ or app/, so all three (plus the
  // registerPlayer/respawnPlayer/executeAction removed above) were deleted
  // together as one cleanup pass. Only `payUsdmFee` and `buyMarketplaceItem`
  // remain as this provider's live on-chain write paths.

  const extras: WalletExtras = {
    isMiniPay,
    celoBalance,
    error,
    insufficientFunds,
    addCashUrl: insufficientFunds ? MINIPAY_ADD_CASH_URL : null,
    payUsdmFee,
    buyMarketplaceItem: payToTreasury, // kept for MarketplaceScreen.tsx, unchanged behavior
    payToTreasury, // same function — used by usePassSBT.ts for pass minting
  }

  // NavbarWalletContext: pure React context, no wagmi hooks — safe for SSR.
  // Provides Navbar with live wallet status on wallet routes.
  const navbarWallet = {
    isConnected,
    address: address ?? null,
    isMiniPay,
    error,
    addCashUrl: insufficientFunds ? MINIPAY_ADD_CASH_URL : null,
  }

  return (
    <NavbarWalletContext.Provider value={navbarWallet}>
      <WalletExtrasContext.Provider value={extras}>
        {children}
      </WalletExtrasContext.Provider>
    </NavbarWalletContext.Provider>
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
