import type { TaskRecord } from '@/data/mockModules'
import { dueDateSortValue, isOverdueDate } from '@/lib/calendarDate'
import { isActiveListTask, isUnfinishedTask } from '@/lib/taskLifecycle'

function priorityIndex(value: string | null | undefined): number {
  if (value === 'A') return 0
  if (value === 'B') return 1
  return 2
}

/** Overdue A/B/C, then non-overdue A/B/C. Undated after dated in the non-overdue group. */
export function compareVisibleTasks(a: TaskRecord, b: TaskRecord, now = new Date()): number {
  const aUnfinished = isUnfinishedTask(a, now)
  const bUnfinished = isUnfinishedTask(b, now)
  if (aUnfinished !== bUnfinished) return aUnfinished ? -1 : 1

  if (aUnfinished) {
    const aOverdue = isOverdueDate(a.dueDate, now)
    const bOverdue = isOverdueDate(b.dueDate, now)
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1
    const byPriority = priorityIndex(a.priority) - priorityIndex(b.priority)
    if (byPriority !== 0) return byPriority
    const byDate = dueDateSortValue(a.dueDate, now) - dueDateSortValue(b.dueDate, now)
    if (byDate !== 0) return byDate
    return (a.action || '').localeCompare(b.action || '')
  }

  const byDate = dueDateSortValue(a.dueDate, now) - dueDateSortValue(b.dueDate, now)
  if (byDate !== 0) return byDate
  return (a.action || '').localeCompare(b.action || '')
}

export function sortVisibleTasks(tasks: TaskRecord[], now = new Date()): TaskRecord[] {
  return [...tasks].sort((a, b) => compareVisibleTasks(a, b, now))
}

export function rankWeekPriorityTasks(tasks: TaskRecord[], now = new Date()): TaskRecord[] {
  return sortVisibleTasks(
    tasks.filter((task) => isActiveListTask(task, now) && isUnfinishedTask(task, now)),
    now,
  )
}

export function isOverdueUnfinishedTask(task: TaskRecord, now = new Date()): boolean {
  return isUnfinishedTask(task, now) && isOverdueDate(task.dueDate, now)
}

export function isOnTrackTask(task: TaskRecord, now = new Date()): boolean {
  return isUnfinishedTask(task, now) && !isOverdueDate(task.dueDate, now)
}

/**
 * The one overdue-task selector. The Tasks page Overdue pill, the bell, the dashboard and the
 * audit all read this list, so their counts always match. It counts TASKS, not deals.
 */
export function overdueTaskList(tasks: TaskRecord[], now = new Date()): TaskRecord[] {
  return sortVisibleTasks(
    tasks.filter((task) => isActiveListTask(task, now) && isOverdueUnfinishedTask(task, now)),
    now,
  )
}
