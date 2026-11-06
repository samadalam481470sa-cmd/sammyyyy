import type { TaskRecord } from '@/data/mockModules'
import { dueDateSortValue, isOverdueDate, isWithinNextDays } from '@/lib/calendarDate'
import { isActiveListTask, isUnfinishedTask, isWorkingTask } from '@/lib/taskLifecycle'

function priorityIndex(value: string | null | undefined): number {
  if (value === 'A') return 0
  if (value === 'B') return 1
  return 2
}

/**
 * Warning tier of a task: 0 overdue (red), 1 due today or within 7 days (blue), 2 no warning,
 * 3 not unfinished (a Done task waiting to be archived).
 */
export function taskSortTier(task: TaskRecord, now = new Date()): number {
  if (!isUnfinishedTask(task)) return 3
  if (isOverdueDate(task.dueDate, now)) return 0
  if (isWithinNextDays(task.dueDate, 7, now)) return 1
  return 2
}

/**
 * The one task order, shared by Tasks & Follow-Ups and This Week's Priorities:
 * warning tier first, then A/B/C inside the tier, then nearest due date (oldest first when
 * overdue). A priority C overdue task beats every blue warning; a priority B task due tomorrow
 * beats a priority A task due in a month. Undated tasks come last inside their priority.
 */
export function compareVisibleTasks(a: TaskRecord, b: TaskRecord, now = new Date()): number {
  const tierA = taskSortTier(a, now)
  const tierB = taskSortTier(b, now)
  if (tierA !== tierB) return tierA - tierB
  if (tierA === 3) {
    const byDate = dueDateSortValue(a.dueDate, now) - dueDateSortValue(b.dueDate, now)
    if (Number.isFinite(byDate) && byDate !== 0) return byDate
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  }
  const byPriority = priorityIndex(a.priority) - priorityIndex(b.priority)
  if (byPriority !== 0) return byPriority
  const ad = dueDateSortValue(a.dueDate, now)
  const bd = dueDateSortValue(b.dueDate, now)
  if (ad !== bd) {
    if (!Number.isFinite(ad)) return 1
    if (!Number.isFinite(bd)) return -1
    return ad - bd
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function sortVisibleTasks(tasks: TaskRecord[], now = new Date()): TaskRecord[] {
  return [...tasks].sort((a, b) => compareVisibleTasks(a, b, now))
}

/** Shared working-task eligibility: pass the opportunities so paused tasks (inactive deals) drop out. */
type Parents = ReadonlyArray<{ id: string; status: string }> | undefined

export function rankWeekPriorityTasks(tasks: TaskRecord[], now = new Date(), opportunities?: Parents): TaskRecord[] {
  return sortVisibleTasks(
    tasks.filter((task) => isActiveListTask(task) && (opportunities ? isWorkingTask(task, opportunities) : isUnfinishedTask(task))),
    now,
  )
}

export function isOverdueUnfinishedTask(task: TaskRecord, now = new Date()): boolean {
  return isUnfinishedTask(task) && isOverdueDate(task.dueDate, now)
}

export function isOnTrackTask(task: TaskRecord, now = new Date()): boolean {
  return isUnfinishedTask(task) && !isOverdueDate(task.dueDate, now)
}

/**
 * The one overdue-task selector. The Tasks page Overdue pill, the bell, the dashboard and the
 * audit all read this list, so their counts always match. It counts TASKS, not deals.
 */
export function overdueTaskList(tasks: TaskRecord[], now = new Date(), opportunities?: Parents): TaskRecord[] {
  return sortVisibleTasks(
    tasks.filter((task) => isActiveListTask(task) && isOverdueUnfinishedTask(task, now) && (!opportunities || isWorkingTask(task, opportunities))),
    now,
  )
}
