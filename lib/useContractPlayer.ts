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
import { readCachedProfile, writeCachedProfile } from '@/lib/profileCache'

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
      // IN PARALLEL. These are two independent Firestore documents — the
      // username doc and the leaderboard entry — and nothing in the second
      // depends on the first. Awaiting them one after the other paid two full
      // round trips instead of one, and the world map's largest element is the
      // name, so the player watched the wait. allSettled rather than all: a
      // missing leaderboard entry is normal for a brand-new wallet and must not
      // take the username down with it.
      const [nameRes, entryRes] = await Promise.allSettled([
        getOrCreateUsername(walletAddress),          // auto-assigns if new
        getLeaderboardEntry(walletAddress),          // xp/level/kills, all off-chain now
      ])

      if (nameRes.status === 'rejected') throw nameRes.reason
      const { username } = nameRes.value
      const liveEntry = entryRes.status === 'fulfilled' ? entryRes.value : null

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
      writeCachedProfile(profile)

      // Keep the leaderboard entry fresh (username/xp/level). Deliberately does
      // NOT pass kills — that figure is maintained separately by
      // recordRunKills() (see leaderboardService.ts).
      updateLeaderboardEntry(walletAddress, username, profile.xp, profile.level)
    } catch (err) {
      console.error('[v0] Failed to fetch player profile:', err)
      // Only blank the profile if there is no cached one to fall back on.
      // Offline or a Firestore hiccup should not turn a returning player back
      // into an anonymous WALKER.
      setPlayerProfile((prev) => prev ?? readCachedProfile(walletAddress))
    } finally {
      setIsLoading(false)
    }
  }, [walletAddress])

  // Paint the last known profile FIRST, then refresh it. This is what removes
  // the name from the critical path: the plate shows the real player instantly
  // and the fetch below quietly agrees with it a moment later.
  useEffect(() => {
    if (!walletAddress) { setPlayerProfile(null); return }
    const cached = readCachedProfile(walletAddress)
    if (cached) setPlayerProfile(cached)
    fetchPlayerProfile()
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

        setPlayerProfile((prev) => {
          const next: PlayerProfile = prev
            ? { ...prev, username: savedUsername }
            : {
                walletAddress,
                username: savedUsername,
                xp: 0,
                level: 1,
                kills: 0,
                isRegistered: true,
              }
          // Keep the cache honest, or the next load paints the OLD name for a
          // moment before the fetch corrects it — worse than no cache at all.
          writeCachedProfile(next)
          return next
        })

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
