'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@/lib/WalletProvider'
import { useContractPlayer } from '@/lib/useContractPlayer'
import { PlayerProfile, LeaderboardEntry, CHARACTER_CLASSES } from '@/lib/contract'
import DungeonGame from './DungeonGame'
import MainMenu from './MainMenu'
import UsernameSetup from './UsernameSetup'
import Leaderboard from './Leaderboard'

type GamePhase = 'menu' | 'username-setup' | 'character-select' | 'game' | 'leaderboard'

/**
 * GameFlowManager orchestrates the entire NullState game flow:
 * 1. Show MainMenu with wallet connection
 * 2. Handle Continue/New Game/Leaderboard options
 * 3. Show UsernameSetup for new players before character selection
 * 4. Pass to DungeonGame for actual gameplay
 * 5. Show Leaderboard when requested
 *
 * All player progress is stored ON-CHAIN via the contract.
 */
export default function GameFlowManager() {
  const { address, isConnected } = useWallet()
  const { playerProfile, isLoading: isLoadingProfile, registerPlayer, fetchLeaderboard } = useContractPlayer(address || undefined)

  const [phase, setPhase] = useState<GamePhase>('menu')
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([])
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false)
  const [selectedCharacterClass, setSelectedCharacterClass] = useState<number>(CHARACTER_CLASSES.WARRIOR)
  const [error, setError] = useState<string | null>(null)

  // If wallet disconnects, go back to menu
  useEffect(() => {
    if (!isConnected) {
      setPhase('menu')
    }
  }, [isConnected])

  const handleNewGame = () => {
    setPhase('username-setup')
  }

  const handleContinueGame = (profile: PlayerProfile) => {
    // Jump straight into the game with their existing profile
    setPhase('game')
  }

  const handleUsernameSet = async (username: string) => {
    try {
      setError(null)
      // Register player on-chain with selected character class
      await registerPlayer(username, selectedCharacterClass)
      // After registration, move to game
      setPhase('game')
    } catch (err) {
      const message = (err as any)?.message || 'Failed to register player'
      setError(message)
    }
  }

  const handleCharacterSelect = (charClass: number) => {
    setSelectedCharacterClass(charClass)
    // Auto-proceed to username setup
    setPhase('username-setup')
  }

  const handleLeaderboardClick = async () => {
    setPhase('leaderboard')
    setIsLoadingLeaderboard(true)
    try {
      const entries = await fetchLeaderboard(100)
      setLeaderboardEntries(entries)
    } catch (err) {
      console.error('[v0] Failed to load leaderboard:', err)
    } finally {
      setIsLoadingLeaderboard(false)
    }
  }

  const handleBackToMenu = () => {
    setPhase('menu')
    setError(null)
  }

  // Character classes with descriptions (would come from game config normally)
  const CHARACTER_OPTIONS = [
    {
      id: 'warrior',
      name: 'Warrior',
      class: CHARACTER_CLASSES.WARRIOR,
      description: 'Balanced fighter with strong melee',
    },
    {
      id: 'mage',
      name: 'Mage',
      class: CHARACTER_CLASSES.MAGE,
      description: 'Ranged spellcaster',
    },
    {
      id: 'rogue',
      name: 'Rogue',
      class: CHARACTER_CLASSES.ROGUE,
      description: 'Swift and deadly',
    },
    {
      id: 'paladin',
      name: 'Paladin',
      class: CHARACTER_CLASSES.PALADIN,
      description: 'Holy defender',
    },
  ]

  // PHASE: MENU
  if (phase === 'menu') {
    return (
      <MainMenu
        onContinueGame={handleContinueGame}
        onNewGame={handleNewGame}
        onLeaderboard={handleLeaderboardClick}
        playerProfile={playerProfile}
        isLoadingProfile={isLoadingProfile}
      />
    )
  }

  // PHASE: CHARACTER SELECT
  if (phase === 'username-setup' && !playerProfile?.isRegistered) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[rgba(0,0,0,0.95)] p-6">
        {/* Glow orb */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 700,
            height: 700,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,255,136,0.08) 0%, rgba(0,170,255,0.03) 40%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        <div className="relative z-10 max-w-2xl w-full text-center">
          {/* Title */}
          <div className="font-mono text-[11px] tracking-[6px] text-null-green uppercase mb-8">
            // CHOOSE YOUR WALKER
          </div>

          <h2 className="font-display font-black text-null-white mb-8" style={{ fontSize: '52px' }}>
            SELECT CHARACTER
          </h2>

          {/* Character grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {CHARACTER_OPTIONS.map((char) => (
              <button
                key={char.id}
                onClick={() => handleCharacterSelect(char.class)}
                className={`p-6 border-2 transition-all duration-200 text-center ${
                  selectedCharacterClass === char.class
                    ? 'border-null-green bg-[rgba(0,255,136,0.1)]'
                    : 'border-[rgba(0,255,136,0.3)] hover:border-[rgba(0,255,136,0.6)]'
                }`}
                style={{
                  clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
                }}
              >
                <div className="font-mono font-bold text-null-green mb-2 text-lg">
                  {char.name.toUpperCase()}
                </div>
                <p className="text-null-muted text-xs font-mono">{char.description}</p>
              </button>
            ))}
          </div>

          {/* Username setup component */}
          <UsernameSetup
            onUsernameSet={handleUsernameSet}
            onCancel={handleBackToMenu}
            isLoading={isLoadingProfile}
          />

          {error && (
            <div className="mt-4 p-3 bg-[rgba(255,59,48,0.2)] border border-[rgba(255,59,48,0.5)] text-null-red font-mono text-xs">
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  // PHASE: USERNAME SETUP (shown inside above, so this is redundant, but kept for clarity)
  if (phase === 'username-setup') {
    return (
      <UsernameSetup
        onUsernameSet={handleUsernameSet}
        onCancel={handleBackToMenu}
        isLoading={isLoadingProfile}
      />
    )
  }

  // PHASE: LEADERBOARD
  if (phase === 'leaderboard') {
    return (
      <Leaderboard
        onBack={handleBackToMenu}
        isLoading={isLoadingLeaderboard}
        entries={leaderboardEntries}
      />
    )
  }

  // PHASE: GAME
  if (phase === 'game') {
    return <DungeonGame />
  }

  return null
}
