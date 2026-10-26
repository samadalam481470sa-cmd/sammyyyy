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

/** Oldest overdue, then earliest upcoming, then undated actionable tasks. */
export function pickMostUrgentTask(tasks: TaskRecord[], now = new Date()): TaskRecord | null {
  if (!tasks.length) return null
  return [...tasks].sort((a, b) => {
    const byDate = dueDateSortValue(a.dueDate, now) - dueDateSortValue(b.dueDate, now)
    if (byDate !== 0) return byDate
    const pri = { A: 0, B: 1, C: 2 }
    const ap = pri[asPriority(a.priority)] - pri[asPriority(b.priority)]
    if (ap !== 0) return ap
    return (a.action || '').localeCompare(b.action || '')
  })[0] ?? null
}

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
    nextAction: preserved.nextActionManual ?? preserved.nextAction ?? null,
    nextActionDate: preserved.nextActionDateManual ?? preserved.nextActionDate ?? null,
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
