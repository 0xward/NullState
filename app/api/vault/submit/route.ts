import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'
import { formatUnits } from 'viem'
import { TREASURE_VAULT_ABI, TREASURE_VAULT_ADDRESS } from '@/lib/contract-abi'
import { MARKETPLACE_TOKENS } from '@/lib/constants/tokens'

// Minimal read ABI matching the DEPLOYED TreasureVault (public `vaultReward`
// getter is lowercase; TREASURE_VAULT_ABI still carries the old `VAULT_REWARD`
// constant name the live contract no longer exposes).
const VAULT_READ_ABI = [
  { name: 'vaultReward', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'currentRewardToken', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const
import { getAdminDb } from '@/firebase-config'
import { vaultSubmitBodySchema } from '@/lib/validation'
import {
  getAttemptsRemaining,
  parseWeekId,
  normalizeWalletAddress,
} from '@/lib/vault-utils'

// The on-chain payout can involve up to TWO sequential transactions the first
// time anyone wins in a given week (store the week's code on-chain, then pay),
// each of which waits for a Celo receipt. On Vercel the default function
// timeout (10s) is not enough for that and the request was being killed AFTER
// the code was stored but BEFORE submitVaultCode was ever broadcast — the
// player's win was recorded off-chain but no USDT ever moved (confirmed
// on-chain: code stored, pool claimed still 0, no submitVaultCode tx at all).
// Give the route real headroom so both txs can confirm in one request.
export const maxDuration = 60

type PayoutResult = { rewardStatus: 'paid' | 'pending'; txHash: string | null }

// Best-effort on-chain finalize: make sure this week's code is stored on-chain
// (backend signer is authorized), then pay the winner. NEVER throws — a failure
// here leaves the reward `pending`, it never turns a correct code into an error.
// Both the first-win path and the self-heal path (re-open a vault whose reward
// is still pending) funnel through here so the logic lives in one place.
async function finalizeVaultPayout(params: {
  weekId: number
  walletAddress: string
  normalizedWallet: string
  expectedCode: string
  db: NonNullable<ReturnType<typeof getAdminDb>>
}): Promise<PayoutResult> {
  const { weekId, walletAddress, normalizedWallet, expectedCode, db } = params

  const backendPrivateKey = process.env.BACKEND_PRIVATE_KEY as `0x${string}` | undefined
  if (!backendPrivateKey || !TREASURE_VAULT_ADDRESS || TREASURE_VAULT_ADDRESS === '0x') {
    return { rewardStatus: 'pending', txHash: null }
  }

  try {
    const account = privateKeyToAccount(backendPrivateKey)
    const transport = http(process.env.CELO_RPC_URL ?? process.env.NEXT_PUBLIC_CELO_RPC ?? 'https://forno.celo.org')
    const publicClient = createPublicClient({ chain: celo, transport })
    const walletClient = createWalletClient({ chain: celo, transport, account })
    const weekBig = BigInt(weekId)

    // AUTO on-chain code sync — submitVaultCode() reverts unless this week's
    // code is already stored on-chain. Guarded by isCodeSetForWeek so it runs
    // at most once per week; a race that reverts with "already set" is caught
    // and we proceed to pay.
    const alreadySet = await publicClient
      .readContract({ address: TREASURE_VAULT_ADDRESS, abi: TREASURE_VAULT_ABI, functionName: 'isCodeSetForWeek', args: [weekBig] })
      .catch(() => false)
    if (!alreadySet) {
      try {
        const storeHash = await walletClient.writeContract({
          address: TREASURE_VAULT_ADDRESS,
          abi: TREASURE_VAULT_ABI,
          functionName: 'storeWeeklyVaultCode',
          args: [weekBig, expectedCode], // the Firebase code the Paper shows
          account,
        })
        await publicClient.waitForTransactionReceipt({ hash: storeHash })
      } catch (storeErr) {
        const nowSet = await publicClient
          .readContract({ address: TREASURE_VAULT_ADDRESS, abi: TREASURE_VAULT_ABI, functionName: 'isCodeSetForWeek', args: [weekBig] })
          .catch(() => false)
        if (!nowSet) throw storeErr
      }
    }

    // Pay the winner. We submit the EXPECTED (canonical) code rather than the
    // raw user input: correctness was already authenticated off-chain against
    // Firebase, so this guarantees the on-chain string comparison matches and
    // the reward is released (a self-heal re-open must pay even if the player
    // fat-fingers a digit the second time).
    const hash = await walletClient.writeContract({
      address: TREASURE_VAULT_ADDRESS,
      abi: TREASURE_VAULT_ABI,
      functionName: 'submitVaultCode',
      args: [walletAddress as `0x${string}`, weekBig, expectedCode],
      account,
    })
    await publicClient.waitForTransactionReceipt({ hash })

    // Stamp what was actually paid (amount + token symbol) so the Rewards
    // history can show "+0.05 USDT" without a later RPC read. Best-effort —
    // the payout already succeeded, so a failed read here must not undo it.
    let paidAmount: number | undefined
    let paidToken: string | undefined
    try {
      const [reward, tokenAddr] = await Promise.all([
        publicClient.readContract({ address: TREASURE_VAULT_ADDRESS, abi: VAULT_READ_ABI, functionName: 'vaultReward' }) as Promise<bigint>,
        publicClient.readContract({ address: TREASURE_VAULT_ADDRESS, abi: VAULT_READ_ABI, functionName: 'currentRewardToken' }) as Promise<`0x${string}`>,
      ])
      const match = Object.values(MARKETPLACE_TOKENS).find((t) => t.address.toLowerCase() === String(tokenAddr).toLowerCase())
      const decimals = match?.decimals ?? 18
      paidAmount = Number(formatUnits(reward, decimals))
      paidToken = match?.symbol ?? 'USD'
    } catch { /* leave amount/token unset; history falls back to a live read */ }

    await db.ref(`vaultCompleted/${weekId}/${normalizedWallet}`).update({
      txHash: hash,
      ...(paidAmount !== undefined ? { amount: paidAmount, token: paidToken } : {}),
    })
    return { rewardStatus: 'paid', txHash: hash }
  } catch (payErr) {
    // Correct code, but the on-chain payout couldn't complete (RPC hiccup,
    // gas, timeout). The player keeps their CORRECT result; the reward stays
    // pending and self-heals the next time they open the vault.
    console.error('[vault/submit] payout failed (kept pending):', payErr instanceof Error ? payErr.message : payErr)
    return { rewardStatus: 'pending', txHash: null }
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsedBody = vaultSubmitBodySchema.safeParse(await req.json())
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      )
    }

    const { walletAddress, weekId: rawWeekId, code } = parsedBody.data
    const weekId = parseWeekId(rawWeekId)
    const normalizedWallet = normalizeWalletAddress(walletAddress)

    const db = getAdminDb()
    if (!db) {
      return NextResponse.json(
        { error: 'Firebase Admin is not configured on the server' },
        { status: 503 },
      )
    }

    const [codeSnap, attemptsSnap, solvedSnap, paperClaimSnap, goldenKeyClaimSnap] = await Promise.all([
      db.ref(`vaultCodes/${weekId}`).get(),
      db.ref(`vaultAttempts/${weekId}/${normalizedWallet}`).get(),
      db.ref(`vaultCompleted/${weekId}/${normalizedWallet}`).get(),
      db.ref(`paperClaims/${weekId}/${normalizedWallet}`).get(),
      db.ref(`goldenKeyClaims/${weekId}/${normalizedWallet}`).get(),
    ])

    if (!codeSnap.exists()) {
      return NextResponse.json({ error: 'Vault code not found for this week' }, { status: 404 })
    }

    const expectedCode = String(codeSnap.val()?.code ?? '')

    // #9C — item-ownership gate. Paper and Golden Key are both capped at
    // 1/wallet/week and recorded the moment they're picked up; reuse those
    // records as the ownership check before spending an attempt.
    const hasPaper = paperClaimSnap.exists()
    const hasGoldenKey = goldenKeyClaimSnap.exists()
    if (!hasPaper || !hasGoldenKey) {
      const missing = [!hasPaper && 'Paper', !hasGoldenKey && 'the Golden Key'].filter(Boolean).join(' and ')
      return NextResponse.json(
        {
          success: false,
          isCorrect: false,
          error: 'missing_items',
          message: `You need ${missing} from this week's containers before you can submit a vault code.`,
          attemptsRemaining: getAttemptsRemaining(Number(attemptsSnap.val() ?? 0)),
        },
        { status: 200 },
      )
    }

    // Already recorded a win this week. If the on-chain payout already landed
    // (txHash present) we're done. If it's still PENDING — the classic case
    // where the first win of the week timed out mid-payout — retry ONLY the
    // payout now (the code is stored on-chain by this point, so it's a single
    // fast tx). This self-heals a stuck reward the instant the player re-opens
    // the vault, without spending an attempt or re-validating the code.
    if (solvedSnap.exists()) {
      const solved = solvedSnap.val() as { txHash?: string | null } | null
      const alreadyPaid = !!(solved && typeof solved.txHash === 'string' && solved.txHash.length > 0)
      if (alreadyPaid) {
        return NextResponse.json(
          { success: true, isCorrect: true, rewardStatus: 'paid', message: 'Vault already unlocked for this week', attemptsRemaining: 0, txHash: solved!.txHash },
          { status: 200 },
        )
      }
      const finalize = await finalizeVaultPayout({ weekId, walletAddress, normalizedWallet, expectedCode, db })
      return NextResponse.json(
        {
          success: true,
          isCorrect: true,
          rewardStatus: finalize.rewardStatus,
          attemptsRemaining: 0,
          message: finalize.rewardStatus === 'paid'
            ? 'Correct code! Reward sent.'
            : 'Correct code! Your reward is being finalized — reopen the vault in a moment to claim it.',
          txHash: finalize.txHash,
        },
        { status: 200 },
      )
    }

    const attemptsUsed = Number(attemptsSnap.val() ?? 0)
    if (attemptsUsed >= 3) {
      return NextResponse.json(
        { success: false, isCorrect: false, message: 'No attempts remaining this week', attemptsRemaining: 0 },
        { status: 200 },
      )
    }

    // The Firebase code (the exact value the player's Paper shows) is the
    // SOURCE OF TRUTH for correctness. The on-chain reward is a SEPARATE,
    // best-effort step (see finalizeVaultPayout) — it must NEVER turn a
    // correct code into an error.
    const isCorrect = expectedCode === code
    const updatedAttempts = attemptsUsed + 1

    await db.ref(`vaultAttempts/${weekId}/${normalizedWallet}`).set(updatedAttempts)

    let txHash: string | null = null
    let rewardStatus: 'paid' | 'pending' | 'none' = isCorrect ? 'pending' : 'none'

    if (isCorrect) {
      // Record the win immediately — independent of the payout.
      await db.ref(`vaultCompleted/${weekId}/${normalizedWallet}`).set({
        completedAt: Date.now(),
        attempts: updatedAttempts,
        txHash: null,
      })

      const finalize = await finalizeVaultPayout({ weekId, walletAddress, normalizedWallet, expectedCode, db })
      txHash = finalize.txHash
      rewardStatus = finalize.rewardStatus
    }

    return NextResponse.json(
      {
        success: isCorrect,
        isCorrect,
        rewardStatus,
        attemptsRemaining: getAttemptsRemaining(updatedAttempts),
        attemptsUsed: updatedAttempts,
        message: isCorrect
          ? (rewardStatus === 'paid'
              ? 'Correct code! Reward sent.'
              : 'Correct code! Your reward is being finalized — reopen the vault in a moment to claim it.')
          : 'Wrong code. Try again.',
        txHash,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Vault submit error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Invalid weekId' ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
