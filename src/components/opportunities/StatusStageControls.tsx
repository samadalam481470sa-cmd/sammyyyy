import { useState } from 'react'
import type { Opportunity } from '@/types'
import { ACQUISITION_STAGES, OPPORTUNITY_STATUSES } from '@/data/constants'
import { CompletionConfirmDialog } from '@/components/shared/CompletionConfirmDialog'

export interface StatusStageDraft {
  status: Opportunity['status']
  stage: Opportunity['stage']
  closedAt: string | null
}

interface Props {
  opportunity: Opportunity
  /** Unsaved choice, or null when the controls show the saved record. */
  draft: StatusStageDraft | null
  onChange: (draft: StatusStageDraft | null) => void
  /** True when other unsaved edits on this tab (Overview fields) should also show Save / Discard. */
  otherDirty?: boolean
  saving: boolean
  error: string | null
  onSave: () => void
  /** Puts back every pending edit on the tab; defaults to clearing the status / stage draft. */
  onDiscard?: () => void
}

/**
 * Status and Acquisition Stage on every Full Profile tab. A choice here is a draft: nothing is
 * written, shared or logged until Save Changes. On Overview, Save Changes and Discard here act on the
 * whole Overview edit, the same as the buttons at the bottom. Choosing Completed asks for the legal closing date
 * first, and that date is part of the same draft.
 */
export function StatusStageControls({ opportunity, draft, onChange, otherDirty = false, saving, error, onSave, onDiscard }: Props) {
  const [confirming, setConfirming] = useState(false)
  const shown: StatusStageDraft = draft ?? { status: opportunity.status, stage: opportunity.stage, closedAt: opportunity.closedAt ?? null }
  const update = (next: StatusStageDraft) => {
    const same = next.status === opportunity.status && next.stage === opportunity.stage && (next.closedAt ?? null) === (opportunity.closedAt ?? null)
    onChange(same ? null : next)
  }
  const select = 'mt-1 h-9 w-full rounded-lg border border-border bg-white px-2.5 text-sm font-medium text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 normal-case tracking-normal'
  return (
    <div className="flex flex-wrap items-end gap-2" data-testid="profile-status-stage">
      <label className="w-40 text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">
        Status
        <select
          className={select}
          value={shown.status}
          disabled={saving}
          data-testid="profile-status"
          onChange={(e) => {
            const next = e.target.value as Opportunity['status']
            if (next === 'Completed') setConfirming(true)
            else update({ ...shown, status: next, closedAt: next === opportunity.status ? (opportunity.closedAt ?? null) : null })
          }}
        >
          {OPPORTUNITY_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="w-48 text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">
        Acquisition Stage
        <select className={select} value={shown.stage} disabled={saving} data-testid="profile-stage" onChange={(e) => update({ ...shown, stage: e.target.value as Opportunity['stage'] })}>
          {ACQUISITION_STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      {(draft || otherDirty) && (
        <div className="flex items-center gap-1.5">
          <button type="button" data-testid="profile-status-save" disabled={saving} onClick={onSave} className="h-9 rounded-lg bg-navy-900 px-3 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" data-testid="profile-status-discard" disabled={saving} onClick={() => (onDiscard ? onDiscard() : onChange(null))} className="h-9 rounded-lg border border-border px-3 text-sm font-semibold text-ink hover:bg-canvas">
            Discard
          </button>
        </div>
      )}
      {error && <p role="alert" className="w-full text-xs text-danger" data-testid="profile-status-error">{error}</p>}
      <CompletionConfirmDialog
        open={confirming}
        projectName={opportunity.projectName}
        initialDate={opportunity.closedAt ?? null}
        onCancel={() => setConfirming(false)}
        onConfirm={(closedAt) => {
          setConfirming(false)
          update({ status: 'Completed', stage: 'Closing', closedAt })
        }}
      />
    </div>
  )
}
