/**
 * Hook to interact with NullState smart contract for player persistence
 * Reads and writes player data on-chain
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { CELO_CHAIN_ID } from '@/lib/WalletProvider'
import { NULLSTATE_CONTRACT_ADDRESS, NULLSTATE_CONTRACT_ABI, PlayerProfile, LeaderboardEntry } from '@/lib/contract'

export function useContractPlayer(walletAddress: string | undefined) {
  const publicClient = usePublicClient({ chainId: CELO_CHAIN_ID })
  const { data: walletClient } = useWalletClient()

  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch player profile from contract
  const fetchPlayerProfile = useCallback(async () => {
    if (!walletAddress || !publicClient) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await publicClient.readContract({
        address: NULLSTATE_CONTRACT_ADDRESS as `0x${string}`,
        abi: NULLSTATE_CONTRACT_ABI,
        functionName: 'getPlayerProfile',
        args: [walletAddress as `0x${string}`],
      })

      const resultArray = Array.isArray(result) ? result : [result]
      const [username, xp, level, kills, characterClass, isRegistered] = resultArray as any[]

      setPlayerProfile({
        username,
        xp: Number(xp),
        level: Number(level),
        kills: Number(kills),
        characterClass: Number(characterClass),
        isRegistered: Boolean(isRegistered),
        walletAddress,
      })
    } catch (err) {
      console.error('[v0] Failed to fetch player profile:', err)
      // This is not necessarily an error - player might just not be registered yet
      setPlayerProfile({
        username: '',
        xp: 0,
        level: 0,
        kills: 0,
        characterClass: 0,
        isRegistered: false,
        walletAddress,
      })
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

  // Register new player
  const registerPlayer = useCallback(
    async (username: string, characterClass: number) => {
      if (!walletClient || !publicClient) throw new Error('Wallet not connected')

      setIsLoading(true)
      setError(null)

      try {
        // Send the transaction
        const hash = await walletClient.writeContract({
          address: NULLSTATE_CONTRACT_ADDRESS as `0x${string}`,
          abi: NULLSTATE_CONTRACT_ABI,
          functionName: 'registerPlayer',
          args: [username, characterClass],
          account: walletClient.account,
        })

        // Wait for receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        if (receipt.status === 'success') {
          // Refetch profile
          await fetchPlayerProfile()
          return { success: true, hash }
        } else {
          throw new Error('Transaction failed')
        }
      } catch (err) {
        const message = (err as any)?.message || 'Failed to register player'
        setError(message)
        console.error('[v0] Register player error:', err)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [walletClient, publicClient, fetchPlayerProfile]
  )

  // Update player progress (XP, level, kills)
  const updatePlayerProgress = useCallback(
    async (xp: number, level: number, kills: number) => {
      if (!walletClient || !publicClient) throw new Error('Wallet not connected')

      setIsLoading(true)
      setError(null)

      try {
        const hash = await walletClient.writeContract({
          address: NULLSTATE_CONTRACT_ADDRESS as `0x${string}`,
          abi: NULLSTATE_CONTRACT_ABI,
          functionName: 'updatePlayerProgress',
          args: [BigInt(xp), level, kills],
          account: walletClient.account,
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        if (receipt.status === 'success') {
          await fetchPlayerProfile()
          return { success: true, hash }
        } else {
          throw new Error('Transaction failed')
        }
      } catch (err) {
        const message = (err as any)?.message || 'Failed to update progress'
        setError(message)
        console.error('[v0] Update progress error:', err)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [walletClient, publicClient, fetchPlayerProfile]
  )

  // Fetch leaderboard from all players
  const fetchLeaderboard = useCallback(
    async (): Promise<LeaderboardEntry[]> => {
      if (!publicClient) return []

      try {
        // Get all players
        const allPlayersAddresses = await publicClient.readContract({
          address: NULLSTATE_CONTRACT_ADDRESS as `0x${string}`,
          abi: NULLSTATE_CONTRACT_ABI,
          functionName: 'getAllPlayers',
          args: [],
        })

        const playerAddresses = (allPlayersAddresses as any[])[0] || []

        // Fetch each player's profile and sort by XP
        const profiles: LeaderboardEntry[] = await Promise.all(
          playerAddresses.map(async (address: string, index: number) => {
            try {
              const profile = await publicClient.readContract({
                address: NULLSTATE_CONTRACT_ADDRESS as `0x${string}`,
                abi: NULLSTATE_CONTRACT_ABI,
                functionName: 'getPlayerProfile',
                args: [address as `0x${string}`],
              })

              const [username, xp, level, kills, characterClass, isRegistered] = profile as any

              return {
                rank: 0, // Will be calculated after sort
                walletAddress: address,
                username: isRegistered ? username : 'Unknown',
                xp: Number(xp),
                level: Number(level),
                kills: Number(kills),
              }
            } catch (err) {
              console.error(`[v0] Failed to fetch profile for ${address}:`, err)
              return {
                rank: 0,
                walletAddress: address,
                username: 'Unknown',
                xp: 0,
                level: 0,
                kills: 0,
              }
            }
          })
        )

        // Sort by XP descending and assign ranks
        return profiles
          .sort((a, b) => b.xp - a.xp)
          .map((profile, index) => ({
            ...profile,
            rank: index + 1,
          }))
      } catch (err) {
        console.error('[v0] Failed to fetch leaderboard:', err)
        return []
      }
    },
    [publicClient]
  )

  return {
    playerProfile,
    isLoading,
    error,
    fetchPlayerProfile,
    registerPlayer,
    updatePlayerProgress,
    fetchLeaderboard,
  }
}
