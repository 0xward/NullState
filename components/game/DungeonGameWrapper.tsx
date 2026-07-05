'use client'

import { useEffect, useRef } from 'react'
import { useWallet } from '@/lib/WalletProvider'
import { useContractPlayer } from '@/lib/useContractPlayer'
import DungeonGame from './DungeonGame'

/**
 * DungeonGameWrapper
 * 
 * Wraps DungeonGame and hooks into game events to save player progress to the blockchain.
 * Listens for death events and writes final stats (XP, level, kills) to the smart contract.
 */
export default function DungeonGameWrapper() {
  const { address } = useWallet()
  const { updatePlayerProgress } = useContractPlayer(address || undefined)
  const updateProgressRef = useRef(updatePlayerProgress)
  
  // Keep updatePlayerProgress in ref for use in event listeners
  useEffect(() => {
    updateProgressRef.current = updatePlayerProgress
  }, [updatePlayerProgress])

  // Listen for game stats updates and save to contract
  useEffect(() => {
    const handleGameDeath = async (event: Event) => {
      const customEvent = event as CustomEvent
      const { xp, level, kills } = customEvent.detail
      
      if (!address || !updateProgressRef.current) {
        console.log('[v0] Game death event received but wallet not connected, skipping save')
        return
      }

      console.log('[v0] Player died - saving progress to contract:', { xp, level, kills })
      
      try {
        await updateProgressRef.current(xp, level, kills)
        console.log('[v0] Progress saved successfully!')
      } catch (err) {
        console.error('[v0] Failed to save progress to contract:', err)
        // Don't throw - let the game continue even if saving fails
      }
    }

    // Listen for custom death event from game engine
    window.addEventListener('nullstate-player-death', handleGameDeath)

    return () => {
      window.removeEventListener('nullstate-player-death', handleGameDeath)
    }
  }, [address])

  return <DungeonGame />
}
