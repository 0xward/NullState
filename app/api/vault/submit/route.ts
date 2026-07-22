import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'
import { TREASURE_VAULT_ABI, TREASURE_VAULT_ADDRESS } from '@/lib/contract-abi'
import { getAdminDb } from '@/firebase-config'
import { vaultSubmitBodySchema } from '@/lib/validation'
import {
  getAttemptsRemaining,
  parseWeekId,
  normalizeWalletAddress,
} from '@/lib/vault-utils'

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

    // #9C — item-ownership gate. Previously this route only checked whether
    // the submitted 4-digit `code` matched vaultCodes/{weekId}; a wallet that
    // never actually picked up Paper or the Golden Key this week (e.g. one
    // that just got the code shared by someone else) could still submit and
    // unlock the vault. Paper and Golden Key are both capped at 1/wallet/week
    // and recorded at paperClaims/{weekId}/{wallet} and
    // goldenKeyClaims/{weekId}/{wallet} the moment they're picked up (see
    // /api/paper/claim and /api/goldenkey/claim) — reuse those same records
    // here as the ownership check instead of introducing a separate stash
    // ledger. This check runs before the attempt counter is spent, so a
    // wallet missing either item isn't burning one of its 3 weekly attempts
    // just to be told it can't submit yet.
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

    if (solvedSnap.exists()) {
      return NextResponse.json(
        { success: true, isCorrect: true, message: 'Vault already unlocked for this week', attemptsRemaining: 0 },
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
    // best-effort step — it must NEVER turn a correct code into an error.
    //
    // The old flow called submitVaultCode() on-chain unconditionally and
    // awaited the receipt inside the main try; the contract reverts when the
    // code wasn't ALSO stored on-chain (storeWeeklyVaultCode) or the reward
    // pool isn't funded, which threw -> route 500 -> the client's fallback
    // branch printed "Wrong code" for a CORRECT code. That's the reported
    // bug: a correct code read off the Paper looked wrong because USDT
    // hadn't been deposited / the on-chain code wasn't set.
    const expectedCode = String(codeSnap.val()?.code ?? '')
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

      const backendPrivateKey = process.env.BACKEND_PRIVATE_KEY as `0x${string}` | undefined
      if (backendPrivateKey && TREASURE_VAULT_ADDRESS && TREASURE_VAULT_ADDRESS !== '0x') {
        try {
          const account = privateKeyToAccount(backendPrivateKey)
          const transport = http(process.env.CELO_RPC_URL ?? process.env.NEXT_PUBLIC_CELO_RPC ?? 'https://forno.celo.org')
          const publicClient = createPublicClient({ chain: celo, transport })
          const walletClient = createWalletClient({ chain: celo, transport, account })

          const hash = await walletClient.writeContract({
            address: TREASURE_VAULT_ADDRESS,
            abi: TREASURE_VAULT_ABI,
            functionName: 'submitVaultCode',
            args: [walletAddress as `0x${string}`, BigInt(weekId), code],
            account,
          })
          await publicClient.waitForTransactionReceipt({ hash })
          txHash = hash
          rewardStatus = 'paid'
          await db.ref(`vaultCompleted/${weekId}/${normalizedWallet}/txHash`).set(hash)
        } catch (payErr) {
          // Correct code, but the on-chain payout couldn't complete — almost
          // always because the owner hasn't stored this week's code on-chain
          // (storeWeeklyVaultCode) and/or funded the reward pool. The player
          // still gets a CORRECT result; the reward is marked pending.
          console.error('[vault/submit] correct code but payout failed:', payErr instanceof Error ? payErr.message : payErr)
          rewardStatus = 'pending'
        }
      }
    }

    return NextResponse.json(
      {
        success: isCorrect,
        isCorrect,
        rewardStatus,
        attemptsRemaining: getAttemptsRemaining(updatedAttempts),
        attemptsUsed: updatedAttempts,
        message: isCorrect
          ? (rewardStatus === 'paid' ? 'Correct code! Reward sent.' : 'Correct code! Reward will arrive once the vault pool is funded.')
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
