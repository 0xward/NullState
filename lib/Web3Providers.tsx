'use client'

/**
 * Web3Providers.tsx
 *
 * Konfigurasi wagmi minimal untuk MiniPay/injected-wallet dApps.
 * Dipisah dari layout.tsx agar layout tetap Server Component.
 *
 * MiniPay requirement: no manual connect button — connection is silent on load.
 * Only the injected connector is registered; RainbowKit has been removed.
 */

import { ReactNode } from 'react'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { celo, celoSepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WalletProvider from '@/lib/WalletProvider'

// ─── Wagmi config ─────────────────────────────────────────────────────────────

const config = createConfig({
  chains:    [celo, celoSepolia],
  connectors: [injected()],
  transports: {
    [celo.id]: http('https://forno.celo.org'),
    [celoSepolia.id]: http(),
  },
})

// Registers this config as wagmi's default `Config` generic app-wide, so
// `useWalletClient()`/`useSendTransaction()`/`writeContract()` etc. resolve
// to Celo's chain-formatted request type — which is what actually carries
// the `feeCurrency` (CIP-64 Custom Fee Abstraction) field in its types.
// Without this, TS has no way to know the connected chain supports
// feeCurrency and rejects it as an unknown property.
// https://wagmi.sh/react/typescript#registering-config
declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}

// ─── QueryClient (satu instance, stabil antar render) ─────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000 },
  },
})

// ─── Provider tree ────────────────────────────────────────────────────────────

export default function Web3Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {/*
          WalletProvider membungkus sisa app dan expose useWallet() hook
          yang dipakai oleh Navbar, GameFullUI, dan komponen lainnya.
        */}
        <WalletProvider>
          {children}
        </WalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
