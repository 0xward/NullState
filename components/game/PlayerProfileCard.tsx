'use client'

import { useEffect, useState } from 'react'
import { usePassSBT } from '@/hooks/usePassSBT'

type ProfileResponse = {
  profile: {
    walletAddress: string
    nickname?: string
    joinedAt?: number | null
    currentSeasonId?: number
    inventory?: {
      health?: number
      mana?: number
      items?: Record<string, number>
    }
    stats?: {
      totalBurns?: number
      totalRewards?: number
      vaultAttempts?: number
    }
  }
  summary?: {
    totalBurnEvents: number
    weeklyRewardEntries: number
    seasonBonusEntries: number
  }
}

interface PlayerProfileCardProps {
  walletAddress?: string
}

export default function PlayerProfileCard({ walletAddress }: PlayerProfileCardProps) {
  const { hasPass, passSeasonId, isLoading: passLoading } = usePassSBT(walletAddress)
  const [data, setData] = useState<ProfileResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!walletAddress) {
      setData(null)
      return
    }

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/player/profile?walletAddress=${walletAddress}`)
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error ?? 'Failed to load player profile')
        setData(payload)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load profile')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [walletAddress])

  return (
    <section className="rounded-xl border border-[rgba(255,255,255,0.15)] bg-black/40 p-5">
      <h2 className="font-mono text-sm uppercase tracking-[2px] text-null-white">Player Profile</h2>

      {!walletAddress && <p className="mt-3 text-sm text-null-muted">Connect wallet to load profile.</p>}
      {(isLoading || passLoading) && <p className="mt-3 text-sm text-null-muted">Loading profile...</p>}
      {error && <p className="mt-3 text-sm text-null-red">{error}</p>}

      {data && (
        <div className="mt-4 space-y-2 text-sm text-null-muted">
          <p>
            <span className="text-null-white">Name:</span> {data.profile.nickname ?? 'Unnamed'}
          </p>
          <p>
            <span className="text-null-white">Wallet:</span> {data.profile.walletAddress}
          </p>
          <p>
            <span className="text-null-white">Season:</span> {data.profile.currentSeasonId ?? '-'}
          </p>
          <p>
            <span className="text-null-white">Pass:</span> {hasPass ? `Active (Season ${passSeasonId.toString()})` : 'Inactive'}
          </p>
          <p>
            <span className="text-null-white">Inventory:</span>{' '}
            HP {data.profile.inventory?.health ?? 0} · Mana {data.profile.inventory?.mana ?? 0}
          </p>
          <p>
            <span className="text-null-white">Items:</span> {Object.keys(data.profile.inventory?.items ?? {}).length}
          </p>
          <p>
            <span className="text-null-white">Burn events:</span> {data.summary?.totalBurnEvents ?? 0}
          </p>
        </div>
      )}
    </section>
  )
}
