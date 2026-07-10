'use client'

import { BaseError, InsufficientFundsError, UserRejectedRequestError } from 'viem'

// MiniPay Add Cash deeplink confirmed from
// https://docs.minipay.xyz/technical-references/deeplinks.html on 2026-07-10.
export const MINIPAY_ADD_CASH_URL = 'https://link.minipay.xyz/add_cash'

export interface UserFriendlyWalletError {
  message: string
  insufficientFunds: boolean
}

function getErrorCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'number' ? code : undefined
}

function getErrorText(error: unknown): string {
  if (error instanceof BaseError) {
    return [error.shortMessage, error.details, error.message, error.name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  }
  if (error instanceof Error) return `${error.name} ${error.message}`.toLowerCase()
  return String(error ?? '').toLowerCase()
}

export function getUserFriendlyError(error: unknown): UserFriendlyWalletError {
  console.error(error)

  if (error instanceof BaseError) {
    if (error.walk(err => err instanceof UserRejectedRequestError)) {
      return { message: 'Transaction cancelled.', insufficientFunds: false }
    }
    if (error.walk(err => err instanceof InsufficientFundsError)) {
      return {
        message: 'Insufficient balance to complete this transaction.',
        insufficientFunds: true,
      }
    }
  }

  const code = getErrorCode(error)
  const text = getErrorText(error)

  if (code === 4001 || /user rejected|user denied|transaction cancelled|rejected the request/.test(text)) {
    return { message: 'Transaction cancelled.', insufficientFunds: false }
  }

  if (
    (code === -32000 && /insufficient funds|exceeds transaction sender account balance/.test(text)) ||
    /insufficient funds|insufficient balance|exceeds transaction sender account balance|not enough funds/.test(text)
  ) {
    return {
      message: 'Insufficient balance to complete this transaction.',
      insufficientFunds: true,
    }
  }

  return { message: 'Transaction failed. Please try again.', insufficientFunds: false }
}
