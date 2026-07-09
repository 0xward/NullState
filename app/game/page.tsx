import type { Metadata } from 'next'
import GameFlowManager from '@/components/game/GameFlowManager'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'NullState // Play',
  description: 'Continue your run, start a new game, check the leaderboard, or review your rewards in NullState.',
}

// /game always drops straight into the in-game MainMenu (Continue / New
// Game / Leaderboard / Rewards) — there is no separate "dashboard" landing
// step anymore. The old GameDashboard (Player Profile / Vault Quest / Season
// Leaderboard cards) is still in the codebase but is no longer routed to by
// default; nothing links to it any more.
export default function GamePage() {
  return <GameFlowManager />
}
