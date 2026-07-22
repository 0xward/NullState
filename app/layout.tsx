import type { Metadata } from 'next'
import '../styles/globals.css'
import { fontVariables } from '@/lib/fonts'
import SplashScreen from '@/components/ui/SplashScreen'

// ─── NOTE: Web3Providers moved to per-route nested layouts ───────────────────
// app/game/layout.tsx and app/profile/layout.tsx wrap those routes with
// Web3Providers so the wagmi/viem bundle is NOT loaded on public routes
// (/, /terms, /privacy, /docs) — PageSpeed optimization (MiniPay requirement).

export const metadata: Metadata = {
  title: 'NULL_STATE // Web3 RPG on Celo',
  description: 'A real-time dungeon crawler on Celo. Descend the Forsaken Depths, unleash free NULL_STRIKEs, and survive. Permadeath is softened — die and respawn on the same floor. Earn stablecoin rewards, playable right inside MiniPay.',
  keywords: ['Celo', 'Web3', 'RPG', 'MiniPay', 'blockchain game'],
  authors: [{ name: '0xward' }],
  openGraph: {
    title: 'NULL_STATE // Web3 RPG on Celo',
    description: 'A real-time dungeon crawler on Celo. Play free, loot free — NULL_STRIKE is free too. Earn stablecoin rewards on MiniPay.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NULL_STATE // Web3 RPG on Celo',
    description: 'A real-time dungeon crawler on Celo. Descend the depths. Face The Gatekeeper.',
  },
  verification: {
    other: {
      'talentapp:project_verification': [
        'afcf1b34fdffc7dd7f199babb0c96d47f7dce7a63ef2fd61f45d47f5555aeb40c507603b1712082bdeaba31933f7593ed50e2a9d201d6a61c4d70992663a6737',
      ],
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={fontVariables}>
      <head>
        <meta name="color-scheme" content="dark" />
      </head>
      <body className="min-h-screen bg-null-bg text-null-white antialiased">
        {/* Boot splash — deep-black logo screen + 2.5s loading bar shown on
            open, then fades to reveal the page. Client component; renders over
            {children}, which loads normally behind it. */}
        <SplashScreen />
        {/*
          Web3Providers adalah 'use client' component yang membungkus:
          WagmiProvider → QueryClientProvider → RainbowKitProvider → WalletProvider
          Dipisah ke file sendiri agar layout.tsx ini tetap bisa jadi Server Component.
        */}
        {children}
      </body>
    </html>
  )
}
