'use client'

/**
 * Web3Providers.tsx
 *
 * Satu-satunya tempat konfigurasi wagmi + RainbowKit.
 * Dipisah dari layout.tsx agar layout tetap Server Component.
 *
 * ENV yang dibutuhkan (sudah diisi di Vercel):
 *   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
 */

import { ReactNode } from 'react'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { celo } from 'wagmi/chains'
import {
  RainbowKitProvider,
  darkTheme,
  getDefaultConfig,
} from '@rainbow-me/rainbowkit'
import {
  injectedWallet,
  metaMaskWallet,
  walletConnectWallet,
  rainbowWallet,
  coinbaseWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WalletProvider from '@/lib/WalletProvider'

// ─── RainbowKit stylesheet ────────────────────────────────────────────────────
import '@rainbow-me/rainbowkit/styles.css'

// ─── Wagmi config ─────────────────────────────────────────────────────────────

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'default-project-id'

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
  // Reminder di console — tidak crash, tapi WalletConnect modal tidak akan muncul
  console.warn('[NullState] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID tidak di-set. Using default.')
}

const config = getDefaultConfig({
  appName:   'NULL_STATE // Web3 RPG on Celo',
  projectId,
  chains:    [celo],
  transports: {
    [celo.id]: http('https://forno.celo.org'),
  },
  // Wallet list — injected (MiniPay / MetaMask extension) diutamakan
  wallets: [
    {
      groupName: 'Recommended',
      wallets: [injectedWallet, metaMaskWallet],
    },
    {
      groupName: 'More',
      wallets: [walletConnectWallet, rainbowWallet, coinbaseWallet],
    },
  ],
  ssr: true, // Next.js App Router
})

// ─── QueryClient (satu instance, stabil antar render) ─────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000 },
  },
})

// ─── RainbowKit custom theme (sesuai visual NULL_STATE) ───────────────────────

const nullTheme = darkTheme({
  accentColor:          '#00ff88',
  accentColorForeground: '#0a0e0c',
  borderRadius:         'small',
  fontStack:            'system',
})

// ─── Provider tree ────────────────────────────────────────────────────────────

export default function Web3Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={nullTheme} locale="en-US">
          {/*
            WalletProvider membungkus sisa app dan expose useWallet() hook
            yang dipakai oleh Navbar, GameFullUI, dan komponen lainnya.
          */}
          <WalletProvider>
            {children}
          </WalletProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
