'use client'

import { useEffect } from 'react'
import { useWallet } from '@/lib/WalletProvider'
import { recordRunKills } from '@/lib/leaderboardService'
import { PlayerProfile } from '@/lib/contract'
import DungeonGame from './DungeonGame'

interface DungeonGameWrapperProps {
  playerProfile: PlayerProfile | null
  setPlayerUsername: (username: string) => Promise<{ success: boolean; username: string }>
}

/**
 * DungeonGameWrapper
 *
 * Wraps DungeonGame and hooks into game events that need to reach outside
 * the vanilla-JS engine:
 *  - 'nullstate-player-death': fold this life's kill count into the
 *    off-chain Firestore leaderboard (recordRunKills is dedup-safe, see
 *    leaderboardService.ts). This is intentionally FREE — it does NOT call
 *    useContractPlayer/executeAction on-chain. Automatic on-death syncing
 *    must never cost the player gas; on-chain writes only ever happen from
 *    an explicit player action (NULL_STRIKE fee, manual claim, etc).
 *  - 'nullstate-items-burned': forward the burn payload to the backend so
 *    it can validate it and record it (Firestore + on-chain recordBurn via
 *    the backend signer — see app/api/burn/record/route.ts).
 */
export default function DungeonGameWrapper({ playerProfile, setPlayerUsername }: DungeonGameWrapperProps) {
  const { address } = useWallet()

  useEffect(() => {
    const handleGameDeath = (event: Event) => {
      const { kills } = (event as CustomEvent).detail ?? {}
      if (!address || typeof kills !== 'number') return
      recordRunKills(address, kills).catch(err => {
        console.error('[nullstate-player-death] failed to record kills:', err)
      })
    }
    window.addEventListener('nullstate-player-death', handleGameDeath)
    return () => window.removeEventListener('nullstate-player-death', handleGameDeath)
  }, [address])

  useEffect(() => {
    const handleBurn = async (event: Event) => {
      const detail = (event as CustomEvent).detail
      try {
        await fetch('/api/burn/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(detail),
        })
      } catch (err) {
        console.error('[nullstate-items-burned] failed to record burn:', err)
      }
    }
    window.addEventListener('nullstate-items-burned', handleBurn)
    return () => window.removeEventListener('nullstate-items-burned', handleBurn)
  }, [])

  return (
    <DungeonGame playerProfile={playerProfile} setPlayerUsername={setPlayerUsername} />
  )
}
