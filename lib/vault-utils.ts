import { getISOWeekId } from './web3-client'

export const MAX_VAULT_ATTEMPTS = 3

// Golden Key (Phase 5.5 #9A) and the weekly Paper code (#9B) share the exact
// same weekId scheme as the existing Vault code system (getISOWeekId() —
// YYYYWW, resets at the ISO week boundary = Monday 00:00 UTC). Re-exported
// here so API routes for all three features import one shared helper
// instead of each recomputing the week boundary slightly differently.
export function getCurrentWeekIdString(): string {
  return String(getISOWeekId())
}

export function normalizeWalletAddress(address: string): string {
  return address.trim().toLowerCase()
}

export function parseWeekId(weekId: string | number | bigint): number {
  const value = Number(weekId)
  if (!Number.isInteger(value) || value < 200001 || value > 999953) {
    throw new Error('Invalid weekId')
  }
  return value
}

export function validateVaultCode(code: string): boolean {
  return /^\d{4}$/.test(code.trim())
}

export function getAttemptsRemaining(attemptsUsed: number): number {
  return Math.max(0, MAX_VAULT_ATTEMPTS - attemptsUsed)
}
