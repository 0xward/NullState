'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { celo } from 'wagmi/chains'
import { REWARD_CONTRACT_ADDRESS, REWARD_ABI } from '@/lib/contract-abi'
import { getISOWeekId, getCurrentSeasonId } from '@/lib/web3-client'
import { pickBestFeeCurrency } from '@/lib/constants/tokens'

export interface SeasonLeaderboard {
  seasonId: bigint
  topPlayers: [`0x${string}`, `0x${string}`, `0x${string}`]
  topScores: [bigint, bigint, bigint]
  rewardToken: `0x${string}`
  totalDeposited: bigint
  deposited: boolean
  finalized: boolean
  updatedAt: bigint
}

export interface WeeklyPool {
  week: bigint
  rewardToken: `0x${string}`
  depositedAmount: bigint
  claimedAmount: bigint
  createdAt: bigint
}

export function useReward(walletAddress: string | undefined) {
  const publicClient = usePublicClient({ chainId: celo.id })
  const { data: walletClient } = useWalletClient()

  const [weeklyBurnAmount, setWeeklyBurnAmount] = useState<bigint>(BigInt(0))
  const [weeklyClaimedAmount, setWeeklyClaimedAmount] = useState<bigint>(BigInt(0))
  const [seasonLeaderboard, setSeasonLeaderboard] = useState<SeasonLeaderboard | null>(null)
  const [hasClaimedSeasonBonus, setHasClaimedSeasonBonus] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentWeek = BigInt(getISOWeekId())
  const currentSeason = BigInt(getCurrentSeasonId())

  const fetchWeeklyStats = useCallback(async () => {
    if (
      !walletAddress ||
      !publicClient ||
      !REWARD_CONTRACT_ADDRESS ||
      REWARD_CONTRACT_ADDRESS === '0x'
    )
      return

    setIsLoading(true)
    setError(null)

    try {
      const [burned, claimed] = await Promise.all([
        publicClient.readContract({
          address: REWARD_CONTRACT_ADDRESS,
          abi: REWARD_ABI,
          functionName: 'getUserWeeklyBurn',
          args: [walletAddress as `0x${string}`, currentWeek],
        }),
        publicClient.readContract({
          address: REWARD_CONTRACT_ADDRESS,
          abi: REWARD_ABI,
          functionName: 'getUserWeeklyClaimed',
          args: [walletAddress as `0x${string}`, currentWeek],
        }),
      ])

      setWeeklyBurnAmount(burned as bigint)
      setWeeklyClaimedAmount(claimed as bigint)
    } catch (err) {
      console.error('[useReward] fetchWeeklyStats error:', err)
      setError((err as Error)?.message ?? 'Failed to fetch weekly stats')
    } finally {
      setIsLoading(false)
    }
  }, [walletAddress, publicClient, currentWeek])

  const fetchSeasonLeaderboard = useCallback(
    async (seasonId?: bigint): Promise<SeasonLeaderboard | null> => {
      if (!publicClient || !REWARD_CONTRACT_ADDRESS || REWARD_CONTRACT_ADDRESS === '0x')
        return null

      const id = seasonId ?? currentSeason
      try {
        const result = await publicClient.readContract({
          address: REWARD_CONTRACT_ADDRESS,
          abi: REWARD_ABI,
          functionName: 'getSeasonLeaderboard',
          args: [id],
        })
        const lb = result as SeasonLeaderboard
        setSeasonLeaderboard(lb)
        return lb
      } catch (err) {
        console.error('[useReward] fetchSeasonLeaderboard error:', err)
        return null
      }
    },
    [publicClient, currentSeason],
  )

  const checkSeasonBonusClaimed = useCallback(
    async (seasonId?: bigint): Promise<boolean> => {
      if (
        !walletAddress ||
        !publicClient ||
        !REWARD_CONTRACT_ADDRESS ||
        REWARD_CONTRACT_ADDRESS === '0x'
      )
        return false

      const id = seasonId ?? currentSeason
      try {
        const result = await publicClient.readContract({
          address: REWARD_CONTRACT_ADDRESS,
          abi: REWARD_ABI,
          functionName: 'hasClaimedSeasonBonus',
          args: [walletAddress as `0x${string}`, id],
        })
        setHasClaimedSeasonBonus(result as boolean)
        return result as boolean
      } catch (err) {
        console.error('[useReward] checkSeasonBonusClaimed error:', err)
        return false
      }
    },
    [walletAddress, publicClient, currentSeason],
  )

  const claimWeeklyRewards = useCallback(
    async (week?: bigint): Promise<{ success: boolean; hash: `0x${string}` }> => {
      if (!walletClient || !publicClient) throw new Error('Wallet not connected')

      setIsLoading(true)
      setError(null)

      try {
        const weekId = week ?? currentWeek
        // Pay gas in whichever stablecoin (USDm/USDC/USDT) the user holds
        // the most of — falls back to USDm if the balance check fails.
        const feeCurrency = await pickBestFeeCurrency(publicClient, walletClient.account?.address)
        const hash = await walletClient.writeContract({
          address: REWARD_CONTRACT_ADDRESS,
          abi: REWARD_ABI,
          functionName: 'claimWeeklyRewards',
          args: [weekId],
          account: walletClient.account,
          feeCurrency,
        })

        await publicClient.waitForTransactionReceipt({ hash })
        await fetchWeeklyStats()
        return { success: true, hash }
      } catch (err) {
        const message = (err as Error)?.message ?? 'Failed to claim weekly rewards'
        setError(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [walletClient, publicClient, currentWeek, fetchWeeklyStats],
  )

  const claimSeasonBonus = useCallback(
    async (seasonId?: bigint): Promise<{ success: boolean; hash: `0x${string}` }> => {
      if (!walletClient || !publicClient) throw new Error('Wallet not connected')

      setIsLoading(true)
      setError(null)

      try {
        const id = seasonId ?? currentSeason
        const feeCurrency = await pickBestFeeCurrency(publicClient, walletClient.account?.address)
        const hash = await walletClient.writeContract({
          address: REWARD_CONTRACT_ADDRESS,
          abi: REWARD_ABI,
          functionName: 'claimSeasonBonus',
          args: [id],
          account: walletClient.account,
          feeCurrency,
        })

        await publicClient.waitForTransactionReceipt({ hash })
        await checkSeasonBonusClaimed(id)
        return { success: true, hash }
      } catch (err) {
        const message = (err as Error)?.message ?? 'Failed to claim season bonus'
        setError(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [walletClient, publicClient, currentSeason, checkSeasonBonusClaimed],
  )

  useEffect(() => {
    if (walletAddress) {
      fetchWeeklyStats()
      fetchSeasonLeaderboard()
      checkSeasonBonusClaimed()
    }
  }, [walletAddress, fetchWeeklyStats, fetchSeasonLeaderboard, checkSeasonBonusClaimed])

  // Claimable amount = burned this week minus already claimed, capped by maxPerUser
  const weeklyClaimable = weeklyBurnAmount > weeklyClaimedAmount
    ? weeklyBurnAmount - weeklyClaimedAmount
    : BigInt(0)

  return {
    weeklyBurnAmount,
    weeklyClaimedAmount,
    weeklyClaimable,
    seasonLeaderboard,
    hasClaimedSeasonBonus,
    currentWeek,
    currentSeason,
    isLoading,
    error,
    fetchWeeklyStats,
    fetchSeasonLeaderboard,
    checkSeasonBonusClaimed,
    claimWeeklyRewards,
    claimSeasonBonus,
  }
}
