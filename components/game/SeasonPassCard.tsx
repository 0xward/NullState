'use client'

import Image from 'next/image'
import { SeasonInfo } from '@/hooks/usePassSBT'

export interface SeasonPassCardProps {
  seasonNumber: number // 1-6
  seasonId: bigint // e.g. 202607n
  imageSrc: string // /Season_1.png etc.
  isActive: boolean // true only for the season matching the current month
  info: SeasonInfo | null // null while still loading
  hasPass: boolean // does the connected wallet already hold ANY active pass
  isConnected: boolean
  mintPhase: 'idle' | 'paying' | 'verifying' | 'minting'
  onMint: () => void
}

const MINT_LABEL: Record<SeasonPassCardProps['mintPhase'], string> = {
  idle: 'MINT PASS — 0.3 USDT',
  paying: 'SENDING PAYMENT…',
  verifying: 'VERIFYING PAYMENT…',
  minting: 'MINTING…',
}

function daysRemaining(endDateSeconds: bigint): number | null {
  if (endDateSeconds === BigInt(0)) return null
  const endMs = Number(endDateSeconds) * 1000
  const diffMs = endMs - Date.now()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export default function SeasonPassCard({
  seasonNumber,
  seasonId,
  imageSrc,
  isActive,
  info,
  hasPass,
  isConnected,
  mintPhase,
  onMint,
}: SeasonPassCardProps) {
  const cardStyle: React.CSSProperties = {
    clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
  }

  // ── Locked / not-yet-active card ──────────────────────────────────────────
  if (!isActive) {
    const notAnnounced = !info || info.startDate === BigInt(0)

    return (
      <div
        className="shrink-0 w-[78%] sm:w-[300px] snap-center border border-[rgba(0,255,136,0.15)] bg-[rgba(0,0,0,0.4)] rounded-md overflow-hidden"
        style={cardStyle}
      >
        <div className="relative aspect-square w-full">
          <Image
            src={imageSrc}
            alt={`Season ${seasonNumber}`}
            fill
            sizes="(max-width: 640px) 78vw, 300px"
            className="object-cover"
            style={{ filter: 'blur(6px) brightness(0.4)' }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-4xl">🔒</span>
          </div>
        </div>
        <div className="p-3 font-mono">
          <div className="text-null-muted text-[10px] uppercase tracking-[2px] mb-1">
            Season {seasonNumber}
          </div>
          <div className="text-null-white/70 text-xs mb-3">
            {notAnnounced ? 'Not announced yet' : 'Not started yet'}
          </div>
          <button
            disabled
            className="w-full font-mono text-[10px] tracking-[1px] uppercase text-null-muted border border-[rgba(42,74,53,0.6)] py-2 cursor-not-allowed"
            style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}
          >
            Coming — Season {seasonNumber}
          </button>
        </div>
      </div>
    )
  }

  // ── Active card ──────────────────────────────────────────────────────────
  const minted = info?.minted ?? BigInt(0)
  const supply = info?.supply ?? BigInt(0)
  const days = info ? daysRemaining(info.endDate) : null

  // NOTE: `endDate` is purely informational here. PassSBTv2.sol's backendMintPass()
  // / mintFreePass() never check seasonEndDate — only seasonStartDate != 0,
  // seasonMinted < seasonSupply, and userPassSeason == 0. So an elapsed
  // countdown must NOT disable the mint button; it only changes the status
  // text shown to the player.
  let statusLine: string
  if (!info) {
    statusLine = '// fetching season data…'
  } else if (days === null) {
    statusLine = 'Not announced yet'
  } else if (days < 0) {
    statusLine = 'Season ended'
  } else if (days === 0) {
    statusLine = 'Ends today'
  } else {
    statusLine = `${days} day${days === 1 ? '' : 's'} left`
  }

  const soldOut = info ? minted >= supply && supply > BigInt(0) : false

  let buttonLabel = MINT_LABEL[mintPhase]
  let buttonDisabled = mintPhase !== 'idle' || !isConnected

  if (mintPhase === 'idle') {
    if (hasPass) {
      buttonLabel = '✓ PASS ACTIVE'
      buttonDisabled = true
    } else if (soldOut) {
      buttonLabel = 'SOLD OUT'
      buttonDisabled = true
    } else if (!isConnected) {
      // MiniPay auto-connects silently on load; this state should only be
      // momentary. Deliberately avoid the phrase "Connect Wallet" here —
      // MiniPay's submission checklist explicitly requires apps to never
      // show connect-wallet language, even as a disabled status label.
      buttonLabel = 'WALLET SYNCING…'
      buttonDisabled = true
    }
  }

  return (
    <div
      className="shrink-0 w-[86%] sm:w-[320px] snap-center border border-[rgba(0,255,136,0.4)] bg-[rgba(0,255,136,0.03)] rounded-md overflow-hidden"
      style={cardStyle}
    >
      <div className="relative aspect-square w-full">
        <Image
          src={imageSrc}
          alt={`Season ${seasonNumber}`}
          fill
          sizes="(max-width: 640px) 86vw, 320px"
          className="object-cover"
        />
        <div className="absolute top-2 left-2 font-mono text-[10px] tracking-[2px] uppercase bg-black/70 text-null-green px-2 py-1 border border-[rgba(0,255,136,0.4)]">
          ● ACTIVE
        </div>
      </div>

      <div className="p-3.5 font-mono">
        <div className="text-null-acid text-sm font-bold uppercase tracking-[1px] mb-2">
          Season {seasonNumber}
        </div>

        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-null-muted uppercase tracking-[1px]">Minted</span>
          <span className="text-null-white">
            {info ? `${minted.toString()}/${supply.toString()}` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] mb-3">
          <span className="text-null-muted uppercase tracking-[1px]">Status</span>
          <span className="text-null-amber">{statusLine}</span>
        </div>

        <button
          onClick={onMint}
          disabled={buttonDisabled}
          className={
            'w-full font-mono text-[10px] tracking-[1px] uppercase py-2.5 transition-all duration-200 ' +
            (buttonDisabled
              ? 'text-null-muted border border-[rgba(42,74,53,0.6)] cursor-not-allowed'
              : 'text-null-green border border-[rgba(0,255,136,0.5)] hover:border-null-green hover:bg-[rgba(0,255,136,0.08)]')
          }
          style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}
