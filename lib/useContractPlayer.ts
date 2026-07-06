// Hook to interact with NullState smart contract for player persistence
// 
// ON-CHAIN (Celo): XP, level, kills via getPlayer()
// OFF-CHAIN (Firebase): Username via usernameService

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

// viem helpers (publicClient is a viem client)
import { getEventSelector } from 'viem'

// tiny concurrency limiter
const pLimit = (concurrency: number) => {
  const queue: (() => Promise<any>)[] = []
  let active = 0
  const next = () => {
    if (active >= concurrency || queue.length === 0) return
    active++
    const fn = queue.shift()!
    fn().finally(() => {
      active--
      next()
    })
  }
  return <T>(fn: () => Promise<T>) => new Promise<T>((resolve, reject) => {
    queue.push(() => fn().then(resolve).catch(reject))
    next()
  })
}

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

  // Helper: attempt to fetch logs in chunks via RPC
  const fetchLogsInChunks = async (fromBlock: bigint, toBlock: bigint, chunkSize: bigint, eventSelector: string) => {
    const logs: any[] = []
    let cur = fromBlock
    while (cur <= toBlock) {
      const end = cur + chunkSize - 1n > toBlock ? toBlock : cur + chunkSize - 1n
      try {
        // eslint-disable-next-line no-await-in-loop
        const chunk = await publicClient.getLogs({
          address: NULLSTATE_CONTRACT_ADDRESS as `0x${string}`,
          topics: [eventSelector],
          fromBlock: cur,
          toBlock: end,
        })
        logs.push(...(chunk as any[]))
      } catch (e) {
        console.warn('[v0] getLogs chunk failed', { from: cur.toString(), to: end.toString(), err: e })
        // rethrow to allow fallback to explorer API
        throw e
      }
      cur = end + 1n

    }
    return logs
  }

  // Fallback: query Celoscan logs API
  const fetchLogsFromCeloScan = async (eventSelector: string, fromBlock: bigint, toBlock: string | bigint) => {
    const apiKey = process.env.NEXT_PUBLIC_CELOSCAN_API_KEY || ''
    if (!apiKey) {
      console.warn('[v0] Celoscan API key not configured, cannot use fallback')
      return []
    }

    const fromB = fromBlock.toString()
    const toB = typeof toBlock === 'bigint' ? toBlock.toString() : toBlock

    const url = `https://api.celoscan.io/api?module=logs&action=getLogs&address=${NULLSTATE_CONTRACT_ADDRESS}&topic0=${eventSelector}&fromBlock=${fromB}&toBlock=${toB}&apikey=${apiKey}`

    try {
      const res = await fetch(url)
      if (!res.ok) {
        console.warn('[v0] Celoscan fallback failed with status', res.status)
        return []
      }
      const data = await res.json()
      if (!data || !data.result) return []
      // Normalize to viem-like log objects
      return (data.result as any[]).map((r) => ({ topics: r.topics, data: r.data }))
    } catch (e) {
      console.warn('[v0] Celoscan fetch error', e)
      return []
    }
  }

  // Fetch leaderboard by indexing PlayerRegistered events via RPC logs
  const fetchLeaderboard = useCallback(async (): Promise<LeaderboardEntry[]> => {
    if (!publicClient) return []

    try {
      // Configurable start block and chunk size via env vars
      const envStart = process.env.NEXT_PUBLIC_LEADERBOARD_FROM_BLOCK
      const startBlock = envStart ? BigInt(envStart) : 0n
      const chunkSizeEnv = process.env.NEXT_PUBLIC_LEADERBOARD_CHUNK_SIZE || '50000'
      const chunkSize = BigInt(chunkSizeEnv)

      const eventSelector = getEventSelector('PlayerRegistered(address,uint64)')

      // Determine latest block
      const latest = await publicClient.getBlockNumber()

      let logs: any[] = []

      try {
        logs = await fetchLogsInChunks(startBlock, latest as bigint, chunkSize, eventSelector)
      } catch (rpcErr) {
        console.warn('[v0] RPC getLogs failed, attempting Celoscan fallback', rpcErr)
        logs = await fetchLogsFromCeloScan(eventSelector, startBlock, latest as bigint)
      }

      if (!logs || logs.length === 0) {
        console.warn('[v0] No PlayerRegistered logs found')
        return []
      }

      // Extract unique addresses from the indexed topic[1]
      const addrs = Array.from(
        new Set(
          logs
            .map((l: any) => {
              if (!l.topics || l.topics.length < 2) return null
              const topicAddr = l.topics[1]
              // topics[1] is 32-byte padded address. Grab last 40 hex chars
              return `0x${topicAddr.slice(-40)}`
            })
            .filter(Boolean)
        )
      )

      // For each address, read on-chain profile and username from Firebase
      const concurrency = 8
      const limit = pLimit(concurrency)
      const results = await Promise.all(
        addrs.map((addr) => limit(async () => {
          try {
            const res = await publicClient.readContract({
              address: NULLSTATE_CONTRACT_ADDRESS as `0x${string}`,
              abi: NULLSTATE_CONTRACT_ABI,
              functionName: 'getPlayer',
              args: [addr as `0x${string}`],
            })

            const [exists, hp, maxHp, xp, level, kills] = res as any
            if (!exists) return null

            const { username } = await getOrCreateUsername(addr).catch(() => ({ username: addr }))

            const entry: LeaderboardEntry = {
              rank: 0,
              walletAddress: addr,
              username,
              xp: Number(xp),
              level: Number(level),
              kills: Number(kills),
            }
            return entry
          } catch (e) {
            console.warn('[v0] fetchLeaderboard - failed to read player', addr, e)
            return null
          }
        }))
      )

      const entries = results.filter(Boolean) as LeaderboardEntry[]

      // Sort by xp desc and assign ranks
      entries.sort((a, b) => b.xp - a.xp)
      entries.forEach((e, i) => (e.rank = i + 1))

      return entries
    } catch (err) {
      console.error('[v0] Leaderboard fetch error:', err)
      return []
    }
  }, [publicClient])

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
