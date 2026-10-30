import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { TaskRecord } from '@/data/mockModules'
import { TASK_STATUSES } from '@/data/mockModules'
import { useData } from '@/data/DataContext'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'
import { saveButtonLabel, savedMessageLabel } from '@/lib/persistenceMode'
import { dealIdFromOpportunity } from '@/lib/dealId'
import { useEditorGuard, type OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'
import { registerPendingCommit } from '@/lib/userVault'
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
}

export const TaskEditor = forwardRef<OpportunityEditorHandle, TaskEditorProps>(
  function TaskEditor({ mode, task, draftSeed, onClose, onSaved, onDeleted, footerExtra }, ref) {
    const { opportunities, users, saveTask, createTask, deleteTask } = useData()
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
    const valid = draft.action.trim().length > 0
    const canSave = dirty && valid && !saving

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
    const ownerOptions = useMemo(
      () => users.map((u) => ({ id: u.id, label: u.name })),
      [users],
    )
    const linked = opportunities.find((o) => o.id === draft.opportunityId) ?? null

    const persist = async (): Promise<boolean> => {
      if (savingRef.current) return false
      if (!draft.action.trim()) {
        setError('Action is required')
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

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-accent uppercase">
              {mode === 'draft' ? 'Unsaved draft' : 'Task'}
            </p>
            <h2 className="mt-1 font-brand text-xl font-bold text-navy-900">
              {mode === 'draft' ? 'New Task' : draft.action.trim() || 'Task'}
            </h2>
            <p className="text-sm text-ink-muted">
              {[linked?.projectName, linked?.entityName].filter(Boolean).join(' · ') || 'No project linked'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => requestLeave(onClose)}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas"
            aria-label="Close task editor"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="custom-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
              Status
            </span>
            <select
              className="mt-1.5 h-10 w-full rounded-lg border border-border px-3 text-sm"
              value={draft.status}
              onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
              Action
            </span>
            <input
              className="mt-1.5 h-10 w-full rounded-lg border border-border px-3 text-sm"
              value={draft.action}
              onChange={(e) => setDraft((p) => ({ ...p, action: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
              Priority
            </span>
            <select
              className="mt-1.5 h-10 w-full rounded-lg border border-border px-3 text-sm"
              value={draft.priority}
              onChange={(e) => setDraft((p) => ({ ...p, priority: e.target.value }))}
            >
              <option value="A">A — Must move this week</option>
              <option value="B">B — Important but can wait</option>
              <option value="C">C — Monitor only</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
              Project
            </span>
            <SearchSelect
              value={draft.opportunityId}
              options={projectOptions}
              onChange={(id) => setDraft((p) => ({ ...p, opportunityId: id }))}
              placeholder="Search opportunities"
              emptyText="No matching opportunities"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
              Company
            </span>
            <input
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-ink-muted"
              value={linked?.entityName ?? 'Derived from the linked project'}
              readOnly
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
              Owner
            </span>
            <SearchSelect
              value={draft.ownerId}
              options={ownerOptions}
              onChange={(id) => setDraft((p) => ({ ...p, ownerId: id }))}
              placeholder="Select an authorized user"
              emptyText="No matching users"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
              Due date
            </span>
            <input
              type="date"
              className="mt-1.5 h-10 w-full rounded-lg border border-border px-3 text-sm"
              value={draft.dueDate}
              onChange={(e) => setDraft((p) => ({ ...p, dueDate: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
              Notes
            </span>
            <textarea
              className="mt-1.5 min-h-24 w-full rounded-lg border border-border px-3 py-2 text-sm"
              value={draft.notes}
              onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
            />
          </label>
        </div>

        <div className="shrink-0 space-y-2 border-t border-border bg-canvas px-5 py-3">
          {error && <p className="text-xs text-attention">{error}</p>}
          {message && <p className="text-xs text-success">{message}</p>}
          {dirty && !valid && <p className="text-xs text-ink-muted">Add an action to save this task.</p>}
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
