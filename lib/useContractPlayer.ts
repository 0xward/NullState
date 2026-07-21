// Hook for player persistence.
//
// Phase 0: player identity and progress are now FULLY OFF-CHAIN. There is no
// on-chain register()/getPlayer() anymore — a player exists the moment they
// hold a Firebase username. XP, level and kills live in Firestore
// (leaderboardService). Only reward payouts touch the chain, elsewhere.

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  PlayerProfile,
  LeaderboardEntry,
} from '@/lib/contract'
import {
  getOrCreateUsername,
  setUsername,
  isUsernameAvailable,
} from '@/lib/usernameService'
import { updateLeaderboardEntry, getLeaderboard, getLeaderboardEntry } from '@/lib/leaderboardService'

export function useContractPlayer(walletAddress: string | undefined) {
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch player profile from Firebase (username + live leaderboard stats).
  const fetchPlayerProfile = useCallback(async () => {
    if (!walletAddress) return

    setIsLoading(true)
    setError(null)

    try {
      // Username from Firebase (auto-assign if new).
      const { username } = await getOrCreateUsername(walletAddress)

      // Live xp/level/kills come entirely from Firestore now — combat and
      // progression are off-chain, synced via recordRunProgress()/
      // recordRunKills() (see leaderboardService.ts, called from
      // DungeonGame.tsx on save/death).
      const liveEntry = await getLeaderboardEntry(walletAddress)

      const profile: PlayerProfile = {
        walletAddress,
        username,
        xp: liveEntry?.xp ?? 0,
        level: liveEntry?.level ?? 1,
        kills: liveEntry?.totalKills ?? 0,
        // Off-chain: holding a Firebase username IS being registered.
        isRegistered: true,
      }

      setPlayerProfile(profile)

      // Keep the leaderboard entry fresh (username/xp/level). Deliberately does
      // NOT pass kills — that figure is maintained separately by
      // recordRunKills() (see leaderboardService.ts).
      updateLeaderboardEntry(walletAddress, username, profile.xp, profile.level)
    } catch (err) {
      console.error('[v0] Failed to fetch player profile:', err)
      setPlayerProfile(null)
    } finally {
      setIsLoading(false)
    }
  }, [walletAddress])

  // Fetch when wallet connects
  useEffect(() => {
    if (walletAddress) {
      fetchPlayerProfile()
    }
  }, [walletAddress, fetchPlayerProfile])

  // Set player username (Firebase only, no gas)
  const setPlayerUsername = useCallback(
    async (username: string) => {
      if (!walletAddress) throw new Error('Wallet not connected')

      setIsLoading(true)
      setError(null)

      try {
        const available = await isUsernameAvailable(username, walletAddress)
        if (!available) {
          throw new Error('Username already taken')
        }

        const savedUsername = await setUsername(walletAddress, username, false)

        setPlayerProfile((prev) =>
          prev
            ? { ...prev, username: savedUsername }
            : {
                walletAddress,
                username: savedUsername,
                xp: 0,
                level: 1,
                kills: 0,
                isRegistered: true,
              }
        )

        return { success: true, username: savedUsername }
      } catch (err) {
        const message = (err as any)?.message || 'Failed to set username'
        setError(message)
        console.error('[v0] Set username error:', err)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [walletAddress]
  )

  // Leaderboard is read straight from Firestore (see leaderboardService.ts).
  // Entries are kept fresh by updateLeaderboardEntry(), called from
  // fetchPlayerProfile() and from recordRunProgress()/recordRunKills().
  const fetchLeaderboard = useCallback(async (): Promise<LeaderboardEntry[]> => {
    return getLeaderboard(100)
  }, [])

  return {
    playerProfile,
    isLoading,
    error,
    fetchPlayerProfile,
    setPlayerUsername,
    fetchLeaderboard,
  }
}
