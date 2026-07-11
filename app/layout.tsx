import type { Metadata } from 'next'
import '../styles/globals.css'

// ─── Web3 providers ──────────────────────────────────────────────────────────
import Web3Providers from '@/lib/Web3Providers'

export const metadata: Metadata = {
  title: 'NULL_STATE // Web3 RPG on Celo',
  description: 'A real-time dungeon crawler on Celo. Descend the Forsaken Depths, sign on-chain NULL_STRIKEs, and survive. Every death is permanent. Your wallet is your weapon.',
  keywords: ['Celo', 'Web3', 'RPG', 'MiniPay', 'blockchain game', 'AI RPG'],
  authors: [{ name: '0xward' }],
  openGraph: {
    title: 'NULL_STATE // Web3 RPG on Celo',
    description: 'A real-time dungeon crawler on Celo. Every NULL_STRIKE costs 0.01 CELO.',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Cinzel:wght@500;700&family=Rajdhani:wght@300;400;500;600;700&family=Orbitron:wght@400;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-null-bg text-null-white antialiased">
        {/*
          Web3Providers adalah 'use client' component yang membungkus:
          WagmiProvider → QueryClientProvider → RainbowKitProvider → WalletProvider
          Dipisah ke file sendiri agar layout.tsx ini tetap bisa jadi Server Component.
        */}
        <Web3Providers>
          {children}
        </Web3Providers>
      </body>
    </html>
  )
}
