import { useMemo } from 'react'
import { useData } from '@/data/DataContext'
import type { TaskRecord } from '@/data/mockModules'
import { inPeriod, resolvePeriod, type PeriodFilter } from '@/lib/reports'
import { taskHistoryDate, taskHistoryKind, type TaskHistoryKind } from '@/lib/taskLifecycle'
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

/** Compact list used in the Task History drawer. */
export function TaskHistoryList({ rows }: { rows: TaskHistoryRow[] }) {
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
            </p>
          </div>
          <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${HISTORY_KIND_STYLE[kind]}`}>{kind}</span>
        </li>
      ))}
    </ul>
  )
}
