'use client';

import Image from 'next/image';
import { GiMedal } from 'react-icons/gi';
import { formatUSDm, parseUSDmReadable } from '@/lib/constants/tokens';
import { useState } from 'react';

interface USDmDisplayProps {
  amount: bigint | number;
  decimals?: number;
  showIcon?: boolean;
  iconSize?: number;
  className?: string;
  variant?: 'default' | 'compact' | 'large';
}

/**
 * Display USDm amount with official Mento/Celo logo
 * Fetches logo from official AWS S3 source with local fallback
 */
export function USDmDisplay({
  amount,
  decimals = 2,
  showIcon = true,
  iconSize = 20,
  className = '',
  variant = 'default',
}: USDmDisplayProps) {
  const [logoError, setLogoError] = useState(false);
  const displayAmount = parseUSDmReadable(amount).toFixed(decimals);

  const sizeClasses = {
    default: 'text-base',
    compact: 'text-sm',
    large: 'text-lg font-semibold',
  };

  return (
    <div className={`flex items-center gap-2 ${sizeClasses[variant]} ${className}`}>
      {showIcon && (
        <div className="relative flex-shrink-0">
          {!logoError ? (
            <Image
              src="https://token-logos-static.s3.amazonaws.com/USDm.png"
              alt="USDm Logo"
              width={iconSize}
              height={iconSize}
              onError={() => setLogoError(true)}
              className="rounded-full"
              priority
            />
          ) : (
            // Fallback: Yellow circle with U
            <div
              className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center"
              style={{ width: iconSize, height: iconSize }}
            >
              <span className="text-white text-xs font-bold">U</span>
            </div>
          )}
        </div>
      )}
      <span className="font-mono font-semibold">{displayAmount}</span>
      <span className="text-gray-600 dark:text-gray-400 font-medium">USDm</span>
    </div>
  );
}

/**
 * Display USDm in badge format
 */
export function USDmBadge({
  amount,
  className = '',
}: {
  amount: bigint | number;
  className?: string;
}) {
  const [logoError, setLogoError] = useState(false);
  const displayAmount = parseUSDmReadable(amount).toFixed(2);

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
        bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20
        border border-yellow-200 dark:border-yellow-800
        ${className}
      `}
    >
      {!logoError ? (
        <Image
          src="https://token-logos-static.s3.amazonaws.com/USDm.png"
          alt="USDm"
          width={16}
          height={16}
          onError={() => setLogoError(true)}
          className="rounded-full"
          priority
        />
      ) : (
        <div className="w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">U</span>
        </div>
      )}
      <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">
        {displayAmount} USDm
      </span>
    </div>
  );
}

/**
 * Reward card component for leaderboard rankings
 */
export function RewardCard({
  label,
  amount,
  rank,
  isClaimed = false,
}: {
  label: string;
  amount: bigint | number;
  rank?: number;
  isClaimed?: boolean;
}) {
  const [logoError, setLogoError] = useState(false);

  const rankMedalColor: { [key: number]: string } = {
    1: '#ffd166',
    2: '#c8d0d8',
    3: '#cd7f32',
  };

  const displayAmount = parseUSDmReadable(amount).toFixed(2);

  return (
    <div
      className={`
        p-4 rounded-lg border-2 transition-all
        ${
          isClaimed
            ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {rank && rankMedalColor[rank] && <GiMedal aria-hidden className="inline-block align-[-0.15em]" style={{ color: rankMedalColor[rank] }} />} {label}
        </span>
        {isClaimed && (
          <span className="text-xs font-semibold text-green-600 dark:text-green-400">✓ Claimed</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!logoError ? (
          <Image
            src="https://token-logos-static.s3.amazonaws.com/USDm.png"
            alt="USDm"
            width={24}
            height={24}
            onError={() => setLogoError(true)}
            className="rounded-full"
            priority
          />
        ) : (
          <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">U</span>
          </div>
        )}
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{displayAmount}</span>
        <span className="text-gray-500 dark:text-gray-400 font-medium">USDm</span>
      </div>
    </div>
  );
}

/**
 * Token info component with official verification badge
 */
export function USDmTokenInfo() {
  const [logoError, setLogoError] = useState(false);

  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
      {!logoError ? (
        <Image
          src="https://token-logos-static.s3.amazonaws.com/USDm.png"
          alt="USDm"
          width={32}
          height={32}
          onError={() => setLogoError(true)}
          className="rounded-full mt-1 flex-shrink-0"
          priority
        />
      ) : (
        <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-white text-xs font-bold">U</span>
        </div>
      )}
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          USDm (Mento Dollar)
          <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-1 rounded">
            Verified
          </span>
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Official stablecoin on Celo network (formerly cUSD)
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 font-mono break-all">
          0x765DE816845861e75A25fCA122bb6898B8B1282a
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          Contract: Celo Mainnet • Chain ID: 42220
        </p>
      </div>
    </div>
  );
}

export default USDmDisplay;
