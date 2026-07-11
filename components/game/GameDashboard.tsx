'use client'

import Link from 'next/link'
import { useAccount } from 'wagmi'
import VaultSubmitForm from '@/components/game/VaultSubmitForm'
import LeaderboardDisplay from '@/components/game/LeaderboardDisplay'
import PlayerProfileCard from '@/components/game/PlayerProfileCard'
import RewardClaimButton from '@/components/game/RewardClaimButton'

export default function GameDashboard() {
  const { address, isConnected } = useAccount()

  return (
    <main className="relative z-[2] mx-auto max-w-6xl px-6 pb-16 pt-28">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[rgba(0,255,136,0.2)] pb-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[4px] text-null-green">// NullState Dashboard</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-null-white">Game Control Panel</h1>
        </div>
        <div className="flex gap-3 text-xs font-mono uppercase tracking-[2px]">
          <Link href="/leaderboard" className="rounded border border-null-blue px-3 py-2 text-null-blue hover:bg-null-blue hover:text-black">Leaderboard</Link>
          <Link href="/profile" className="rounded border border-null-green px-3 py-2 text-null-green hover:bg-null-green hover:text-black">Profile</Link>
          <Link href="/game?mode=play" className="rounded border border-null-red px-3 py-2 text-null-red hover:bg-null-red hover:text-black">Play Core Game</Link>
        </div>
      </header>

      {!isConnected && (
        <p className="mb-6 rounded border border-[rgba(255,190,11,0.35)] bg-[rgba(255,190,11,0.08)] p-3 text-sm text-null-amber">
          Connect wallet to unlock smart-contract interactions.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <PlayerProfileCard walletAddress={address} />
        <LeaderboardDisplay walletAddress={address} />
        <VaultSubmitForm walletAddress={address} />
        <RewardClaimButton walletAddress={address} />
      </div>
    </main>
  )
}
