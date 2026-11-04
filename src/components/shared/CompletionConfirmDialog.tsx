import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { todayDateInput } from '@/lib/calendarDate'

interface Props {
  open: boolean
  projectName: string
  /** Prefill, e.g. a closing date already on the record. */
  initialDate?: string | null
  onConfirm: (closedAt: string) => void
  onCancel: () => void
}

/**
 * Asked every time a deal is set to Completed. Completed means LEGALLY CLOSED, so the user
 * confirms the actual legal closing date and the stage becomes Closing.
 */
export function CompletionConfirmDialog(props: Props) {
  if (!props.open) return null
  return <CompletionConfirmBody key={props.projectName} {...props} />
}

function CompletionConfirmBody({ projectName, initialDate, onConfirm, onCancel }: Props) {
  const today = todayDateInput()
  const [date, setDate] = useState(initialDate && initialDate <= today ? initialDate : today)
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4" data-confirm-dialog="open">
      <button type="button" className="absolute inset-0 bg-navy-950/45 backdrop-blur-[2px]" aria-label="Cancel" onClick={onCancel} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="completion-title" className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-(--shadow-elevated)" data-testid="completion-confirm">
        <h2 id="completion-title" className="flex items-center gap-2 font-brand text-xl font-bold text-navy-900">
          <CheckCircle2 className="h-5 w-5 text-success" /> Mark {projectName} as Completed?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Completed means the acquisition is <strong className="text-ink">legally closed</strong>. The stage will be set to Closing.
          The status changes everywhere right away. Completion figures in Reports stay provisional for 24 hours, then count on the legal closing date below.
        </p>
        <label className="mt-4 block text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
          Legal closing date
          <input
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm font-normal text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            data-testid="completion-date"
          />
        </label>
        {!valid && <p className="mt-1 text-xs text-danger">Enter the actual legal closing date (today or earlier).</p>}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" disabled={!valid} onClick={() => onConfirm(date)} className="h-10 flex-1 rounded-lg bg-navy-900 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50" data-testid="completion-confirm-button">
            Confirm legally closed
          </button>
          <button type="button" onClick={onCancel} className="h-10 flex-1 rounded-lg border border-border bg-surface text-sm font-semibold text-ink hover:bg-canvas">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
