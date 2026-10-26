interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  confirming?: boolean
  tone?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirming = false,
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-navy-950/45"
        aria-label={cancelLabel}
        onClick={onCancel}
        disabled={confirming}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-(--shadow-elevated)"
      >
        <h2 id="confirm-dialog-title" className="font-brand text-xl font-bold text-navy-900">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{message}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className={
              tone === 'danger'
                ? 'h-10 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-bg)] text-sm font-semibold text-[var(--color-danger)] disabled:opacity-60'
                : 'h-10 rounded-lg bg-navy-900 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60'
            }
          >
            {confirming ? 'Working…' : confirmLabel}
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={onCancel}
            className="h-10 rounded-lg text-sm font-semibold text-ink-muted hover:bg-canvas disabled:opacity-60"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
