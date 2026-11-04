import type { TaskRecord } from '@/data/mockModules'
import { formatDate } from '@/utils/dashboard'
import { daysOverdue } from '@/lib/attention'
import { isOverdueDate } from '@/lib/calendarDate'
import { priorityChipClass } from '@/lib/priorityStyles'
import { WarningTriangle } from '@/components/shared/WarningTriangle'
import { taskWarning } from '@/lib/taskWarning'

interface PriorityTasksProps {
  tasks: TaskRecord[]
  onProjectClick?: (projectId: string) => void
  onViewAll?: () => void
}

/** Up to six working tasks (same eligibility as Tasks & Follow-Ups), most urgent first. */
export function PriorityTasks({ tasks, onProjectClick, onViewAll }: PriorityTasksProps) {
  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-surface shadow-(--shadow-card)" data-testid="week-priorities">
      <div className="flex items-start justify-between gap-2 border-b border-border px-5 py-3.5">
        <div>
          <h2 className="font-brand text-lg font-bold text-navy-900">This Week&apos;s Priorities</h2>
          <p className="mt-0.5 text-sm text-ink-muted">A must move · B important · C monitor</p>
        </div>
        {onViewAll && (
          <button type="button" onClick={onViewAll} className="text-xs font-semibold text-accent hover:underline">
            View all
          </button>
        )}
      </div>
      <ul className="divide-y divide-border/70">
        {tasks.length === 0 && <li className="px-5 py-8 text-sm text-ink-muted">No open tasks on Active or Pending deals.</li>}
        {tasks.map((task) => {
          const overdue = isOverdueDate(task.dueDate)
          const days = overdue ? daysOverdue(task.dueDate) : 0
          return (
            <li key={task.id}>
              <button type="button" disabled={!task.opportunityId} onClick={() => task.opportunityId && onProjectClick?.(task.opportunityId)} className="flex w-full items-start gap-3 px-5 py-3 text-left enabled:hover:bg-accent-soft/30">
                <span className={`mt-0.5 ${priorityChipClass(task.priority)}`}>{task.priority}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink" title={task.action}>{task.action}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-muted">
                    <span className="font-medium text-accent">{task.projectName || 'No project'}</span> · {task.owner || 'Unassigned'}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-ink-muted">
                  <span className="inline-flex items-center gap-1">
                    {formatDate(task.dueDate)}
                    <WarningTriangle warning={taskWarning(task)} />
                  </span>
                  {overdue && days > 0 && <span className="block text-[11px] font-medium text-[#b4554a]" data-testid="days-overdue">{days} day{days === 1 ? '' : 's'} overdue</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
