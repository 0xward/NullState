import type { Metadata } from 'next'
import DungeonGame from '@/components/game/DungeonGame'

export const metadata: Metadata = {
  title: 'Play NullState // The Forsaken Depths',
  description: 'Descend into the NULL_STATE. A real-time dungeon crawler on Celo — WASD to move, permadeath, and on-chain NULL_STRIKE ultimates.',
}

export default function GamePage() {
  return <DungeonGame />
}
