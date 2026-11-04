/**
 * Repairs for known problems in older fictional starter records (Oct 30, 2026 fix list).
 * Each fix applies only while the record still holds the exact old value, so a user's own
 * later edit is never overwritten and running it again changes nothing.
 */
import type { Opportunity } from '@/types'

/** Completed starter deals that were left at an earlier stage. */
const COMPLETED_STAGE_FIX: Record<string, Opportunity['stage']> = {
  'opp-q': 'Due Diligence',
  'opp-x': 'IOI / LOI',
  'opp-ae': 'NDA',
  'opp-al': 'Initial Outreach',
}

/** Starter deals assigned to "Alex Rivera" (not a CRM user) or to nobody, and their new lead. */
export const DEAL_LEAD_FIX: Record<string, { from: string; to: string }> = {
  'opp-h': { from: '', to: 'Mary Sbaschnig' },
  'opp-r': { from: 'Alex Rivera', to: 'Dennis DiCapua' },
  'opp-u': { from: 'Alex Rivera', to: 'Mary Sbaschnig' },
  'opp-x': { from: 'Alex Rivera', to: 'Dennis DiCapua' },
  'opp-aa': { from: 'Alex Rivera', to: 'Mary Sbaschnig' },
  'opp-ad': { from: 'Alex Rivera', to: 'Dennis DiCapua' },
  'opp-ag': { from: 'Alex Rivera', to: 'Mary Sbaschnig' },
  'opp-aj': { from: 'Alex Rivera', to: 'Dennis DiCapua' },
  'opp-am': { from: 'Alex Rivera', to: 'Mary Sbaschnig' },
  'opp-ap': { from: 'Alex Rivera', to: 'Dennis DiCapua' },
}

export function fixOpportunity(row: Opportunity): Opportunity {
  let next = backfillSeedDates(row)
  const stage = COMPLETED_STAGE_FIX[row.id]
  if (stage && row.status === 'Completed' && row.stage === stage) next = { ...next, stage: 'Closing' }
  const lead = DEAL_LEAD_FIX[row.id]
  if (lead && (row.dealLead ?? '') === lead.from) next = { ...next, dealLead: lead.to }
  return next
}

/** Returns the same array when nothing needed fixing. */
export function applyDataFixes(rows: Opportunity[]): Opportunity[] {
  let changed = false
  const out = rows.map((row) => {
    const fixed = fixOpportunity(row)
    if (fixed !== row) changed = true
    return fixed
  })
  return changed ? out : rows
}

// ── Seed dates for the fictional demo records (Nov 2026 sprint) ─────────────────────────────

/** The 42 original fictional deals (opp-a … opp-ap) were stored without creation/closing dates. */
function isOriginalSeedDeal(row: Opportunity): boolean {
  return /^opp-[a-z]{1,2}$/.test(row.id) && (row.projectNumber ?? 0) >= 1 && (row.projectNumber ?? 0) <= 42
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/**
 * Deterministic, varied dates for FICTIONAL seed deals only, so Reports trends have data.
 * Fills only missing values (never overwrites a real or user-entered date) and marks the record
 * seedDates: true. Running it again changes nothing.
 */
export function backfillSeedDates(row: Opportunity): Opportunity {
  if (!isOriginalSeedDeal(row)) return row
  const n = row.projectNumber ?? 1
  let next = row
  if (!row.createdAt) {
    const created = new Date(Date.UTC(2025, 0, 6 + (n - 1) * 14 + ((n * 37) % 9), 15, 0, 0))
    next = { ...next, createdAt: created.toISOString(), seedDates: true }
  }
  if (next.status === 'Completed' && !next.closedAt) {
    const created = new Date(next.createdAt ?? Date.UTC(2025, 0, 6))
    const latest = Date.UTC(2026, 9, 28, 17)
    const closedMs = Math.min(created.getTime() + (110 + ((n * 13) % 70)) * 86_400_000, latest)
    const closed = new Date(closedMs)
    const confirmed = new Date(Date.UTC(closed.getUTCFullYear(), closed.getUTCMonth(), closed.getUTCDate(), 17, 0, 0)).toISOString()
    next = {
      ...next,
      closedAt: ymd(closed),
      completionConfirmedAt: next.completionConfirmedAt ?? confirmed,
      completedAt: next.completedAt ?? confirmed,
      closingSnapshot: next.closingSnapshot ?? { nwp: Number(next.nwp) || 0, pfEbitda: Number(next.pfEbitda) || 0, netRevenue: Number(next.netRevenue) || 0 },
      seedDates: true,
    }
  }
  return next
}

/**
 * Fictional task due dates moved once (Nov 4, 2026) so the sponsor demo shows a realistic mix of
 * overdue, due today, due within seven days and later tasks. A task is changed only while it is
 * unfinished and still holds the exact old seed date with no recorded due-date change, so any
 * user edit wins. The old date is replaced as a seed correction (it was never a real commitment).
 */
export const FICTIONAL_TASK_DUE_FIX: Record<string, { from: string; to: string }> = {
  'task-5': { from: '2026-10-15', to: '2026-11-06' },
  'task-6': { from: '2026-10-20', to: '2026-11-09' },
  'task-sprint-2': { from: '2026-10-26', to: '2026-11-10' },
  'task-sprint-3': { from: '2026-10-29', to: '2026-11-12' },
  'task-sprint-4': { from: '2026-11-02', to: '2026-11-06' },
  'task-sprint-8': { from: '2026-10-20', to: '2026-11-13' },
  'task-sprint-15': { from: '2026-10-20', to: '2026-11-18' },
  'task-sprint-16': { from: '2026-10-26', to: '2026-11-11' },
  'task-sprint-22': { from: '2026-10-20', to: '2026-11-20' },
  'task-sprint-23': { from: '2026-10-26', to: '2026-12-03' },
  'task-v2-03': { from: '2026-10-22', to: '2026-11-09' },
  'task-v2-04': { from: '2026-10-28', to: '2026-11-23' },
  'task-v2-05': { from: '2026-10-30', to: '2026-11-12' },
  'task-v2-06': { from: '2026-10-30', to: '2026-11-17' },
  'task-v2-11': { from: '2026-11-16', to: '2026-11-10' },
}

interface FixableTask {
  id: string
  status: string
  dueDate: string | null
  initialDueDate?: string | null
  dueDateHistory?: unknown[]
  deletedAt?: string | null
  archivedAt?: string | null
}

export function applyTaskDataFixes<T extends FixableTask>(rows: T[]): T[] {
  let changed = false
  const out = rows.map((row) => {
    const fix = FICTIONAL_TASK_DUE_FIX[row.id]
    if (!fix || row.dueDate !== fix.from) return row
    if (row.status === 'Done' || row.deletedAt || row.archivedAt) return row
    if (row.dueDateHistory && row.dueDateHistory.length) return row
    changed = true
    return { ...row, dueDate: fix.to, initialDueDate: fix.to }
  })
  return changed ? out : rows
}
