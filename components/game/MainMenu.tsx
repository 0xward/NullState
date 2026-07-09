'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@/lib/WalletProvider'
import { PlayerProfile } from '@/lib/contract'

interface MainMenuProps {
  onContinueGame: (profile: PlayerProfile) => void
  onNewGame: () => void
  onLeaderboard: () => void
  onRewards: () => void
  onMintPass: () => void
  playerProfile: PlayerProfile | null
  isLoadingProfile: boolean
}

export default function MainMenu({
  onContinueGame,
  onNewGame,
  onLeaderboard,
  onRewards,
  onMintPass,
  playerProfile,
  isLoadingProfile,
}: MainMenuProps) {
  const { address, isConnected } = useWallet()
  const [selectedOption, setSelectedOption] = useState<'continue' | 'new' | 'leaderboard' | 'rewards' | 'season-pass' | null>(null)

  // Auto-enable Continue if player has a profile
  useEffect(() => {
    if (playerProfile?.isRegistered) {
      setSelectedOption('continue')
    }
  }, [playerProfile?.isRegistered])

  const handleContinue = () => {
    if (playerProfile?.isRegistered) {
      onContinueGame(playerProfile)
    }
  }

  const handleNew = () => {
    onNewGame()
  }

  const handleLeaderboard = () => {
    onLeaderboard()
  }

  const handleRewards = () => {
    onRewards()
  }

  const handleMintPass = () => {
    onMintPass()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[rgba(0,0,0,0.95)] p-6">
      {/* Glow orbs */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,255,136,0.08) 0%, rgba(0,170,255,0.02) 40%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      <div className="relative z-10 max-w-lg w-full text-center">
        {/* Title */}
        <div className="font-mono text-[11px] tracking-[6px] text-null-green uppercase mb-8">
          // NULLSTATE // MAIN MENU
        </div>

        <h2 className="font-display font-black text-null-white mb-2" style={{ fontSize: '56px' }}>
          WELCOME
        </h2>

        {playerProfile?.isRegistered && (
          <p className="text-null-green font-mono text-sm mb-8 tracking-[2px]">
            {playerProfile.username.toUpperCase()} // LEVEL {playerProfile.level}
          </p>
        )}

        {isLoadingProfile && (
          <p className="text-null-muted font-mono text-xs mb-8 tracking-[1px] animate-pulse">
            // loading player profile...
          </p>
        )}

        {/* Menu Options */}
        <div className="space-y-4">
          {/* CONTINUE - only if player has profile */}
          {playerProfile?.isRegistered ? (
            <button
              onClick={handleContinue}
              className="w-full font-mono text-sm tracking-[2px] uppercase text-null-bg bg-null-green px-8 py-4 transition-all duration-200 relative overflow-hidden group"
              style={{
                clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'var(--null-acid)'
                el.style.boxShadow = '0 0 30px rgba(0,255,136,0.6)'
                el.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'var(--null-green)'
                el.style.boxShadow = 'none'
                el.style.transform = 'translateY(0)'
              }}
            >
              ◈ CONTINUE GAME
            </button>
          ) : (
            <button
              disabled
              className="w-full font-mono text-sm tracking-[2px] uppercase text-null-muted px-8 py-4 bg-[rgba(0,255,136,0.1)] cursor-not-allowed"
              style={{
                clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
              }}
            >
              ◈ CONTINUE GAME (NO SAVE)
            </button>
          )}

          {/* NEW GAME */}
          <button
            onClick={handleNew}
            className="w-full font-mono text-sm tracking-[2px] uppercase text-null-green border-2 border-[rgba(0,255,136,0.4)] px-8 py-4 transition-all duration-200 hover:border-null-green hover:bg-[rgba(0,255,136,0.05)]"
            style={{
              clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
            }}
          >
            ⬡ NEW GAME
          </button>

          {/* LEADERBOARD */}
          <button
            onClick={handleLeaderboard}
            className="w-full font-mono text-sm tracking-[2px] uppercase text-null-blue border-2 border-[rgba(0,170,255,0.4)] px-8 py-4 transition-all duration-200 hover:border-null-blue hover:bg-[rgba(0,170,255,0.05)]"
            style={{
              clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
            }}
          >
            ◆ LEADERBOARD
          </button>

          {/* REWARDS — mining/burn history, XP, and USDm totals */}
          <button
            onClick={handleRewards}
            className="w-full font-mono text-sm tracking-[2px] uppercase text-null-amber border-2 border-[rgba(255,190,11,0.4)] px-8 py-4 transition-all duration-200 hover:border-null-amber hover:bg-[rgba(255,190,11,0.05)]"
            style={{
              clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
            }}
          >
            ◇ REWARDS
          </button>

          {/* MINT PASS — season pass minting screen */}
          <button
            onClick={handleMintPass}
            className="w-full font-mono text-sm tracking-[2px] uppercase text-null-acid border-2 border-[rgba(168,255,62,0.4)] px-8 py-4 transition-all duration-200 hover:border-null-acid hover:bg-[rgba(168,255,62,0.05)]"
            style={{
              clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
            }}
          >
            ⬢ MINT PASS
          </button>
        </div>

        {/* Wallet Info */}
        <div className="mt-12 pt-8 border-t border-[rgba(0,255,136,0.2)]">
          <p className="font-mono text-[10px] text-null-muted tracking-[2px] mb-2">
            // CONNECTED WALLET
          </p>
          <p className="font-mono text-xs text-null-green break-all">
            {address || 'NOT CONNECTED'}
          </p>
        </div>
      </div>
    </div>
  )
}
