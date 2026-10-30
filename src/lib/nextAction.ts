import type { Opportunity, TaskPriority } from '@/types'
import type { TaskRecord } from '@/data/mockModules'
import { dueDateSortValue, nowIso } from '@/lib/calendarDate'
import { isUnfinishedTask } from '@/lib/taskLifecycle'

export interface NextActionSummary {
  nextAction: string | null
  nextActionDate: string | null
  priority: TaskPriority
  taskId: string | null
  source: 'task' | 'manual'
}

function asPriority(value: string | null | undefined, fallback: TaskPriority = 'B'): TaskPriority {
  return value === 'A' || value === 'B' || value === 'C' ? value : fallback
}

export function preserveManualNextAction(opportunity: Opportunity): Opportunity {
  if (opportunity.nextActionManual !== undefined) return opportunity
  return {
    ...opportunity,
    nextActionManual: opportunity.nextAction ?? null,
    nextActionDateManual: opportunity.nextActionDate ?? null,
    priorityManual: opportunity.priority,
  }
}

export function unfinishedTasksForOpportunity(
  tasks: TaskRecord[],
  opportunityId: string,
  now = new Date(),
): TaskRecord[] {
  return tasks.filter((task) => task.opportunityId === opportunityId && isUnfinishedTask(task, now))
}

const PRIORITY_RANK = { A: 0, B: 1, C: 2 } as const

/**
 * Canonical order for a deal's open tasks: earliest due date first, undated last,
 * then priority A, B, C, then task ID. The order never depends on list position.
 */
export function compareCanonicalTasks(a: TaskRecord, b: TaskRecord, now = new Date()): number {
  const ad = dueDateSortValue(a.dueDate, now)
  const bd = dueDateSortValue(b.dueDate, now)
  if (ad !== bd) {
    if (!Number.isFinite(ad)) return 1
    if (!Number.isFinite(bd)) return -1
    return ad - bd
  }
  const ap = PRIORITY_RANK[asPriority(a.priority)] - PRIORITY_RANK[asPriority(b.priority)]
  if (ap !== 0) return ap
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function pickMostUrgentTask(tasks: TaskRecord[], now = new Date()): TaskRecord | null {
  if (!tasks.length) return null
  return [...tasks].sort((a, b) => compareCanonicalTasks(a, b, now))[0] ?? null
}

/**
 * The displayed next action comes only from linked unfinished tasks.
 * A deal with no unfinished linked task has no next action, so screens and alerts agree.
 */
export function resolveNextAction(
  opportunity: Opportunity,
  tasks: TaskRecord[],
  now = new Date(),
): NextActionSummary {
  const preserved = preserveManualNextAction(opportunity)
  const linked = unfinishedTasksForOpportunity(tasks, preserved.id, now)
  const urgent = pickMostUrgentTask(linked, now)
  if (urgent) {
    return {
      nextAction: urgent.action || null,
      nextActionDate: urgent.dueDate ?? null,
      priority: asPriority(urgent.priority, preserved.priority),
      taskId: urgent.id,
      source: 'task',
    }
  }
  return {
    nextAction: null,
    nextActionDate: null,
    priority: preserved.priorityManual ?? preserved.priority,
    taskId: null,
    source: 'manual',
  }
}

export function applyNextActionSummary(
  opportunity: Opportunity,
  tasks: TaskRecord[],
  now = new Date(),
): Opportunity {
  const preserved = preserveManualNextAction(opportunity)
  const summary = resolveNextAction(preserved, tasks, now)
  return {
    ...preserved,
    nextAction: summary.nextAction,
    nextActionDate: summary.nextActionDate,
    priority: summary.priority,
    nextActionTaskId: summary.taskId,
  }
}

export function withManualNextActionOverride(
  patch: Partial<Pick<Opportunity, 'nextAction' | 'nextActionDate' | 'priority'>>,
): Partial<Opportunity> {
  const next: Partial<Opportunity> = { ...patch }
  if (patch.nextAction !== undefined) next.nextActionManual = patch.nextAction
  if (patch.nextActionDate !== undefined) next.nextActionDateManual = patch.nextActionDate
  if (patch.priority !== undefined) next.priorityManual = patch.priority
  return next
}

export function nextActionFieldsTouched(
  patch: Partial<Pick<Opportunity, 'nextAction' | 'nextActionDate' | 'priority'>>,
): boolean {
  return (
    patch.nextAction !== undefined ||
    patch.nextActionDate !== undefined ||
    patch.priority !== undefined
  )
}

/**
 * Keep the displayed next action in sync with the unfinished linked task that
 * currently drives it, so an opportunity save is not overwritten by stale task fields.
 */
export function syncDrivingTaskFromOpportunityPatch(
  opportunity: Opportunity,
  tasks: TaskRecord[],
  patch: Partial<Pick<Opportunity, 'nextAction' | 'nextActionDate' | 'priority'>>,
  now = new Date(),
): { tasks: TaskRecord[]; drivingId: string | null } {
  if (!nextActionFieldsTouched(patch)) return { tasks, drivingId: opportunity.nextActionTaskId ?? null }
  const unfinished = unfinishedTasksForOpportunity(tasks, opportunity.id, now)
  const driving =
    (opportunity.nextActionTaskId
      ? unfinished.find((row) => row.id === opportunity.nextActionTaskId)
      : null) ?? pickMostUrgentTask(unfinished, now)
  if (!driving) return { tasks, drivingId: null }
  const next: TaskRecord = {
    ...driving,
    action: patch.nextAction !== undefined ? patch.nextAction?.trim() || driving.action : driving.action,
    dueDate: patch.nextActionDate !== undefined ? patch.nextActionDate : driving.dueDate,
    priority: patch.priority !== undefined ? asPriority(patch.priority, asPriority(driving.priority)) : driving.priority,
    updatedAt: nowIso(now),
  }
  return {
    tasks: tasks.map((row) => (row.id === driving.id ? next : row)),
    drivingId: driving.id,
  }
}
