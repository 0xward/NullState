// Hook to interact with NullState smart contract for player persistence
// 
// ON-CHAIN (Celo): XP, level, kills via getPlayer()
// OFF-CHAIN (Firebase): Username via usernameService

'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { CELO_CHAIN_ID } from '@/lib/WalletProvider'
import { DEFAULT_FEE_CURRENCY } from '@/lib/constants/tokens'
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
import { updateLeaderboardEntry, recordRunKills, getLeaderboard } from '@/lib/leaderboardService'

export function useContractPlayer(walletAddress: string | undefined) {
  const publicClient = usePublicClient({ chainId: CELO_CHAIN_ID })
  const { data: walletClient } = useWalletClient()

  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      // Sync username/xp/level to Firestore so the leaderboard has fresh
      // data without ever needing to scan chain logs. Deliberately does NOT
      // pass on-chain `kills` — see recordRunKills() for why that figure is
      // maintained separately (the contract only ever adds +1 per death,
      // regardless of how many enemies were actually killed that run).
      updateLeaderboardEntry(walletAddress, username, profile.xp, profile.level)
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
        // MiniPay Custom Fee Abstraction: let users pay gas in USDm even
        // though this call needs no native value — many hold no CELO at all.
        feeCurrency: DEFAULT_FEE_CURRENCY,
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

  // NOTE: this hook used to also expose `updatePlayerProgress`, a wrapper
  // around NullState.sol's `executeAction()` (0.01 CELO per call). That path
  // was removed 2026-07-12 — no component called it (combat now goes through
  // `payUsdmFee()` in WalletProvider.tsx instead), and DungeonGame/
  // DungeonGameWrapper already call `recordRunKills()` from
  // `lib/leaderboardService.ts` directly on death, so removing this did not
  // touch the leaderboard-kills sync path at all.

  // Leaderboard is read straight from Firestore (see leaderboardService.ts).
  // Entries are kept fresh by updateLeaderboardEntry(), called from
  // fetchPlayerProfile() every time a player's on-chain stats are read.
  // We intentionally do NOT scan PlayerRegistered event logs on-chain here:
  // that requires walking the full log history from the contract's
  // deployment block via eth_getLogs, which the public Forno RPC
  // (https://forno.celo.org) rate-limits/rejects for full-history scans,
  // and silently produced an empty leaderboard.
  const fetchLeaderboard = useCallback(async (): Promise<LeaderboardEntry[]> => {
    return getLeaderboard(100)
  }, [])

  return {
    playerProfile,
    isLoading,
    error,
    fetchPlayerProfile,
    registerPlayer,
    setPlayerUsername,
    fetchLeaderboard,
  }
}
