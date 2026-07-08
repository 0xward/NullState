'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { celo } from 'wagmi/chains'
import { PASS_SBT_ADDRESS, PASS_SBT_ABI } from '@/lib/contract-abi'

export interface SeasonInfo {
  supply: bigint
  minted: bigint
  startDate: bigint
  endDate: bigint
}

export function usePassSBT(walletAddress: string | undefined) {
  const publicClient = usePublicClient({ chainId: celo.id })
  const { data: walletClient } = useWalletClient()

  const [hasPass, setHasPass] = useState<boolean>(false)
  const [passSeasonId, setPassSeasonId] = useState<bigint>(BigInt(0))
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPassStatus = useCallback(async () => {
    if (!walletAddress || !publicClient || !PASS_SBT_ADDRESS || PASS_SBT_ADDRESS === '0x') return

    setIsLoading(true)
    setError(null)

    try {
      const [pass, season] = await Promise.all([
        publicClient.readContract({
          address: PASS_SBT_ADDRESS,
          abi: PASS_SBT_ABI,
          functionName: 'hasPass',
          args: [walletAddress as `0x${string}`],
        }),
        publicClient.readContract({
          address: PASS_SBT_ADDRESS,
          abi: PASS_SBT_ABI,
          functionName: 'getUserPassSeason',
          args: [walletAddress as `0x${string}`],
        }),
      ])

      setHasPass(pass as boolean)
      setPassSeasonId(season as bigint)
    } catch (err) {
      console.error('[usePassSBT] fetchPassStatus error:', err)
      setError((err as Error)?.message ?? 'Failed to fetch pass status')
    } finally {
      setIsLoading(false)
    }
  }, [walletAddress, publicClient])

  const checkWhitelist = useCallback(
    async (seasonId: bigint): Promise<boolean> => {
      if (!walletAddress || !publicClient || !PASS_SBT_ADDRESS || PASS_SBT_ADDRESS === '0x')
        return false

      try {
        const result = await publicClient.readContract({
          address: PASS_SBT_ADDRESS,
          abi: PASS_SBT_ABI,
          functionName: 'isWhitelisted',
          args: [walletAddress as `0x${string}`, seasonId],
        })
        setIsWhitelisted(result as boolean)
        return result as boolean
      } catch (err) {
        console.error('[usePassSBT] checkWhitelist error:', err)
        return false
      }
    },
    [walletAddress, publicClient],
  )

  const getSeasonInfo = useCallback(
    async (seasonId: bigint): Promise<SeasonInfo | null> => {
      if (!publicClient || !PASS_SBT_ADDRESS || PASS_SBT_ADDRESS === '0x') return null

      try {
        const result = await publicClient.readContract({
          address: PASS_SBT_ADDRESS,
          abi: PASS_SBT_ABI,
          functionName: 'getSeasonInfo',
          args: [seasonId],
        })
        const [supply, minted, startDate, endDate] = result as [bigint, bigint, bigint, bigint]
        return { supply, minted, startDate, endDate }
      } catch (err) {
        console.error('[usePassSBT] getSeasonInfo error:', err)
        return null
      }
    },
    [publicClient],
  )

  const mintFreePass = useCallback(
    async (seasonId: bigint): Promise<{ success: boolean; hash: `0x${string}` }> => {
      if (!walletClient || !publicClient) throw new Error('Wallet not connected')

      setIsLoading(true)
      setError(null)

      try {
        const hash = await walletClient.writeContract({
          address: PASS_SBT_ADDRESS,
          abi: PASS_SBT_ABI,
          functionName: 'mintFreePass',
          args: [seasonId],
          account: walletClient.account,
        })

        await publicClient.waitForTransactionReceipt({ hash })
        await fetchPassStatus()
        return { success: true, hash }
      } catch (err) {
        const message = (err as Error)?.message ?? 'Failed to mint free pass'
        setError(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [walletClient, publicClient, fetchPassStatus],
  )

  const mintPaidPass = useCallback(
    async (seasonId: bigint): Promise<{ success: boolean; hash: `0x${string}` }> => {
      if (!walletClient || !publicClient) throw new Error('Wallet not connected')

      setIsLoading(true)
      setError(null)

      try {
        const hash = await walletClient.writeContract({
          address: PASS_SBT_ADDRESS,
          abi: PASS_SBT_ABI,
          functionName: 'mintPaidPass',
          args: [seasonId],
          account: walletClient.account,
        })

        await publicClient.waitForTransactionReceipt({ hash })
        await fetchPassStatus()
        return { success: true, hash }
      } catch (err) {
        const message = (err as Error)?.message ?? 'Failed to mint paid pass'
        setError(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [walletClient, publicClient, fetchPassStatus],
  )

  useEffect(() => {
    if (walletAddress) fetchPassStatus()
  }, [walletAddress, fetchPassStatus])

  return {
    hasPass,
    passSeasonId,
    isWhitelisted,
    isLoading,
    error,
    fetchPassStatus,
    checkWhitelist,
    getSeasonInfo,
    mintFreePass,
    mintPaidPass,
  }
}
