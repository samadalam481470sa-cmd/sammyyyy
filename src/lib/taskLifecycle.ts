import type { TaskRecord } from '@/data/mockModules'
import { BASE_CRM_USERS, findCrmUserByName, type CrmUser } from '@/lib/crmUsers'
import { nowIso } from '@/lib/calendarDate'

export const UNFINISHED_TASK_STATUSES = new Set(['Open', 'In Progress'])

export function isDeletedTask(task: TaskRecord): boolean {
  return Boolean(task.deletedAt)
}

export function isUnfinishedTask(task: TaskRecord): boolean {
  if (isDeletedTask(task) || task.archivedAt) return false
  return UNFINISHED_TASK_STATUSES.has(task.status)
}

/** Done means history at once. Older records still waiting on the old seven-day rule count too. */
export function isHistoryTask(task: TaskRecord): boolean {
  if (isDeletedTask(task)) return false
  return Boolean(task.archivedAt) || task.status === 'Done'
}

export function isActiveListTask(task: TaskRecord): boolean {
  return !isDeletedTask(task) && !isHistoryTask(task)
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

/** Done tasks left over from the old seven-day flow enter history dated by their completion. */
export function applyTaskArchiveRules(tasks: TaskRecord[]): {
  tasks: TaskRecord[]
  changed: boolean
} {
  let changed = false
  const next = tasks.map((task) => {
    const migrated = migrateTaskRecord(task)
    if (migrated.status !== 'Done' || migrated.archivedAt || migrated.deletedAt) return migrated
    changed = true
    return { ...migrated, archivedAt: migrated.completedAt ?? nowIso() }
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
      archivedAt: task.archivedAt ?? stamp,
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

/**
 * Restoring from history. Status returns to Open; the due date, original due date and every earlier
 * completion stay, so missed-deadline reporting still sees them. Nothing here re-archives it.
 */
export function restoreTaskFields(task: TaskRecord, actor: string | null, now = new Date()): Partial<TaskRecord> {
  const stamp = nowIso(now)
  return {
    status: 'Open',
    completedAt: null,
    archivedAt: null,
    updatedAt: stamp,
    restoreHistory: [...(task.restoreHistory ?? []), { completedAt: task.completedAt ?? null, archivedAt: task.archivedAt ?? null, restoredAt: stamp, restoredBy: actor }],
  }
}

/** Deal statuses whose tasks are in the live lists. Every other status pauses them on the profile. */
export const WORKING_DEAL_STATUSES = new Set(['Active', 'Pending'])

type ParentLookup = ReadonlyArray<{ id: string; status: string }>

function parentOf(task: TaskRecord, opportunities: ParentLookup) {
  return task.opportunityId ? (opportunities.find((o) => o.id === task.opportunityId) ?? null) : null
}

/**
 * Unfinished task whose parent deal is not Active or Pending. It is never
 * completed or deleted automatically: it stays on the opportunity profile marked Paused and
 * returns to the working lists when the deal is Active or Pending again.
 */
export function isPausedTask(task: TaskRecord, opportunities: ParentLookup): boolean {
  if (!isUnfinishedTask(task)) return false
  const parent = parentOf(task, opportunities)
  return Boolean(parent && !WORKING_DEAL_STATUSES.has(parent.status))
}

/**
 * The one eligibility rule shared by Tasks & Follow-Ups, Dashboard priorities and the bell:
 * unfinished, and linked to an Active or Pending deal. A standalone task (no linked deal, for
 * example after its deal was deleted) stays in the working list so it is never silently lost.
 */
export function isWorkingTask(task: TaskRecord, opportunities: ParentLookup): boolean {
  if (!isUnfinishedTask(task)) return false
  if (!task.opportunityId) return true
  const parent = parentOf(task, opportunities)
  if (!parent) return true
  return WORKING_DEAL_STATUSES.has(parent.status)
}

/** A row on Tasks & Follow-Ups. Done tasks are in Task History, so only working tasks are listed. */
export function isListedTask(task: TaskRecord, opportunities: ParentLookup): boolean {
  return isWorkingTask(task, opportunities)
}

export type TaskHistoryKind = 'Completed' | 'Cancelled/Deleted' | 'Archived'

/** Task History rows: completions, other archived tasks and deleted tasks. Paused tasks are not history. */
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
