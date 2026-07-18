import { isAddress } from 'viem'
import { z } from 'zod'

export const walletAddressSchema = z
  .string()
  .trim()
  .min(1, 'walletAddress is required')
  .refine(isAddress, 'Invalid wallet address')

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(32, 'Username must be 32 characters or less')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscore, hyphen')

export const weekIdInputSchema = z.coerce.string().trim().min(1, 'weekId is required')
export const seasonIdInputSchema = z.coerce.string().trim().min(1, 'seasonId is required')
export const vaultCodeSchema = z.string().trim().regex(/^\d{4}$/, 'Code must be 4 digits')

export const vaultSubmitBodySchema = z.object({
  walletAddress: walletAddressSchema,
  weekId: weekIdInputSchema,
  code: vaultCodeSchema,
})

const burnItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  rarity: z.string().optional(),
  qty: z.number().finite().positive().optional(),
  burnValue: z.number().finite().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
})

export const burnRecordBodySchema = z.object({
  wallet: walletAddressSchema,
  items: z.array(burnItemSchema).min(1, 'items must be a non-empty array').max(20, 'Too many items in one burn'),
  totalValue: z.number().finite().optional(),
  timestamp: z.number().finite().optional(),
})

// Golden Key weekly claim (Phase 5.5 #9A) — wallet only, weekId is always
// derived server-side from the current date (never trust a client-supplied
// week), so there's no weekId field here unlike vaultSubmitBodySchema.
export const goldenKeyClaimBodySchema = z.object({
  wallet: walletAddressSchema,
})

// Paper weekly claim (Phase 5.5 #9B) — same shape/rationale as the Golden
// Key claim above: wallet only, weekId derived server-side.
export const paperClaimBodySchema = z.object({
  wallet: walletAddressSchema,
})
