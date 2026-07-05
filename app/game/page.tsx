import type { Metadata } from 'next'
import GameFlowManager from '@/components/game/GameFlowManager'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Play NullState // The Forsaken Depths',
  description: 'Descend into the NULL_STATE. A real-time dungeon crawler on Celo — WASD to move, permadeath, and on-chain NULL_STRIKE ultimates.',
}

export default function GamePage() {
  return <GameFlowManager />
}
