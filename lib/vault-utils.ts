export const MAX_VAULT_ATTEMPTS = 3

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
