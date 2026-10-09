import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { X } from 'lucide-react'
import type { Opportunity, OpportunityUpdate } from '@/types'
import {
  useEditorGuard,
  type OpportunityEditorHandle,
} from '@/components/shared/EditorGuardContext'
import {
  ACQUISITION_STAGES,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  SOURCE_TYPES,
} from '@/data/constants'
import {
  opportunityDraftPatch,
  opportunityDraftsEqual,
  snapshotOpportunityDraft,
  type OpportunityDraft,
} from '@/lib/opportunityDraft'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'

export type { OpportunityEditorHandle }

interface OpportunityEditorProps {
  opportunity: Opportunity
  onSave: (patch: OpportunityUpdate) => Promise<void>
  onClose?: () => void
  tabs?: Array<{ id: string; label: string }>
}

const DEFAULT_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'status', label: 'Status & Stage' },
  { id: 'entity', label: 'Entity' },
  { id: 'diligence', label: 'Diligence' },
  { id: 'actions', label: 'Next Actions' },
]

export const OpportunityEditor = forwardRef<OpportunityEditorHandle, OpportunityEditorProps>(
  function OpportunityEditor({ opportunity, onSave, onClose, tabs = DEFAULT_TABS }, ref) {
    const [tab, setTab] = useState(tabs[0]?.id ?? 'overview')
    const [saved, setSaved] = useState(() => snapshotOpportunityDraft(opportunity))
    const [draft, setDraft] = useState<OpportunityDraft>(() => snapshotOpportunityDraft(opportunity))
    const [saving, setSaving] = useState(false)
    const savingRef = useRef(false)
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)

    const dirty = !opportunityDraftsEqual(saved, draft)
    const guard = useEditorGuard()

    useEffect(() => {
      const snap = snapshotOpportunityDraft(opportunity)
      setSaved(snap)
      setDraft(snap)
      setMessage(null)
      setError(null)
      setTab(tabs[0]?.id ?? 'overview')
      setPendingLeave(null)
      // Only reset when switching records; the live row object updates after save.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- opportunity.id is the switch key
    }, [opportunity.id])

    const persist = useCallback(async (): Promise<boolean> => {
      if (opportunityDraftsEqual(saved, draft)) {
        setMessage('No changes to save')
        return true
      }
      if (savingRef.current) return false
      savingRef.current = true
      setSaving(true)
      setError(null)
      try {
        const patch = opportunityDraftPatch(saved, draft)
        await onSave(patch)
        setSaved(draft)
        setMessage('Saved to database')
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
        return false
      } finally {
        savingRef.current = false
        setSaving(false)
      }
    }, [saved, draft, onSave])

    const discard = useCallback(() => {
      setDraft(saved)
      setError(null)
      setMessage(null)
    }, [saved])

    const requestLeave = useCallback(
      (next: () => void) => {
        if (!dirty) {
          next()
          return
        }
        setPendingLeave(() => next)
      },
      [dirty],
    )

    useImperativeHandle(
      ref,
      () => ({
        isDirty: () => dirty,
        requestLeave,
      }),
      [dirty, requestLeave],
    )

    useEffect(() => {
      guard?.register({ isDirty: () => dirty, requestLeave })
      return () => guard?.register(null)
    }, [dirty, requestLeave, guard])

    useEffect(() => {
      if (!dirty) return
      const onBeforeUnload = (event: BeforeUnloadEvent) => {
        event.preventDefault()
        event.returnValue = ''
      }
      window.addEventListener('beforeunload', onBeforeUnload)
      return () => window.removeEventListener('beforeunload', onBeforeUnload)
    }, [dirty])

    const setField = <K extends keyof OpportunityDraft>(key: K, val: OpportunityDraft[K]) => {
      setDraft((prev) => ({ ...prev, [key]: val }))
      setMessage(null)
    }

    const handleDialogSave = async () => {
      const ok = await persist()
      if (!ok) return
      const next = pendingLeave
      setPendingLeave(null)
      next?.()
    }

    const handleDialogDiscard = () => {
      discard()
      const next = pendingLeave
      setPendingLeave(null)
      next?.()
    }

    const handleDialogCancel = () => {
      if (saving) return
      setPendingLeave(null)
    }

    const outstandingText = (draft.outstandingItems ?? []).join('\n')

    return (
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-accent uppercase">
              Project {opportunity.projectNumber ?? '—'}
            </p>
            <h2 className="mt-1 font-brand text-xl font-bold text-navy-900">
              {draft.projectName}
            </h2>
            <p className="text-sm text-ink-muted">{draft.entityName}</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={() => requestLeave(onClose)}
              className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
              aria-label="Close opportunity editor"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'bg-accent-soft text-navy-900'
                  : 'text-ink-muted hover:bg-canvas hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="custom-scroll flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-lg border border-accent-muted/60 bg-accent-soft/40 p-3">
            <label className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
              Status (editable on all tabs)
            </label>
            <select
              value={draft.status}
              onChange={(e) => setField('status', e.target.value as Opportunity['status'])}
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {OPPORTUNITY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {(tab === 'overview' || tab === 'status') && (
            <Field label="Acquisition Stage">
              <select
                value={draft.stage}
                onChange={(e) => setField('stage', e.target.value as Opportunity['stage'])}
                className="field-input"
              >
                {ACQUISITION_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {(tab === 'overview' || tab === 'entity') && (
            <>
              <Field label="Project name">
                <input
                  className="field-input"
                  value={draft.projectName}
                  onChange={(e) => setField('projectName', e.target.value)}
                />
              </Field>
              <Field label="Entity / company">
                <input
                  className="field-input"
                  value={draft.entityName}
                  onChange={(e) => setField('entityName', e.target.value)}
                />
              </Field>
              <Field label="Deal lead">
                <input
                  className="field-input"
                  value={draft.dealLead}
                  onChange={(e) => setField('dealLead', e.target.value)}
                />
              </Field>
              <Field label="Opportunity type">
                <select
                  className="field-input"
                  value={draft.type}
                  onChange={(e) => setField('type', e.target.value as Opportunity['type'])}
                >
                  {OPPORTUNITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Specialty">
                <input
                  className="field-input"
                  value={draft.specialty}
                  onChange={(e) => setField('specialty', e.target.value)}
                />
              </Field>
              <Field label="Geography">
                <input
                  className="field-input"
                  value={draft.geography}
                  onChange={(e) => setField('geography', e.target.value)}
                />
              </Field>
              <Field label="Source type">
                <select
                  className="field-input"
                  value={draft.sourceType}
                  onChange={(e) =>
                    setField('sourceType', e.target.value as Opportunity['sourceType'])
                  }
                >
                  {SOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Source name">
                <input
                  className="field-input"
                  value={draft.sourceName}
                  onChange={(e) => setField('sourceName', e.target.value)}
                />
              </Field>
            </>
          )}

          {tab === 'overview' && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="NWP">
                <input
                  type="number"
                  className="field-input"
                  value={draft.nwp}
                  onChange={(e) => setField('nwp', Number(e.target.value))}
                />
              </Field>
              <Field label="Net Revenue">
                <input
                  type="number"
                  className="field-input"
                  value={draft.netRevenue}
                  onChange={(e) => setField('netRevenue', Number(e.target.value))}
                />
              </Field>
              <Field label="PF EBITDA">
                <input
                  type="number"
                  className="field-input"
                  value={draft.pfEbitda}
                  onChange={(e) => setField('pfEbitda', Number(e.target.value))}
                />
              </Field>
            </div>
          )}

          {tab === 'diligence' && (
            <>
              <Field label="Outstanding items (one per line)">
                <textarea
                  className="field-input min-h-28"
                  value={outstandingText}
                  onChange={(e) =>
                    setField(
                      'outstandingItems',
                      e.target.value
                        .split('\n')
                        .map((l) => l.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder={'Call lawyer\nCall accountant\nConfirm data room access'}
                />
              </Field>
              <Field label="Diligence notes">
                <textarea
                  className="field-input min-h-28"
                  value={draft.diligenceNotes ?? ''}
                  onChange={(e) => setField('diligenceNotes', e.target.value)}
                  placeholder="Where are we in due diligence?"
                />
              </Field>
            </>
          )}

          {(tab === 'actions' || tab === 'overview') && (
            <>
              <Field label="Next action">
                <input
                  className="field-input"
                  value={draft.nextAction ?? ''}
                  onChange={(e) => setField('nextAction', e.target.value || null)}
                />
              </Field>
              <Field label="Next action date">
                <input
                  type="date"
                  className="field-input"
                  value={draft.nextActionDate ?? ''}
                  onChange={(e) => setField('nextActionDate', e.target.value || null)}
                />
              </Field>
              <Field label="Priority">
                <select
                  className="field-input"
                  value={draft.priority}
                  onChange={(e) => setField('priority', e.target.value as Opportunity['priority'])}
                >
                  <option value="A">A — Must move this week</option>
                  <option value="B">B — Important but can wait</option>
                  <option value="C">C — Monitor only</option>
                </select>
              </Field>
            </>
          )}
        </div>

        <div className="border-t border-border bg-canvas px-5 py-3">
          {error && pendingLeave == null && (
            <p className="mb-2 text-xs text-attention">{error}</p>
          )}
          {message && <p className="mb-2 text-xs text-success">{message}</p>}
          <button
            type="button"
            disabled={saving}
            onClick={() => void persist()}
            className="h-10 w-full rounded-lg bg-navy-900 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes to database'}
          </button>
        </div>

        <UnsavedChangesDialog
          open={pendingLeave != null}
          saving={saving}
          error={error}
          onSave={() => void handleDialogSave()}
          onDiscard={handleDialogDiscard}
          onCancel={handleDialogCancel}
        />

        <style>{`
        .field-input {
          margin-top: 0.35rem;
          width: 100%;
          height: 2.5rem;
          border-radius: 0.5rem;
          border: 1px solid var(--color-border);
          background: white;
          padding: 0 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        textarea.field-input {
          height: auto;
          padding: 0.6rem 0.75rem;
        }
        .field-input:focus {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 2px rgb(61 126 184 / 0.2);
        }
      `}</style>
      </div>
    )
  },
)

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}
