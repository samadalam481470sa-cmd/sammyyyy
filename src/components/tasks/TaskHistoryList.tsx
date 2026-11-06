import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useData } from '@/data/DataContext'
import type { TaskRecord } from '@/data/mockModules'
import { inPeriod, resolvePeriod, type PeriodFilter } from '@/lib/reports'
import { WORKING_DEAL_STATUSES, taskHistoryDate, taskHistoryKind, type TaskHistoryKind } from '@/lib/taskLifecycle'
import { priorityChipClass } from '@/lib/priorityStyles'
import { formatDate } from '@/utils/dashboard'

export interface TaskHistoryRow {
  task: TaskRecord
  kind: TaskHistoryKind
  at: string | null
  entity: string
}

export const HISTORY_KIND_STYLE: Record<TaskHistoryKind, string> = {
  Completed: 'border-[#bfe0cf] bg-success-bg text-success',
  Archived: 'border-border bg-canvas text-ink-muted',
  'Cancelled/Deleted': 'border-[#f3c4bf] bg-[#fdecea] text-[#a8321f]',
}

/** Completed, archived and deleted tasks in the period, newest first. Older records stay reachable by date. */
export function useTaskHistoryRows(period: PeriodFilter): TaskHistoryRow[] {
  const { tasks, opportunities } = useData()
  return useMemo(() => {
    const resolved = resolvePeriod(period)
    return tasks
      .map((task) => ({ task, kind: taskHistoryKind(task), at: taskHistoryDate(task) }))
      .filter((row): row is { task: TaskRecord; kind: TaskHistoryKind; at: string | null } => row.kind != null)
      .filter((row) => inPeriod(row.at, resolved))
      .map((row) => ({ ...row, entity: opportunities.find((o) => o.id === row.task.opportunityId)?.entityName ?? '—' }))
      .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
  }, [tasks, opportunities, period])
}

/** Restore to Open, with a confirmation that says where the task will appear. Deleted tasks are not restored here. */
export function RestoreTaskButton({ task, kind, onRestored }: { task: TaskRecord; kind: TaskHistoryKind; onRestored?: (task: TaskRecord) => void }) {
  const { restoreTask, opportunities } = useData()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (kind === 'Cancelled/Deleted') return null
  const parent = opportunities.find((o) => o.id === task.opportunityId)
  const paused = parent && !WORKING_DEAL_STATUSES.has(parent.status)
  return (
    <>
      <button
        type="button"
        data-testid={`restore-task-${task.id}`}
        onClick={() => setAsking(true)}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[11px] font-semibold text-navy-900 hover:bg-canvas"
      >
        <RotateCcw className="h-3 w-3" /> Restore
      </button>
      {error && <p role="alert" className="mt-1 text-[11px] text-attention">{error}</p>}
      <ConfirmDialog
        open={asking}
        title="Restore this task to Open?"
        message={`${task.action}. ${paused ? `Its deal is ${parent.status}, so it stays on that deal's profile as paused and returns to Tasks when the deal is Active or Pending.` : 'It returns to Tasks & Follow-Ups.'} Its original due date and completion history are kept.`}
        confirmLabel="Restore Task"
        tone="default"
        confirming={busy}
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setBusy(true)
          setError(null)
          void restoreTask(task.id)
            .then((restored) => {
              setAsking(false)
              onRestored?.(restored)
            })
            .catch((err: unknown) => {
              setAsking(false)
              setError(err instanceof Error ? err.message : 'Restore failed')
            })
            .finally(() => setBusy(false))
        }}
      />
    </>
  )
}

/** Compact list used in the Task History drawer. */
export function TaskHistoryList({ rows, onRestored }: { rows: TaskHistoryRow[]; onRestored?: (task: TaskRecord) => void }) {
  if (!rows.length) return <p className="px-5 py-8 text-sm text-ink-muted">No completed, archived or deleted tasks in this period. Choose a wider period to see older records.</p>
  return (
    <ul className="divide-y divide-border" data-testid="task-history-list">
      {rows.map(({ task, kind, at, entity }) => (
        <li key={task.id} className="flex items-start gap-3 px-5 py-3">
          <span className={priorityChipClass(task.priority)}>{task.priority}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-navy-900" title={task.action}>{task.action}</p>
            <p className="truncate text-xs text-ink-muted">
              {task.projectName || 'Unlinked'} · {entity} · {task.owner || 'Unassigned'}
            </p>
            <p className="text-[11px] text-ink-subtle">
              Due {formatDate(task.initialDueDate ?? task.dueDate)}
              {task.initialDueDate && task.dueDate && task.initialDueDate !== task.dueDate ? ` (moved to ${formatDate(task.dueDate)})` : ''} · {kind} {formatDate(at)}
              {task.restoreHistory?.length ? ` · restored ${task.restoreHistory.length} time${task.restoreHistory.length === 1 ? '' : 's'} before` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${HISTORY_KIND_STYLE[kind]}`}>{kind}</span>
            <RestoreTaskButton task={task} kind={kind} onRestored={onRestored} />
          </div>
        </li>
      ))}
    </ul>
  )
}
