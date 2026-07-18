import Web3Providers from '@/lib/Web3Providers'
import '../../styles/game.css'

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Providers>
      {children}
    </Web3Providers>
  )
}
