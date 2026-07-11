'use client'

import { useState } from 'react'

interface SaveConfirmModalProps {
  open: boolean
  canSave: boolean
  onSaveAndExit: () => Promise<void>
  onExitWithoutSaving: () => void
  onCancel: () => void
}

export default function SaveConfirmModal({
  open,
  canSave,
  onSaveAndExit,
  onExitWithoutSaving,
  onCancel,
}: SaveConfirmModalProps) {
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const handleSaveAndExit = async () => {
    setSaving(true)
    await onSaveAndExit()
    setSaving(false)
  }

  return (
    <div className="ns-confirm-overlay" role="dialog" aria-label="Save progress">
      <div className="ns-confirm-box">
        <div className="ns-confirm-title">Save Progress?</div>
        <p className="ns-confirm-text">
          {canSave
            ? "Save your current floor and inventory before you go? You'll be able to continue from this exact bunker next time."
            : "You're not inside a bunker right now, so there's nothing to save."}
        </p>
        <div className="ns-confirm-btns">
          {canSave && (
            <button className="ns-confirm-btn primary" onClick={handleSaveAndExit} disabled={saving}>
              {saving ? 'Saving…' : 'Save & Exit'}
            </button>
          )}
          <button className="ns-confirm-btn" onClick={onExitWithoutSaving} disabled={saving}>
            Exit Without Saving
          </button>
          <button className="ns-confirm-btn ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
