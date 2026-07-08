import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { celo } from 'viem/chains'
import { REWARD_ABI, REWARD_CONTRACT_ADDRESS } from '@/lib/contract-abi'
import { getCurrentSeasonId } from '@/lib/web3-client'
import { getAdminDb } from '@/firebase-config'

type LeaderboardItem = {
  rank: number
  player: string
  score: number
  username?: string
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const seasonId = Number(searchParams.get('seasonId') ?? getCurrentSeasonId())

    const db = getAdminDb()
    const firebaseLeaderboard: LeaderboardItem[] = []

    if (db) {
      const snapshot = await db.ref(`leaderboards/${seasonId}`).get()
      if (snapshot.exists()) {
        const data = snapshot.val() ?? {}
        const maybeList = Object.values(data)
          .filter((entry: any) => entry && typeof entry === 'object' && entry.rank)
          .map((entry: any) => ({
            rank: Number(entry.rank),
            player: String(entry.player ?? entry.walletAddress ?? ''),
            score: Number(entry.score ?? 0),
            username: entry.username ? String(entry.username) : undefined,
          }))
        firebaseLeaderboard.push(...(maybeList as LeaderboardItem[]))
      }
    }

    let onchainTop: LeaderboardItem[] = []
    if (REWARD_CONTRACT_ADDRESS && REWARD_CONTRACT_ADDRESS !== '0x') {
      const publicClient = createPublicClient({
        chain: celo,
        transport: http(process.env.CELO_RPC_URL ?? process.env.NEXT_PUBLIC_CELO_RPC ?? 'https://forno.celo.org'),
      })
      const result = await publicClient.readContract({
        address: REWARD_CONTRACT_ADDRESS,
        abi: REWARD_ABI,
        functionName: 'getSeasonLeaderboard',
        args: [BigInt(seasonId)],
      })

      const parsed = result as {
        topPlayers: readonly [string, string, string]
        topScores: readonly [bigint, bigint, bigint]
      }

      onchainTop = parsed.topPlayers
        .map((player, idx) => ({
          rank: idx + 1,
          player,
          score: Number(parsed.topScores[idx] ?? BigInt(0)),
        }))
        .filter((row) => row.player && row.player !== '0x0000000000000000000000000000000000000000')
    }

    const leaderboard = (firebaseLeaderboard.length ? firebaseLeaderboard : onchainTop)
      .sort((a, b) => b.score - a.score)
      .map((item, idx) => ({ ...item, rank: idx + 1 }))

    return NextResponse.json({
      seasonId,
      leaderboard,
      topThree: leaderboard.slice(0, 3),
      source: firebaseLeaderboard.length ? 'firebase' : 'contract',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
