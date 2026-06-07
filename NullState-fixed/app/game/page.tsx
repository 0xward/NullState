import type { Metadata } from 'next'
import GameFullUI from '@/components/game/GameFullUI'

export const metadata: Metadata = {
  title: 'Play NullState // Web3 RPG on Celo',
  description: 'Enter the dungeon. Fight blockchain monsters. Every action costs 0.01 CELO.',
}

export default function GamePage() {
  return <GameFullUI />
}
