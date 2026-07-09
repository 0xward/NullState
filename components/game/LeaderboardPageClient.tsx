'use client'

import { useWallet } from '@/lib/WalletProvider'
import LeaderboardDisplay from './LeaderboardDisplay'
import RewardClaimButton from './RewardClaimButton'

export default function LeaderboardPageClient() {
  const { address } = useWallet()
  return (
    <div className="space-y-6">
      <LeaderboardDisplay walletAddress={address ?? undefined} />
      <RewardClaimButton walletAddress={address ?? undefined} />
    </div>
  )
}
