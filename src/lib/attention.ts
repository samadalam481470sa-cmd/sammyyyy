import type { AttentionAlert, AttentionReason, Opportunity } from '@/types'
import type { TaskRecord } from '@/data/mockModules'
import { isOverdueDate, isWithinNextDays } from '@/lib/calendarDate'
import { formatDate } from '@/utils/dashboard'
import { resolveNextAction } from '@/lib/nextAction'

export type WarningLevel = 'red' | 'navy'

export interface DealWarning {
  level: WarningLevel
  reason: AttentionReason
  detail: string
}

/** Needs Attention applies only to in-progress deals. Every other status never warns. */
export const ATTENTION_STATUSES: readonly Opportunity['status'][] = ['Active', 'Pending']

export function isAttentionEligible(opportunity: Pick<Opportunity, 'status'>): boolean {
  return (ATTENTION_STATUSES as readonly string[]).includes(opportunity.status)
}

/**
 * One warning per deal at most, from linked unfinished tasks only:
 * red when the canonical task is overdue, red when there is no unfinished linked task,
 * navy when the canonical task is due today or within the next 7 calendar days.
 */
export function dealWarnings(
  opportunity: Opportunity,
  tasks: TaskRecord[],
  now = new Date(),
): DealWarning[] {
  if (!isAttentionEligible(opportunity)) return []
  const out: DealWarning[] = []
  const summary = resolveNextAction(opportunity, tasks, now)
  if (!summary.taskId) {
    out.push({
      level: 'red',
      reason: 'No next action assigned',
      detail: 'No unfinished follow-up task is linked to this deal',
    })
  } else {
    const label = summary.nextAction || 'Task'
    if (isOverdueDate(summary.nextActionDate, now)) {
      const days = daysOverdue(summary.nextActionDate, now)
      out.push({ level: 'red', reason: 'Next action overdue', detail: `${label} was due ${formatDate(summary.nextActionDate)}${days > 0 ? ` (${days} day${days === 1 ? '' : 's'} overdue)` : ''}` })
    } else if (isWithinNextDays(summary.nextActionDate, 7, now)) {
      out.push({ level: 'navy', reason: 'Upcoming deadline within 7 days', detail: `${label} is due ${formatDate(summary.nextActionDate)}` })
    }
  }
  if (!opportunity.dealLead?.trim()) {
    out.push({ level: 'red', reason: 'No deal owner assigned', detail: 'No deal lead is assigned to this deal' })
  }
  return out
}

/** Whole calendar days a due date is past, in local time (0 when not overdue). */
export function daysOverdue(due: string | null | undefined, now = new Date()): number {
  if (!due) return 0
  const ymd = due.slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return 0
  const dueDay = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.max(0, Math.round((today - dueDay) / 86_400_000))
}

export interface AttentionRow {
  opportunity: Opportunity
  warnings: DealWarning[]
  primary: DealWarning
  /** 0 overdue, 1 no unfinished task, 2 no deal lead, 3 due within 7 days. */
  group: number
  overdueDays: number
}

/**
 * One row per Active/Pending deal that needs attention, most urgent first:
 * most overdue (largest number of days) → no unfinished task → no deal lead → due soon (earliest first).
 * Ties fall back to Deal ID order, so the list never reshuffles between renders.
 */
export function attentionRows(opportunities: Opportunity[], tasks: TaskRecord[], now = new Date()): AttentionRow[] {
  const rows: (AttentionRow & { dueAt: number })[] = []
  for (const opportunity of opportunities) {
    const warnings = dealWarnings(opportunity, tasks, now)
    if (!warnings.length) continue
    const summary = resolveNextAction(opportunity, tasks, now)
    const has = (reason: AttentionReason) => warnings.some((w) => w.reason === reason)
    const group = has('Next action overdue') ? 0 : has('No next action assigned') ? 1 : has('No deal owner assigned') ? 2 : 3
    const primary =
      warnings.find((w) => w.reason === 'Next action overdue') ??
      warnings.find((w) => w.reason === 'No next action assigned') ??
      warnings.find((w) => w.reason === 'No deal owner assigned') ??
      warnings[0]
    rows.push({
      opportunity,
      warnings,
      primary,
      group,
      overdueDays: group === 0 ? daysOverdue(summary.nextActionDate, now) : 0,
      dueAt: summary.nextActionDate ? new Date(`${summary.nextActionDate.slice(0, 10)}T12:00:00`).getTime() : Number.POSITIVE_INFINITY,
    })
  }
  return rows
    .sort((a, b) => {
      if (a.group !== b.group) return a.group - b.group
      if (a.group === 0 && a.overdueDays !== b.overdueDays) return b.overdueDays - a.overdueDays
      if (a.group === 3 && a.dueAt !== b.dueAt) return a.dueAt - b.dueAt
      return (a.opportunity.projectNumber ?? 0) - (b.opportunity.projectNumber ?? 0) || a.opportunity.projectName.localeCompare(b.opportunity.projectName)
    })
    .map(({ dueAt: _dueAt, ...row }) => row)
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
