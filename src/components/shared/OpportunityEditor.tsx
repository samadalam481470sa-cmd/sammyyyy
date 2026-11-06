import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Opportunity, OpportunityUpdate } from '@/types'
import {
  useEditorGuard,
  type OpportunityEditorHandle,
} from '@/components/shared/EditorGuardContext'
import { registerPendingCommit } from '@/lib/userVault'
import {
  ACQUISITION_STAGES,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  SOURCE_TYPES,
} from '@/data/constants'
import {
  draftDateProblem,
  opportunityDraftPatch,
  opportunityDraftsEqual,
  snapshotOpportunityDraft,
  type OpportunityDraft,
} from '@/lib/opportunityDraft'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'
import { dealIdFromOpportunity } from '@/lib/dealId'
import { savedMessageLabel, saveButtonLabel } from '@/lib/persistenceMode'
import { useData } from '@/data/DataContext'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { CompletionConfirmDialog } from '@/components/shared/CompletionConfirmDialog'
import { DrawerHeader } from '@/components/shared/Overlay'
import { HeaderWarningChip, OpportunityHeaderDetails } from '@/components/opportunities/OpportunityHeaderDetails'
import { LeadTeamFields } from '@/components/opportunities/LeadTeamFields'
import { todayDateInput } from '@/lib/calendarDate'
import { formatDate } from '@/utils/dashboard'

export type { OpportunityEditorHandle }

interface OpportunityEditorProps {
  opportunity: Opportunity
  onSave: (patch: OpportunityUpdate) => Promise<void>
  onClose?: () => void
  onDeleted?: () => void
  tabs?: Array<{ id: string; label: string }>
  /** Shown at the very bottom, below Delete Opportunity. */
  footerExtra?: ReactNode
  /** Status and stage drafted in the profile header. Save Changes here commits them with the rest. */
  headerDraft?: { patch: OpportunityUpdate; onCommitted: () => void; onDiscard: () => void } | null
  /** Told whenever the editor's own fields gain or lose unsaved edits (header draft not included). */
  onDirtyChange?: (dirty: boolean) => void
  /** Hide the title block when the surrounding page already shows the deal (the full profile). */
  hideHeader?: boolean
}

// The old Diligence tab is gone: its two unique fields (outstanding items, diligence notes) moved to Company.
const DEFAULT_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'entity', label: 'Company' },
  { id: 'actions', label: 'Next Action' },
]

export const OpportunityEditor = forwardRef<OpportunityEditorHandle, OpportunityEditorProps>(
  function OpportunityEditor({ opportunity, onSave, onClose, onDeleted, tabs = DEFAULT_TABS, footerExtra, hideHeader = false, headerDraft = null, onDirtyChange }, ref) {
    const [tab, setTab] = useState(tabs[0]?.id ?? 'overview')
    const [saved, setSaved] = useState(() => snapshotOpportunityDraft(opportunity))
    const [draft, setDraft] = useState<OpportunityDraft>(() => snapshotOpportunityDraft(opportunity))
    const [saving, setSaving] = useState(false)
    const savingRef = useRef(false)
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [completionPrompt, setCompletionPrompt] = useState(false)
    const { tasks, documents, deleteOpportunity } = useData()
    const deletingRef = useRef(false)

    const fieldsDirty = !opportunityDraftsEqual(saved, draft)
    const dirty = fieldsDirty || headerDraft != null
    useEffect(() => {
      onDirtyChange?.(fieldsDirty)
    }, [fieldsDirty, onDirtyChange])
    // Status and closing date as they will be saved: the profile header's draft wins for status.
    const headerPatch = headerDraft?.patch as { status?: Opportunity['status']; closedAt?: string | null } | undefined
    const effectiveStatus = headerPatch?.status ?? draft.status
    const closedDateEdited = (draft.closedAt ?? null) !== (saved.closedAt ?? null)
    const effectiveClosedAt = closedDateEdited ? draft.closedAt : headerPatch?.closedAt !== undefined ? headerPatch.closedAt : draft.closedAt
    const linkedTaskCount = tasks.filter(
      (task) => task.opportunityId === opportunity.id && !task.deletedAt,
    ).length
    const linkedDocCount = documents.filter((doc) => doc.opportunityId === opportunity.id).length
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
      if (opportunityDraftsEqual(saved, draft) && !headerDraft) {
        setMessage('No changes to save')
        return true
      }
      if (savingRef.current) return false
      const dateProblem = draftDateProblem({ createdDate: draft.createdDate, status: effectiveStatus, closedAt: effectiveClosedAt ?? null })
      if (dateProblem) {
        setError(dateProblem)
        return false
      }
      const patchPreview = { ...opportunityDraftPatch(saved, draft), ...headerDraft?.patch } as { status?: string; stage?: string }
      const nextStatus = patchPreview.status ?? opportunity.status
      const nextStage = patchPreview.stage ?? opportunity.stage
      if ((patchPreview.status !== undefined || patchPreview.stage !== undefined) && nextStatus === 'Completed' && nextStage !== 'Closing') {
        setError('Completed deals must be at the Closing stage. Set the stage to Closing, or choose another status.')
        return false
      }
      savingRef.current = true
      setSaving(true)
      setError(null)
      try {
        // One save carries every pending edit: the header's status and stage plus every field here.
        const patch: OpportunityUpdate = { ...opportunityDraftPatch(saved, draft), ...headerDraft?.patch }
        // A closing date picked in the dates strip beats the one captured when Completed was chosen.
        if (closedDateEdited && effectiveStatus === 'Completed') patch.closedAt = draft.closedAt
        if (effectiveStatus !== 'Completed' && closedDateEdited && !headerDraft?.patch) delete patch.closedAt
        await onSave(patch)
        const committed = { ...draft, ...(headerDraft?.patch ?? {}), closedAt: effectiveStatus === 'Completed' ? (effectiveClosedAt ?? null) : null } as OpportunityDraft
        setSaved(committed)
        setDraft(committed)
        headerDraft?.onCommitted()
        setMessage(savedMessageLabel())
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
        return false
      } finally {
        savingRef.current = false
        setSaving(false)
      }
    }, [saved, draft, onSave, opportunity.status, opportunity.stage, headerDraft, effectiveStatus, effectiveClosedAt, closedDateEdited])

    const persistRef = useRef(persist)
    persistRef.current = persist
    const dirtyRef = useRef(dirty)
    dirtyRef.current = dirty
    useEffect(() => {
      return registerPendingCommit(async () => {
        if (!dirtyRef.current) return
        await persistRef.current()
      })
    }, [])

    // Discard puts back every pending edit, the profile header's status and stage included.
    const discard = useCallback(() => {
      setDraft(saved)
      setError(null)
      setMessage(null)
      headerDraft?.onDiscard()
    }, [saved, headerDraft])

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
        save: persist,
        discard,
        saving,
        error,
      }),
      [dirty, requestLeave, persist, discard, saving, error],
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

    const onStatusChange = (next: Opportunity['status']) => {
      if (next === 'Completed' && draft.status !== 'Completed') {
        setCompletionPrompt(true)
        return
      }
      setDraft((prev) => ({ ...prev, status: next, closedAt: next === 'Completed' ? prev.closedAt : null }))
      setMessage(null)
    }

    const closeButton = onClose ? () => requestLeave(onClose) : undefined

    return (
      <div className="flex h-full min-h-0 flex-col" data-opp-editor="">
        {!hideHeader && (
          <DrawerHeader
            eyebrow={dealIdFromOpportunity(opportunity)}
            title={opportunity.projectName}
            subtitle={opportunity.entityName}
            onClose={closeButton}
            closeLabel="Close opportunity editor"
            actions={<HeaderWarningChip opportunity={opportunity} tasks={tasks} />}
          >
            <OpportunityHeaderDetails opportunity={opportunity} tasks={tasks} />
          </DrawerHeader>
        )}

        <div className="flex min-w-0 shrink-0 gap-1 border-b border-border bg-surface px-3 pt-2" data-opp-editor-tabs="">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-w-0 flex-1 border-b-2 px-2 py-2 text-center text-xs font-semibold whitespace-nowrap transition-colors ${
                tab === t.id ? 'border-navy-900 text-navy-900' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="custom-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3" data-opp-editor-body="">
          {!hideHeader && <div className="grid grid-cols-2 gap-3 rounded-lg border border-accent-muted/60 bg-accent-soft/40 px-3 py-2">
            <label className="block min-w-0">
              <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Status</span>
              <select
                value={draft.status}
                data-testid="editor-status"
                onChange={(e) => onStatusChange(e.target.value as Opportunity['status'])}
                className="mt-1.5 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                {OPPORTUNITY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Acquisition Stage</span>
              <select
                value={draft.stage}
                data-testid="editor-stage"
                onChange={(e) => setField('stage', e.target.value as Opportunity['stage'])}
                className="mt-1.5 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                {ACQUISITION_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>}

          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Project name">
                  <input className="field-input" value={draft.projectName} onChange={(e) => setField('projectName', e.target.value)} />
                </Field>
                <Field label="Company Name">
                  <input className="field-input" value={draft.entityName} onChange={(e) => setField('entityName', e.target.value)} />
                </Field>
              </div>
              <LeadTeamFields
                value={{ dealLead: draft.dealLead, primaryLeadId: draft.primaryLeadId, additionalLeadIds: draft.additionalLeadIds }}
                onChange={(team) => {
                  setDraft((prev) => ({ ...prev, dealLead: team.dealLead, primaryLeadId: team.primaryLeadId ?? null, additionalLeadIds: team.additionalLeadIds ?? [] }))
                  setMessage(null)
                }}
              />
              <div className="grid grid-cols-3 gap-3">
                <Field label="NWP">
                  <input type="number" className="field-input" value={draft.nwp} onChange={(e) => setField('nwp', Number(e.target.value))} />
                </Field>
                <Field label="Net Revenue">
                  <input type="number" className="field-input" value={draft.netRevenue} onChange={(e) => setField('netRevenue', Number(e.target.value))} />
                </Field>
                <Field label="PF EBITDA">
                  <input type="number" className="field-input" value={draft.pfEbitda} onChange={(e) => setField('pfEbitda', Number(e.target.value))} />
                </Field>
              </div>
              <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-canvas px-3 py-1.5 text-xs" data-testid="record-dates">
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold tracking-[0.06em] text-ink-subtle uppercase">Created</dt>
                  <dd className="text-ink">
                    <input
                      type="date"
                      className="record-date-input"
                      aria-label="Created date"
                      data-testid="editor-created-date"
                      max={todayDateInput()}
                      value={draft.createdDate ?? ''}
                      onChange={(e) => setField('createdDate', e.target.value || saved.createdDate)}
                    />
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold tracking-[0.06em] text-ink-subtle uppercase">Updated</dt>
                  <dd className="py-0.5 text-ink" data-testid="editor-updated-date">{formatDate(opportunity.updatedAt ?? opportunity.lastActivityDate ?? null)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold tracking-[0.06em] text-ink-subtle uppercase">Legally closed</dt>
                  <dd className="text-ink">
                    {effectiveStatus === 'Completed' ? (
                      <input
                        type="date"
                        className="record-date-input"
                        aria-label="Legally closed date"
                        data-testid="editor-closed-date"
                        min={draft.createdDate ?? undefined}
                        max={todayDateInput()}
                        value={effectiveClosedAt ?? ''}
                        onChange={(e) => setField('closedAt', e.target.value || (effectiveClosedAt ?? null))}
                      />
                    ) : (
                      <span className="block py-0.5" data-testid="editor-closed-date-none" title="Only Completed deals have a legal closing date">—</span>
                    )}
                  </dd>
                </div>
                {opportunity.seedDates && <p className="col-span-3 text-[10px] text-ink-subtle">Dates on this fictional sample deal were filled in for the demo.</p>}
              </dl>
            </>
          )}

          {tab === 'entity' && (
            <>
              <Field label="Opportunity type">
                <select className="field-input" value={draft.type} onChange={(e) => setField('type', e.target.value as Opportunity['type'])}>
                  {OPPORTUNITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Specialty">
                  <input className="field-input" value={draft.specialty} onChange={(e) => setField('specialty', e.target.value)} />
                </Field>
                <Field label="Geography">
                  <input className="field-input" value={draft.geography} onChange={(e) => setField('geography', e.target.value)} />
                </Field>
                <Field label="Source type">
                  <select className="field-input" value={draft.sourceType} onChange={(e) => setField('sourceType', e.target.value as Opportunity['sourceType'])}>
                    {SOURCE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Source name">
                  <input className="field-input" value={draft.sourceName} onChange={(e) => setField('sourceName', e.target.value)} />
                </Field>
              </div>
              {/* Formerly the separate Diligence tab: these two fields are unique, so they live here now. */}
              <Field label="Outstanding diligence items (one per line)">
                <textarea
                  className="field-input min-h-24"
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
                <textarea className="field-input min-h-24" value={draft.diligenceNotes ?? ''} onChange={(e) => setField('diligenceNotes', e.target.value)} placeholder="Where are we in due diligence?" />
              </Field>
            </>
          )}

          {tab === 'actions' && (
            <>
              <p className="rounded-lg border border-border bg-canvas px-3 py-2 text-xs text-ink-muted">
                The Next Action is the earliest-due unfinished task linked to this deal. Editing it here also updates that task; with no open task, saving a next action creates one.
              </p>
              <Field label="Next action">
                <input className="field-input" value={draft.nextAction ?? ''} onChange={(e) => setField('nextAction', e.target.value || null)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Due date">
                  <input type="date" className="field-input" value={draft.nextActionDate ?? ''} onChange={(e) => setField('nextActionDate', e.target.value || null)} />
                </Field>
                <Field label="Priority">
                  <select className="field-input" value={draft.priority} onChange={(e) => setField('priority', e.target.value as Opportunity['priority'])}>
                    <option value="A">A — Must move this week</option>
                    <option value="B">B — Important but can wait</option>
                    <option value="C">C — Monitor only</option>
                  </select>
                </Field>
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-border bg-surface px-5 py-3" data-opp-editor-footer="">
          {error && pendingLeave == null && <p className="mb-2 text-xs text-attention">{error}</p>}
          {message && <p className="mb-2 text-xs text-success">{message}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={saving || deleting || !dirty}
              data-testid="save-opportunity"
              onClick={() => void persist()}
              className={`h-10 w-full rounded-lg text-sm font-semibold disabled:cursor-not-allowed ${
                dirty && !saving ? 'bg-navy-900 text-white hover:bg-navy-800' : 'border border-border bg-white text-ink-muted'
              }`}
            >
              {saveButtonLabel(saving)}
            </button>
            <button
              type="button"
              disabled={saving || deleting}
              onClick={() => setConfirmDelete(true)}
              className="h-10 w-full rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-bg)] text-sm font-semibold text-[var(--color-danger)] disabled:opacity-60"
            >
              Delete Opportunity
            </button>
            {footerExtra && <div className="col-span-2">{footerExtra}</div>}
          </div>
        </div>

        <CompletionConfirmDialog
          open={completionPrompt}
          projectName={draft.projectName || opportunity.projectName}
          initialDate={opportunity.closedAt ?? null}
          onCancel={() => setCompletionPrompt(false)}
          onConfirm={(closedAt) => {
            setCompletionPrompt(false)
            setDraft((prev) => ({ ...prev, status: 'Completed', stage: 'Closing', closedAt }))
            setMessage(null)
          }}
        />

        <UnsavedChangesDialog
          open={pendingLeave != null}
          saving={saving}
          error={error}
          recordLabel="opportunity"
          onSave={() => void handleDialogSave()}
          onDiscard={handleDialogDiscard}
          onCancel={handleDialogCancel}
        />

        <ConfirmDialog
          open={confirmDelete}
          title="Delete Opportunity?"
          message={`Are you sure you want to delete this opportunity? This action may affect associated tasks, documents, and activity records.${
            linkedTaskCount || linkedDocCount
              ? ` ${linkedTaskCount} linked task${linkedTaskCount === 1 ? '' : 's'} will be unlinked (not deleted). ${linkedDocCount} document reference${linkedDocCount === 1 ? '' : 's'} will be removed from the CRM; external files are not deleted.`
              : ''
          }`}
          confirmLabel="Delete Opportunity"
          confirming={deleting}
          onCancel={() => {
            if (!deleting) setConfirmDelete(false)
          }}
          onConfirm={() => {
            if (deletingRef.current) return
            deletingRef.current = true
            setDeleting(true)
            void deleteOpportunity(opportunity.id)
              .then(() => {
                setConfirmDelete(false)
                onDeleted?.()
                onClose?.()
              })
              .catch((err) => {
                deletingRef.current = false
                setDeleting(false)
                setError(err instanceof Error ? err.message : 'Delete failed')
              })
          }}
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
        .record-date-input {
          display: block;
          width: 100%;
          max-width: 9.5rem;
          margin-left: -0.25rem;
          padding: 0.0625rem 0.25rem;
          border: 1px solid transparent;
          border-radius: 0.375rem;
          background: transparent;
          font-size: 0.75rem;
          color: var(--color-ink);
          cursor: pointer;
        }
        .record-date-input:hover { border-color: var(--color-border); background: var(--color-surface); }
        .record-date-input:focus { outline: none; border-color: var(--color-accent); background: var(--color-surface); box-shadow: 0 0 0 2px rgb(61 126 184 / 0.2); }
        /* Short laptop screens (1366x768, 1280x720): tighten spacing so the
           Overview tab fits without scrolling. Content is unchanged. */
        @media (max-height: 860px) {
          [data-opp-editor] [data-testid="drawer-header"] { padding-top: 0.5rem; padding-bottom: 0.5rem; }
          [data-opp-editor] [data-testid="drawer-header"] h2 { font-size: 1.125rem; }
          [data-opp-editor] [data-testid="drawer-header"] > div + div { margin-top: 0.5rem; }
          [data-opp-editor] [data-testid="drawer-header"] dl { row-gap: 0.25rem; }
          [data-opp-editor] [data-opp-editor-tabs] > button { padding-top: 0.25rem; padding-bottom: 0.25rem; }
          [data-opp-editor] [data-opp-editor-body] { padding-top: 0.5rem; padding-bottom: 0.5rem; }
          [data-opp-editor] [data-opp-editor-body] .gap-3 { gap: 0.5rem; }
          [data-opp-editor] [data-opp-editor-body] select.h-10 { height: 2.25rem; margin-top: 0.2rem; }
          [data-opp-editor] .field-input { margin-top: 0.2rem; }
          [data-opp-editor] input.field-input, [data-opp-editor] select.field-input { height: 2.25rem; }
          [data-opp-editor] [data-opp-editor-footer] { padding-top: 0.375rem; padding-bottom: 0.375rem; }
          [data-opp-editor] [data-opp-editor-footer] .gap-2 { gap: 0.375rem; }
          [data-opp-editor] [data-opp-editor-body] > .py-2 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
          [data-opp-editor] [data-opp-editor-body] > :not(:last-child) { margin-bottom: 0.4375rem; }
          [data-opp-editor] [data-opp-editor-footer] button.h-10 { height: 2.25rem; }
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
