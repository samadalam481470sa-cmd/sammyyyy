import type { AttentionAlert, AttentionReason, Opportunity } from '@/types'
import type { TaskRecord } from '@/data/mockModules'
import { isOverdueDate, isWithinNextDays } from '@/lib/calendarDate'
import { formatDate } from '@/utils/dashboard'
import { resolveNextAction } from '@/lib/nextAction'

export type WarningLevel = 'red' | 'yellow'

export interface DealWarning {
  level: WarningLevel
  reason: AttentionReason
  detail: string
}

function hasUnfinishedAction(summary: { nextAction: string | null }): boolean {
  return Boolean(summary.nextAction?.trim())
}

export function dealWarnings(
  opportunity: Opportunity,
  tasks: TaskRecord[],
  now = new Date(),
): DealWarning[] {
  const summary = resolveNextAction(opportunity, tasks, now)
  const unfinished = hasUnfinishedAction(summary)
  const overdue = unfinished && isOverdueDate(summary.nextActionDate, now)
  const upcoming = unfinished && isWithinNextDays(summary.nextActionDate, 7, now)
  const activeMissing = opportunity.status === 'Active' && !unfinished

  const warnings: DealWarning[] = []
  if (overdue) {
    warnings.push({
      level: 'red',
      reason: 'Next action overdue',
      detail: `${summary.nextAction} was due ${formatDate(summary.nextActionDate)}`,
    })
  } else if (activeMissing) {
    warnings.push({
      level: 'red',
      reason: 'No next action assigned',
      detail: 'No unfinished next action on this active opportunity',
    })
  }
  if (!overdue && !activeMissing && upcoming) {
    warnings.push({
      level: 'yellow',
      reason: 'Upcoming deadline within 7 days',
      detail: `${summary.nextAction} is due ${formatDate(summary.nextActionDate)}`,
    })
  }
  return warnings
}

export function primaryDealWarning(
  opportunity: Opportunity,
  tasks: TaskRecord[],
  now = new Date(),
): DealWarning | null {
  const warnings = dealWarnings(opportunity, tasks, now)
  return warnings.find((row) => row.level === 'red') ?? warnings[0] ?? null
}

export function withLiveAttention(
  opportunities: Opportunity[],
  tasks: TaskRecord[],
  now = new Date(),
): Opportunity[] {
  return opportunities.map((opportunity) => {
    const warnings = dealWarnings(opportunity, tasks, now)
    return {
      ...opportunity,
      needsAttention: warnings.length > 0,
      attentionReasons: warnings.map((row) => row.reason),
    }
  })
}

export function uniqueAttentionCount(
  opportunities: Opportunity[],
  tasks: TaskRecord[],
  now = new Date(),
): number {
  return opportunities.filter((opportunity) => primaryDealWarning(opportunity, tasks, now)).length
}

function warningRank(warning: DealWarning, opportunity: Opportunity, tasks: TaskRecord[], now: Date): number {
  const summary = resolveNextAction(opportunity, tasks, now)
  if (warning.reason === 'Next action overdue') {
    const days = summary.nextActionDate
      ? Math.min(0, new Date(`${summary.nextActionDate}T12:00:00`).getTime())
      : 0
    return days
  }
  if (warning.reason === 'No next action assigned') return 1
  if (warning.reason === 'Upcoming deadline within 7 days') {
    return summary.nextActionDate ? new Date(`${summary.nextActionDate}T12:00:00`).getTime() : 2
  }
  return 3
}

export function topAttentionAlerts(
  opportunities: Opportunity[],
  tasks: TaskRecord[],
  limit = 5,
  now = new Date(),
): AttentionAlert[] {
  const rows: Array<{ alert: AttentionAlert; rank: number }> = []
  for (const opportunity of opportunities) {
    const warnings = dealWarnings(opportunity, tasks, now)
    warnings.forEach((warning, index) => {
      rows.push({
        rank: warningRank(warning, opportunity, tasks, now),
        alert: {
          id: `${opportunity.id}:${warning.reason}:${index}`,
          reason: warning.reason,
          projectId: opportunity.id,
          projectName: opportunity.projectName,
          detail: warning.detail,
        },
      })
    })
  }
  return rows
    .sort((a, b) => {
      const aOverdue = a.alert.reason === 'Next action overdue' ? 0 : 1
      const bOverdue = b.alert.reason === 'Next action overdue' ? 0 : 1
      if (aOverdue !== bOverdue) return aOverdue - bOverdue
      const aMissing = a.alert.reason === 'No next action assigned' ? 0 : 1
      const bMissing = b.alert.reason === 'No next action assigned' ? 0 : 1
      if (aMissing !== bMissing) return aMissing - bMissing
      return a.rank - b.rank
    })
    .slice(0, limit)
    .map((row) => row.alert)
}

export function rankOpportunitiesByNextAction(
  opportunities: Opportunity[],
  tasks: TaskRecord[],
  now = new Date(),
): Opportunity[] {
  return [...opportunities].sort((a, b) => {
    const aSummary = resolveNextAction(a, tasks, now)
    const bSummary = resolveNextAction(b, tasks, now)
    const aHas = Boolean(aSummary.nextAction?.trim())
    const bHas = Boolean(bSummary.nextAction?.trim())
    const aOverdue = aHas && isOverdueDate(aSummary.nextActionDate, now)
    const bOverdue = bHas && isOverdueDate(bSummary.nextActionDate, now)
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1
    const aDate = aSummary.nextActionDate
      ? new Date(
          aSummary.nextActionDate.includes('T')
            ? aSummary.nextActionDate
            : `${aSummary.nextActionDate}T12:00:00`,
        ).getTime()
      : Number.POSITIVE_INFINITY
    const bDate = bSummary.nextActionDate
      ? new Date(
          bSummary.nextActionDate.includes('T')
            ? bSummary.nextActionDate
            : `${bSummary.nextActionDate}T12:00:00`,
        ).getTime()
      : Number.POSITIVE_INFINITY
    if (aDate !== bDate) return aDate - bDate
    return a.projectName.localeCompare(b.projectName)
  })
}
