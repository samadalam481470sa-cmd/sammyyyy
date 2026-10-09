interface UnsavedChangesDialogProps {
  open: boolean
  saving?: boolean
  error?: string | null
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function UnsavedChangesDialog({
  open,
  saving = false,
  error,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-navy-950/45"
        aria-label="Cancel unsaved changes"
        onClick={onCancel}
        disabled={saving}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        aria-describedby="unsaved-changes-message"
        className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-(--shadow-elevated)"
      >
        <h2
          id="unsaved-changes-title"
          className="font-brand text-xl font-bold text-navy-900"
        >
          Unsaved Changes
        </h2>
        <p id="unsaved-changes-message" className="mt-2 text-sm leading-relaxed text-ink-muted">
          You have unsaved changes to this opportunity. Would you like to save them before
          continuing?
        </p>
        {error && (
          <p className="mt-3 rounded-lg border border-attention-border bg-attention-bg px-3 py-2 text-sm text-attention">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="h-10 rounded-lg bg-navy-900 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onDiscard}
            className="h-10 rounded-lg border border-border bg-canvas text-sm font-semibold text-ink hover:bg-accent-soft disabled:opacity-60"
          >
            Discard Changes
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="h-10 rounded-lg text-sm font-semibold text-ink-muted hover:bg-canvas disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
