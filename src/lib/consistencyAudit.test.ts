import { describe, expect, it } from 'vitest'
import { bundledSeedSnapshot } from './portableDatabase'
import { runConsistencyAudit } from './consistencyAudit'
import { applyNextActionSummary } from './nextAction'
import { withLiveAttention } from './attention'
import { applyTaskArchiveRules, isActiveListTask } from './taskLifecycle'
import { isOverdueUnfinishedTask, overdueTaskList } from './taskSort'
import { computeKpis, filterOpportunities } from '@/utils/dashboard'
import { seedV2Opportunities, seedV2Tasks } from '@/data/sprintSeedV2'
import { statusStageConflict } from './statusHistory'

const NOW = new Date(2026, 9, 30, 9, 0, 0) // Oct 30, 2026, local

function dataset(now = NOW) {
  const seeds = bundledSeedSnapshot()
  const tasks = applyTaskArchiveRules(seeds.tasks, now).tasks
  const opportunities = withLiveAttention(
    seeds.opportunities.map((row) => applyNextActionSummary(row, tasks, now)),
    tasks,
    now,
  )
  return { opportunities, tasks }
}

describe('consistency audit', () => {
  it('matches the selectors used by Tasks, Opportunities and the Dashboard', () => {
    const { opportunities, tasks } = dataset()
    const audit = runConsistencyAudit(opportunities, tasks, NOW)
    // Tasks page, Overdue pill.
    const tasksPageOverdue = tasks.filter((t) => isActiveListTask(t, NOW) && isOverdueUnfinishedTask(t, NOW))
    expect(audit.overdueUnfinishedTasks).toBe(tasksPageOverdue.length)
    expect(audit.overdueUnfinishedTasks).toBe(overdueTaskList(tasks, NOW).length)
    // Opportunities page and Dashboard, Needs Attention.
    const attention = filterOpportunities(opportunities, { status: 'Needs Attention', stage: null, search: '' })
    expect(audit.uniqueAtRiskOpportunities).toBe(attention.length)
    expect(computeKpis(opportunities).needsAttention).toBe(attention.length)
    expect(audit.redOverdueOpportunities + audit.missingTaskOpportunities + audit.navyDueSoonOpportunities).toBe(
      audit.uniqueAtRiskOpportunities,
    )
    // Only Active and Pending deals can need attention.
    expect(attention.every((row) => row.status === 'Active' || row.status === 'Pending')).toBe(true)
    // Status counts add up.
    const total = Object.values(audit.perStatus).reduce((a, b) => a + b, 0)
    expect(total).toBe(opportunities.length)
    expect(total).toBe(62)
    console.info('Consistency audit (Oct 30, 2026):', JSON.stringify(audit, null, 2))
  })

  it('keeps working after the planning date', () => {
    const later = new Date(2026, 11, 1, 9, 0, 0)
    const { opportunities, tasks } = dataset(later)
    const audit = runConsistencyAudit(opportunities, tasks, later)
    expect(audit.overdueUnfinishedTasks).toBe(overdueTaskList(tasks, later).length)
    const today = dataset()
    expect(audit.overdueUnfinishedTasks).toBeGreaterThan(runConsistencyAudit(today.opportunities, today.tasks, NOW).overdueUnfinishedTasks)
  })

  it('ships new fictional records with valid status and stage pairs and a date spread', () => {
    const statuses = new Set(seedV2Opportunities.map((row) => row.status))
    expect([...statuses].sort()).toEqual(['Active', 'Closed', 'Completed', 'Declined', 'Inactive', 'Pending', 'Withdrew'])
    expect(seedV2Opportunities.filter((row) => statusStageConflict(row))).toHaveLength(0)
    expect(seedV2Opportunities.every((row) => row.createdAt && row.statusHistory?.length)).toBe(true)
    const due = seedV2Tasks.map((t) => t.dueDate!)
    expect(due.some((d) => d < '2026-10-11')).toBe(true)
    expect(due.some((d) => d > '2026-10-11' && d < '2026-10-21')).toBe(true)
    expect(due.some((d) => d > '2026-10-21' && d < '2026-10-30')).toBe(true)
    expect(due.filter((d) => d === '2026-10-30').length).toBeGreaterThan(0)
    expect(due.some((d) => d >= '2026-11-01' && d <= '2026-11-06')).toBe(true)
    expect(due.some((d) => d.startsWith('2026-12'))).toBe(true)
    expect(due.some((d) => d.startsWith('2027'))).toBe(true)
    expect(seedV2Tasks.every((t) => t.opportunityId && seedV2Opportunities.some((o) => o.id === t.opportunityId))).toBe(true)
  })
})
