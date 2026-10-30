/**
 * Reproducible consistency audit. Every number here comes from the same selectors the pages use,
 * so a mismatch between this audit and a page means a page is reading a different source.
 * In development builds the audit is available as window.__newportAudit().
 */
import type { Opportunity, OpportunityStatus } from '@/types'
import type { TaskRecord } from '@/data/mockModules'
import { OPPORTUNITY_STATUSES } from '@/data/constants'
import { isAttentionEligible, primaryDealWarning, uniqueAttentionCount } from '@/lib/attention'
import { overdueTaskList } from '@/lib/taskSort'
import { safeMoney } from '@/utils/dashboard'
import { statusStageConflict } from '@/lib/statusHistory'

export interface ConsistencyAudit {
  asOf: string
  perStatus: Record<OpportunityStatus, number>
  totalOpportunities: number
  overdueUnfinishedTasks: number
  uniqueAtRiskOpportunities: number
  missingTaskOpportunities: number
  navyDueSoonOpportunities: number
  redOverdueOpportunities: number
  financials: {
    activePending: { deals: number; nwp: number; pfEbitda: number }
    completed: { deals: number; nwp: number; pfEbitda: number }
  }
  statusStageConflicts: string[]
}

function sums(rows: Opportunity[]) {
  return {
    deals: rows.length,
    nwp: rows.reduce((total, row) => total + safeMoney(row.nwp), 0),
    pfEbitda: rows.reduce((total, row) => total + safeMoney(row.pfEbitda), 0),
  }
}

export function runConsistencyAudit(
  opportunities: Opportunity[],
  tasks: TaskRecord[],
  now = new Date(),
): ConsistencyAudit {
  const perStatus = Object.fromEntries(OPPORTUNITY_STATUSES.map((status) => [status, 0])) as Record<OpportunityStatus, number>
  for (const row of opportunities) perStatus[row.status] = (perStatus[row.status] ?? 0) + 1
  const warnings = opportunities.map((row) => primaryDealWarning(row, tasks, now))
  return {
    asOf: now.toISOString(),
    perStatus,
    totalOpportunities: opportunities.length,
    overdueUnfinishedTasks: overdueTaskList(tasks, now).length,
    uniqueAtRiskOpportunities: uniqueAttentionCount(opportunities, tasks, now),
    missingTaskOpportunities: warnings.filter((w) => w?.reason === 'No next action assigned').length,
    navyDueSoonOpportunities: warnings.filter((w) => w?.level === 'navy').length,
    redOverdueOpportunities: warnings.filter((w) => w?.reason === 'Next action overdue').length,
    financials: {
      activePending: sums(opportunities.filter(isAttentionEligible)),
      completed: sums(opportunities.filter((row) => row.status === 'Completed')),
    },
    statusStageConflicts: opportunities
      .filter((row) => statusStageConflict(row))
      .map((row) => `${row.projectName}: ${statusStageConflict(row)}`),
  }
}
