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
