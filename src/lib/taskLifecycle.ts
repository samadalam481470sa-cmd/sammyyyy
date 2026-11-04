import type { TaskRecord } from '@/data/mockModules'
import { BASE_CRM_USERS, findCrmUserByName, type CrmUser } from '@/lib/crmUsers'
import { nowIso, shouldAutoArchive } from '@/lib/calendarDate'

export const UNFINISHED_TASK_STATUSES = new Set(['Open', 'In Progress'])

export function isDeletedTask(task: TaskRecord): boolean {
  return Boolean(task.deletedAt)
}

export function isUnfinishedTask(task: TaskRecord, now = new Date()): boolean {
  if (isDeletedTask(task) || task.archivedAt) return false
  if (task.status === 'Done' && shouldAutoArchive(task.completedAt, now)) return false
  return UNFINISHED_TASK_STATUSES.has(task.status)
}

export function isHistoryTask(task: TaskRecord, now = new Date()): boolean {
  if (isDeletedTask(task)) return false
  if (task.archivedAt) return true
  return task.status === 'Done' && shouldAutoArchive(task.completedAt, now)
}

export function isActiveListTask(task: TaskRecord, now = new Date()): boolean {
  return !isDeletedTask(task) && !isHistoryTask(task, now)
}

export function migrateTaskRecord(task: TaskRecord, users: CrmUser[] = BASE_CRM_USERS): TaskRecord {
  const ownerId = task.ownerId ?? findCrmUserByName(task.owner, users)?.id ?? null
  const completedAt =
    task.status === 'Done' ? (task.completedAt ?? task.updatedAt ?? task.createdAt ?? null) : null
  return {
    ...task,
    ownerId,
    completedAt,
    archivedAt: task.archivedAt ?? null,
    deletedAt: task.deletedAt ?? null,
  }
}

export function applyTaskArchiveRules(tasks: TaskRecord[], now = new Date()): {
  tasks: TaskRecord[]
  changed: boolean
} {
  let changed = false
  const next = tasks.map((task) => {
    const migrated = migrateTaskRecord(task)
    if (migrated.status !== 'Done' || migrated.archivedAt || migrated.deletedAt) {
      if (migrated !== task) changed = true
      return migrated
    }
    if (shouldAutoArchive(migrated.completedAt, now)) {
      changed = true
      return { ...migrated, archivedAt: nowIso(now), updatedAt: nowIso(now) }
    }
    if (migrated !== task) changed = true
    return migrated
  })
  return { tasks: next, changed }
}

export function applyTaskStatusTransition(
  task: TaskRecord,
  status: string,
  now = new Date(),
): TaskRecord {
  const stamp = nowIso(now)
  if (status === 'Done') {
    return {
      ...task,
      status,
      completedAt: task.completedAt ?? stamp,
      archivedAt: task.archivedAt ?? null,
      updatedAt: stamp,
    }
  }
  return {
    ...task,
    status,
    completedAt: null,
    archivedAt: null,
    updatedAt: stamp,
  }
}

/** Deal statuses whose unfinished tasks are worked on. Other statuses pause their tasks. */
export const WORKING_DEAL_STATUSES = new Set(['Active', 'Pending'])

type ParentLookup = ReadonlyArray<{ id: string; status: string }>

function parentOf(task: TaskRecord, opportunities: ParentLookup) {
  return task.opportunityId ? (opportunities.find((o) => o.id === task.opportunityId) ?? null) : null
}

/**
 * Unfinished task whose parent deal is not Active/Pending (Inactive, Closed, Declined, Withdrew,
 * Completed). It is never completed or deleted automatically: it stays on the opportunity profile
 * marked Paused and returns to the working lists when the deal is Active or Pending again.
 */
export function isPausedTask(task: TaskRecord, opportunities: ParentLookup, now = new Date()): boolean {
  if (!isUnfinishedTask(task, now)) return false
  const parent = parentOf(task, opportunities)
  return Boolean(parent && !WORKING_DEAL_STATUSES.has(parent.status))
}

/**
 * The one eligibility rule shared by Tasks & Follow-Ups, Dashboard priorities and the bell:
 * unfinished, and linked to an Active/Pending deal. A standalone task (no linked deal, for
 * example after its deal was deleted) stays in the working list so it is never silently lost.
 */
export function isWorkingTask(task: TaskRecord, opportunities: ParentLookup, now = new Date()): boolean {
  if (!isUnfinishedTask(task, now)) return false
  if (!task.opportunityId) return true
  const parent = parentOf(task, opportunities)
  if (!parent) return true
  return WORKING_DEAL_STATUSES.has(parent.status)
}

export type TaskHistoryKind = 'Completed' | 'Cancelled/Deleted' | 'Archived'

/** Task History rows: completed, archived and deleted tasks. Unfinished paused tasks are not history. */
export function taskHistoryKind(task: TaskRecord): TaskHistoryKind | null {
  if (task.deletedAt) return 'Cancelled/Deleted'
  if (task.status === 'Done') return 'Completed'
  if (task.archivedAt) return 'Archived'
  return null
}

/** When the task entered history (deleted, archived or completed time). */
export function taskHistoryDate(task: TaskRecord): string | null {
  return task.deletedAt ?? task.completedAt ?? task.archivedAt ?? task.updatedAt ?? null
}
