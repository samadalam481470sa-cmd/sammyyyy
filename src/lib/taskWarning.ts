import type { TaskRecord } from '@/data/mockModules'
import type { DealWarning } from '@/lib/attention'
import { isWithinNextDays } from '@/lib/calendarDate'
import { formatDate } from '@/utils/dashboard'
import { isOverdueUnfinishedTask } from '@/lib/taskSort'
import { isUnfinishedTask } from '@/lib/taskLifecycle'

/**
 * Task row warning: red when an unfinished task is overdue, navy when it is due today or within
 * the next seven calendar days. None for done, archived, undated, or later tasks.
 */
export function taskWarning(task: TaskRecord, now = new Date()): DealWarning | null {
  if (task.archivedAt || task.deletedAt || task.status === 'Done') return null
  if (isOverdueUnfinishedTask(task, now)) {
    return { level: 'red', reason: 'Next action overdue', detail: `${task.action || 'Task'} was due ${formatDate(task.dueDate)}` }
  }
  if (isUnfinishedTask(task, now) && isWithinNextDays(task.dueDate, 7, now)) {
    return { level: 'navy', reason: 'Upcoming deadline within 7 days', detail: `${task.action || 'Task'} is due ${formatDate(task.dueDate)}` }
  }
  return null
}
