import { useEffect, useMemo, useState } from 'react'
import type { TaskRecord } from '@/data/mockModules'
import { TASK_STATUSES } from '@/data/mockModules'
import { useData } from '@/data/DataContext'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'
import { saveButtonLabel, savedMessageLabel } from '@/lib/persistenceMode'
import { dealIdFromOpportunity } from '@/lib/dealId'
import { useEditorGuard, type OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'
import { registerPendingCommit } from '@/lib/userVault'
import { DrawerHeader, ModalHeader } from '@/components/shared/Overlay'
import { taskWarning } from '@/lib/taskWarning'
import { isHistoryTask, isPausedTask } from '@/lib/taskLifecycle'
import { taskOwnerOptions } from '@/lib/dealLeads'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { forwardRef, useCallback, useImperativeHandle, useRef, type ReactNode } from 'react'

export type TaskDraft = {
  action: string
  priority: string
  opportunityId: string | null
  ownerId: string | null
  dueDate: string
  status: string
  notes: string
}

export function emptyTaskDraft(): TaskDraft {
  return {
    action: '',
    priority: 'B',
    opportunityId: null,
    ownerId: null,
    dueDate: '',
    status: 'Open',
    notes: '',
  }
}

export function snapshotTask(task: TaskRecord): TaskDraft {
  return {
    action: task.action ?? '',
    priority: task.priority ?? 'B',
    opportunityId: task.opportunityId,
    ownerId: task.ownerId ?? null,
    dueDate: task.dueDate ?? '',
    status: task.status ?? 'Open',
    notes: task.notes ?? '',
  }
}

interface TaskEditorProps {
  mode: 'existing' | 'draft'
  task?: TaskRecord | null
  draftSeed?: TaskDraft
  onClose: () => void
  onSaved?: (task: TaskRecord) => void
  onDeleted?: () => void
  /** Shown at the very bottom, below Delete Task (for example the profile link). */
  footerExtra?: ReactNode
  /** Timing stated in a meeting transcript, shown as a suggestion beside the due date. */
  dueHint?: string
}

export const TaskEditor = forwardRef<OpportunityEditorHandle, TaskEditorProps>(
  function TaskEditor({ mode, task, draftSeed, onClose, onSaved, onDeleted, footerExtra, dueHint }, ref) {
    const { opportunities, dealLeads, saveTask, createTask, deleteTask, restoreTask } = useData()
    const guard = useEditorGuard()
    const [draft, setDraft] = useState<TaskDraft>(
      () => draftSeed ?? (task ? snapshotTask(task) : emptyTaskDraft()),
    )
    const [saved, setSaved] = useState<TaskDraft>(
      () => draftSeed ?? (task ? snapshotTask(task) : emptyTaskDraft()),
    )
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [doneAsk, setDoneAsk] = useState(false)
    const inHistory = mode === 'existing' && task ? isHistoryTask(task) : false
    const savingRef = useRef(false)

    useEffect(() => {
      const next = draftSeed ?? (task ? snapshotTask(task) : emptyTaskDraft())
      setDraft(next)
      setSaved(next)
      setError(null)
      setMessage(null)
      setPendingLeave(null)
    }, [task?.id, mode])

    const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
    const [showErrors, setShowErrors] = useState(false)
    const problems = {
      action: draft.action.trim() ? null : 'Enter the action.',
      project: mode === 'draft' && !opportunities.some((o) => o.id === draft.opportunityId) ? 'Choose the linked project. Every new task belongs to a project.' : null,
      due: mode === 'draft' && !draft.dueDate ? 'Choose a due date.' : null,
    }
    const valid = !problems.action && !problems.project && !problems.due
    const canSave = dirty && !saving

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

    useImperativeHandle(ref, () => ({ isDirty: () => dirty, requestLeave }), [dirty, requestLeave])

    useEffect(() => {
      guard?.register({ isDirty: () => dirty, requestLeave })
      return () => guard?.register(null)
    }, [dirty, requestLeave, guard])

    const projectOptions = useMemo(
      () =>
        opportunities.map((o) => ({
          id: o.id,
          label: o.projectName,
          detail: `${dealIdFromOpportunity(o)} · ${o.entityName}`,
        })),
      [opportunities],
    )
    // New owners come from Active Deal Leads only. An old owner stays visible until someone changes it.
    const ownerOptions = useMemo(() => taskOwnerOptions(dealLeads, task ?? null), [dealLeads, task])
    const legacyOwnerValue = !draft.ownerId && task?.owner?.trim() ? `legacy:${task.owner.trim()}` : null
    const linked = opportunities.find((o) => o.id === draft.opportunityId) ?? null

    const persist = async (): Promise<boolean> => {
      if (savingRef.current) return false
      if (!valid) {
        setShowErrors(true)
        setError(null)
        return false
      }
      savingRef.current = true
      setSaving(true)
      setError(null)
      try {
        const payload = {
          action: draft.action.trim(),
          priority: draft.priority,
          opportunityId: draft.opportunityId,
          ownerId: draft.ownerId,
          dueDate: draft.dueDate || null,
          status: draft.status,
          notes: draft.notes,
        }
        const result =
          mode === 'draft' || !task
            ? await createTask(payload)
            : await saveTask(task.id, payload)
        setSaved(snapshotTask(result))
        setDraft(snapshotTask(result))
        setMessage(savedMessageLabel())
        onSaved?.(result)
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
        return false
      } finally {
        savingRef.current = false
        setSaving(false)
      }
    }

    const persistRef = useRef(persist)
    persistRef.current = persist
    const taskDirtyRef = useRef(dirty)
    taskDirtyRef.current = dirty
    useEffect(() => {
      return registerPendingCommit(async () => {
        if (!taskDirtyRef.current) return
        await persistRef.current()
      })
    }, [])

    const handleDelete = async () => {
      if (mode === 'draft' || !task) {
        onDeleted?.()
        onClose()
        return
      }
      await deleteTask(task.id)
      onDeleted?.()
      onClose()
    }

    const liveTask = task ? { ...task, dueDate: draft.dueDate || null, status: draft.status } : null
    const warning = mode === 'existing' && liveTask ? taskWarning(liveTask) : null
    const paused = mode === 'existing' && task ? isPausedTask(task, opportunities) : false
    const field = 'mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20'

    return (
      <div className="flex h-full min-h-0 flex-col">
        {mode === 'draft' ? (
          <ModalHeader
            eyebrow="Unsaved draft"
            title="New Task"
            subtitle={[linked?.projectName, linked?.entityName].filter(Boolean).join(' · ') || 'Link the task to a project'}
            onClose={() => requestLeave(onClose)}
            closeLabel="Close task editor"
          />
        ) : (
          <DrawerHeader
            eyebrow={linked ? `${dealIdFromOpportunity(linked)} · Task` : 'Task'}
            title={draft.action.trim() || 'Task'}
            subtitle={[linked?.projectName, linked?.entityName].filter(Boolean).join(' · ') || 'No project linked'}
            onClose={() => requestLeave(onClose)}
            closeLabel="Close task editor"
          >
            {(warning || paused) && (
              <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${paused ? 'bg-white/10 text-white' : warning?.level === 'red' ? 'bg-[#fde8e6] text-[var(--color-danger)]' : 'bg-accent-soft text-navy-900'}`} data-testid="task-drawer-warning">
                {paused ? `Paused — the parent deal is ${linked?.status}. It stays open here and returns to Tasks if the deal becomes Active, Pending or Completed.` : warning?.detail}
              </div>
            )}
          </DrawerHeader>
        )}

        <div className="custom-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Status</span>
            <select
              className={field}
              value={draft.status}
              data-testid="task-editor-status"
              disabled={inHistory}
              onChange={(e) => {
                // Completing is confirmed first, and moves the task out of the live lists at once.
                if (e.target.value === 'Done' && mode !== 'draft') setDoneAsk(true)
                else setDraft((p) => ({ ...p, status: e.target.value }))
              }}
            >
              {TASK_STATUSES.filter((s) => mode !== 'draft' || s !== 'Done').map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Action *</span>
            <input className={field} value={draft.action} onChange={(e) => setDraft((p) => ({ ...p, action: e.target.value }))} data-testid="task-action" />
            {showErrors && problems.action && <span className="mt-1 block text-xs font-medium tracking-normal text-attention normal-case" data-testid="task-action-error">{problems.action}</span>}
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">{mode === 'draft' ? 'Linked Project *' : 'Project'}</span>
            <SearchSelect value={draft.opportunityId} options={projectOptions} onChange={(id) => setDraft((p) => ({ ...p, opportunityId: id }))} placeholder="Search projects" emptyText="No matching projects" />
            {showErrors && problems.project && <span className="mt-1 block text-xs font-medium tracking-normal text-attention normal-case" data-testid="task-project-error">{problems.project}</span>}
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Company</span>
            <input className={`${field} bg-canvas text-ink-muted`} value={linked?.entityName ?? 'Derived from the linked project'} readOnly />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Due Date{mode === 'draft' ? ' *' : ''}</span>
            <input type="date" className={field} value={draft.dueDate} onChange={(e) => setDraft((p) => ({ ...p, dueDate: e.target.value }))} data-testid="task-due" />
            {showErrors && problems.due && <span className="mt-1 block text-xs font-medium tracking-normal text-attention normal-case" data-testid="task-due-error">{problems.due}</span>}
            {dueHint && <span className="mt-1 block text-[11px] text-ink-muted">Suggestion from the transcript: “{dueHint}”. Not an agreed date — set the due date you want.</span>}
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Priority</span>
            <select className={field} value={draft.priority} onChange={(e) => setDraft((p) => ({ ...p, priority: e.target.value }))}>
              <option value="A">A — Must move this week</option>
              <option value="B">B — Important but can wait</option>
              <option value="C">C — Monitor only</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Owner</span>
            <SearchSelect value={draft.ownerId ?? legacyOwnerValue} options={ownerOptions} emptyText="No active Deal Leads. Add one on the Deal Leads page." onChange={(id) => setDraft((p) => ({ ...p, ownerId: id?.startsWith('legacy:') ? null : id }))} placeholder="Select an active Deal Lead" />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Notes</span>
            <textarea className="mt-1.5 min-h-24 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" value={draft.notes} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} />
          </label>
        </div>

        <div className="shrink-0 space-y-2 border-t border-border bg-surface px-5 py-3">
          {error && <p className="text-xs text-attention">{error}</p>}
          {message && <p className="text-xs text-success">{message}</p>}
          {dirty && !valid && !showErrors && <p className="text-xs text-ink-muted">{mode === 'draft' ? 'Action, Linked Project and Due Date are required.' : 'Add an action to save this task.'}</p>}
          <button
            type="button"
            data-testid="task-save"
            disabled={!canSave}
            onClick={() => void persist()}
            className={`h-10 w-full rounded-lg text-sm font-semibold disabled:cursor-not-allowed ${
              canSave ? 'bg-navy-900 text-white hover:bg-navy-800' : 'border border-border bg-white text-ink-muted'
            }`}
          >
            {saveButtonLabel(saving)}
          </button>
          {inHistory && task && !task.deletedAt && (
            <button
              type="button"
              data-testid="task-editor-restore"
              disabled={saving}
              onClick={() => {
                setError(null)
                void restoreTask(task.id)
                  .then((restored) => {
                    const snap = snapshotTask(restored)
                    setSaved(snap)
                    setDraft(snap)
                    setMessage('Restored to Open.')
                  })
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Restore failed'))
              }}
              className="h-10 w-full rounded-lg border border-border bg-surface text-sm font-semibold text-navy-900 hover:bg-canvas"
            >
              Restore to Open
            </button>
          )}
          {mode !== 'draft' && (
            <button
              type="button"
              data-testid="task-delete"
              disabled={saving}
              onClick={() => setConfirmDelete(true)}
              className="h-10 w-full rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-bg)] text-sm font-semibold text-[var(--color-danger)] disabled:opacity-60"
            >
              Delete Task
            </button>
          )}
          {footerExtra}
        </div>

        <ConfirmDialog
          open={doneAsk}
          title="Mark this task as completed and move it to Task History?"
          message={draft.action}
          confirmLabel="Complete Task"
          tone="default"
          onCancel={() => setDoneAsk(false)}
          onConfirm={() => {
            setDoneAsk(false)
            if (!task) return
            setSaving(true)
            setError(null)
            void saveTask(task.id, {
              action: draft.action.trim() || task.action,
              priority: draft.priority,
              opportunityId: draft.opportunityId,
              ownerId: draft.ownerId,
              dueDate: draft.dueDate || null,
              notes: draft.notes,
              status: 'Done',
            })
              .then((result) => {
                const snap = snapshotTask(result)
                setSaved(snap)
                setDraft(snap)
                onSaved?.(result)
                onClose()
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Save failed'))
              .finally(() => setSaving(false))
          }}
        />

        <UnsavedChangesDialog
          open={pendingLeave != null}
          saving={saving}
          error={error}
          recordLabel="task"
          onSave={() =>
            void persist().then((ok) => {
              if (!ok) return
              const next = pendingLeave
              setPendingLeave(null)
              next?.()
            })
          }
          onDiscard={() => {
            const next = pendingLeave
            setPendingLeave(null)
            next?.()
          }}
          onCancel={() => setPendingLeave(null)}
        />

        {confirmDelete && (
          <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-navy-950/45"
              onClick={() => setConfirmDelete(false)}
            />
            <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-5">
              <h3 className="font-brand text-xl font-bold text-navy-900">Delete this task?</h3>
              <p className="mt-2 text-sm text-ink-muted">
                {mode === 'draft'
                  ? 'This unsaved draft will be discarded. No task record will be created.'
                  : 'This removes the task from the active list and Task History. This is not archive.'}
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  className="h-10 rounded-lg bg-[var(--color-danger)] text-sm font-semibold text-white"
                  onClick={() => void handleDelete()}
                >
                  {mode === 'draft' ? 'Discard draft' : 'Delete Task'}
                </button>
                <button
                  type="button"
                  className="h-10 rounded-lg text-sm font-semibold text-ink-muted"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  },
)
