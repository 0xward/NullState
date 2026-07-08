'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useVault } from '@/hooks/useVault'
import { validateVaultCode } from '@/lib/vault-utils'

interface VaultSubmitFormProps {
  walletAddress?: string
}

export default function VaultSubmitForm({ walletAddress }: VaultSubmitFormProps) {
  const [code, setCode] = useState('')
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  const {
    remainingAttempts,
    hasClaimed,
    isLocked,
    isCodeSet,
    isLoading,
    error,
    currentWeekId,
    submitVaultCode,
  } = useVault(walletAddress)

  const canSubmit = useMemo(
    () =>
      Boolean(walletAddress) &&
      validateVaultCode(code) &&
      !isLoading &&
      !hasClaimed &&
      !isLocked &&
      remainingAttempts > 0,
    [walletAddress, code, isLoading, hasClaimed, isLocked, remainingAttempts],
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return

    try {
      const response = await submitVaultCode(code)
      setResultMessage(response.message)
      if (response.success) setCode('')
    } catch (submitError) {
      setResultMessage(submitError instanceof Error ? submitError.message : 'Submission failed')
    }
  }

  return (
    <section className="rounded-xl border border-[rgba(0,255,136,0.2)] bg-[rgba(3,12,8,0.6)] p-5">
      <h2 className="font-mono text-sm uppercase tracking-[2px] text-null-green">Vault Quest</h2>
      <p className="mt-2 text-sm text-null-muted">Week {currentWeekId.toString()} · {remainingAttempts} attempts left</p>

      {!walletAddress && <p className="mt-3 text-sm text-null-amber">Connect wallet to submit vault code.</p>}
      {hasClaimed && <p className="mt-3 text-sm text-null-green">Vault already unlocked this week.</p>}
      {isLocked && <p className="mt-3 text-sm text-null-red">Vault locked. Come back next week.</p>}
      {!isCodeSet && <p className="mt-3 text-sm text-null-muted">Code not published yet.</p>}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3" aria-describedby="vault-status">
        <label htmlFor="vaultCode" className="block text-xs font-mono uppercase tracking-[2px] text-null-muted">
          4-digit vault code
        </label>
        <input
          id="vaultCode"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
          className="w-full rounded-md border border-[rgba(0,255,136,0.3)] bg-black/40 px-3 py-2 text-null-white outline-none focus:border-null-green"
          aria-invalid={code.length > 0 && !validateVaultCode(code)}
          disabled={!walletAddress || hasClaimed || isLocked || !isCodeSet}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md border border-null-green px-4 py-2 font-mono text-xs uppercase tracking-[2px] text-null-green transition hover:bg-null-green hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? 'Submitting...' : 'Submit Code'}
        </button>
      </form>

      <p id="vault-status" className="mt-3 text-sm" role="status" aria-live="polite">
        {error ?? resultMessage}
      </p>
    </section>
  )
}
