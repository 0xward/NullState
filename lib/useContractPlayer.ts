/**
 * Hook to interact with NullState smart contract for player persistence
 * 
 * ON-CHAIN (Celo): XP, level, kills via getPlayer()
 * OFF-CHAIN (Firebase): Username via usernameService
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { CELO_CHAIN_ID } from '@/lib/WalletProvider'
import {
  NULLSTATE_CONTRACT_ADDRESS,
  NULLSTATE_CONTRACT_ABI,
  PlayerProfile,
  LeaderboardEntry,
} from '@/lib/contract'
import {
  getOrCreateUsername,
  setUsername,
  isUsernameAvailable,
} from '@/lib/usernameService'

export function useContractPlayer(walletAddress: string | undefined) {
  const publicClient = usePublicClient({ chainId: CELO_CHAIN_ID })
  const { data: walletClient } = useWalletClient()

  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateProgressRef = useRef<(xp: number, level: number, kills: number) => Promise<void>>()

  // Fetch player profile from contract + Firebase
  const fetchPlayerProfile = useCallback(async () => {
    if (!walletAddress || !publicClient) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await publicClient.readContract({
        address: NULLSTATE_CONTRACT_ADDRESS as `0x${string}`,
        abi: NULLSTATE_CONTRACT_ABI,
        functionName: 'getPlayer',
        args: [walletAddress as `0x${string}`],
      })

      const [exists, hp, maxHp, xp, level, kills, deaths, passportVerified, artifactCount] =
        result as any

      if (!exists) {
        setPlayerProfile(null)
        return
      }

      // Get username from Firebase (auto-assign if new)
      const { username } = await getOrCreateUsername(walletAddress)

      const profile: PlayerProfile = {
        walletAddress,
        username,
        xp: Number(xp),
        level: Number(level),
        kills: Number(kills),
        isRegistered: exists,
      }

      setPlayerProfile(profile)
    } catch (err) {
      console.error('[v0] Failed to fetch player profile:', err)
      setPlayerProfile(null)
    } finally {
      setIsLoading(false)
    }
  }, [walletAddress, publicClient])

  // Fetch when wallet connects
  useEffect(() => {
    if (walletAddress) {
      fetchPlayerProfile()
    }
  }, [walletAddress, fetchPlayerProfile])

  // Register new player on-chain (no parameters needed)
  const registerPlayer = useCallback(async () => {
    if (!walletClient || !publicClient) throw new Error('Wallet not connected')

    setIsLoading(true)
    setError(null)

    try {
      const hash = await walletClient.writeContract({
        address: NULLSTATE_CONTRACT_ADDRESS as `0x${string}`,
        abi: NULLSTATE_CONTRACT_ABI,
        functionName: 'register',
        args: [],
        account: walletClient.account,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'success') {
        // Auto-assign username in Firebase
        if (walletAddress) {
          const { username } = await getOrCreateUsername(walletAddress)
          console.log('[v0] Player registered with auto-assigned username:', username)
        }
        await fetchPlayerProfile()
        return { success: true, hash }
      } else {
        throw new Error('Registration failed')
      }
    } catch (err) {
      const message = (err as any)?.message || 'Failed to register player'
      setError(message)
      console.error('[v0] Register error:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [walletClient, publicClient, walletAddress, fetchPlayerProfile])

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
          prev ? { ...prev, username: savedUsername } : null
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

  // Update player progress on-chain
  const updatePlayerProgressFn = useCallback(
    async (xp: number, level: number, kills: number) => {
      if (!walletClient || !publicClient) throw new Error('Wallet not connected')

      try {
        // Call executeAction with game stats
        const hash = await walletClient.writeContract({
          address: NULLSTATE_CONTRACT_ADDRESS as `0x${string}`,
          abi: NULLSTATE_CONTRACT_ABI,
          functionName: 'executeAction',
          args: [
            1, // actionType: ACTION_ATTACK
            0, // damageDealt: 0 (handled by game engine)
            0, // damageReceived: 0 (handled by game engine)
            BigInt(xp), // xpGained
            kills > 0, // enemyKilled
          ],
          account: walletClient.account,
          value: BigInt(10000000000000000), // 0.01 CELO in wei
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        if (receipt.status === 'success') {
          await fetchPlayerProfile()
        } else {
          throw new Error('Progress update failed')
        }
      } catch (err) {
        console.error('[v0] Update progress error:', err)
        throw err
      }
    },
    [walletClient, publicClient, fetchPlayerProfile]
  )

  updateProgressRef.current = updatePlayerProgressFn

  // Fetch leaderboard
  // Note: Contract doesn't have getAllPlayers, so we return empty for now
  // In production: use The Graph, Dune Analytics, or event indexing
  const fetchLeaderboard = useCallback(async (): Promise<LeaderboardEntry[]> => {
    console.warn(
      '[v0] Leaderboard requires event indexing. Contract has no getAllPlayers() view function.'
    )
    return []
  }, [])

  return {
    playerProfile,
    isLoading,
    error,
    fetchPlayerProfile,
    registerPlayer,
    setPlayerUsername,
    updatePlayerProgress: updateProgressRef.current || (async () => {}),
    fetchLeaderboard,
  }
}
