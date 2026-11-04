import { useState } from 'react'
import type { Opportunity } from '@/types'
import { ACQUISITION_STAGES, OPPORTUNITY_STATUSES } from '@/data/constants'
import { useData } from '@/data/DataContext'
import { CompletionConfirmDialog } from '@/components/shared/CompletionConfirmDialog'

/**
 * Status and Acquisition Stage selectors shown on every Full Profile tab. Changes save at once
 * through the shared store; choosing Completed asks for the legal closing date first.
 */
export function StatusStageControls({ opportunity }: { opportunity: Opportunity }) {
  const { saveOpportunity } = useData()
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = (patch: Parameters<typeof saveOpportunity>[1]) => {
    setSaving(true)
    setError(null)
    void saveOpportunity(opportunity.id, patch)
      .catch((err) => setError(err instanceof Error ? err.message : 'Save failed'))
      .finally(() => setSaving(false))
  }
  const select = 'mt-1 h-9 w-full rounded-lg border border-border bg-white px-2.5 text-sm font-medium text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60'
  return (
    <div className="flex flex-wrap items-end gap-2" data-testid="profile-status-stage">
      <label className="w-40 text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">
        Status
        <select
          className={select}
          value={opportunity.status}
          disabled={saving}
          data-testid="profile-status"
          onChange={(e) => {
            const next = e.target.value as Opportunity['status']
            if (next === 'Completed') setConfirming(true)
            else run({ status: next })
          }}
        >
          {OPPORTUNITY_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="w-48 text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">
        Acquisition Stage
        <select className={select} value={opportunity.stage} disabled={saving} data-testid="profile-stage" onChange={(e) => run({ stage: e.target.value as Opportunity['stage'] })}>
          {ACQUISITION_STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      {error && <p className="w-full text-xs text-danger">{error}</p>}
      <CompletionConfirmDialog
        open={confirming}
        projectName={opportunity.projectName}
        initialDate={opportunity.closedAt ?? null}
        onCancel={() => setConfirming(false)}
        onConfirm={(closedAt) => {
          setConfirming(false)
          run({ status: 'Completed', stage: 'Closing', closedAt })
        }}
      />
    </div>
  )
}
