import type { Metadata } from 'next'
import GameFlowManager from '@/components/game/GameFlowManager'
import GameDashboard from '@/components/game/GameDashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'NullState Game Dashboard',
  description: 'Vault quests, leaderboard rankings, profile inventory, and reward claims for NullState.',
}

export default function GamePage({
  searchParams,
}: {
  searchParams?: { mode?: string }
}) {
  if (searchParams?.mode === 'play') return <GameFlowManager />
  return <GameDashboard />
}
