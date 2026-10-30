import { describe, expect, it } from 'vitest'
import type { Opportunity, OpportunityStatus } from '@/types'
import type { TaskRecord } from '@/data/mockModules'
import { mockOpportunities } from '@/data/mockOpportunities'
import {
  dealWarnings,
  primaryDealWarning,
  rankOpportunitiesByNextAction,
  uniqueAttentionCount,
} from './attention'
import { applyNextActionSummary, pickMostUrgentTask } from './nextAction'

const NOW = new Date(2026, 9, 30, 10, 0, 0) // Oct 30, 2026, local time

function opp(id: string, patch: Partial<Opportunity> = {}): Opportunity {
  const base = mockOpportunities.find((row) => row.id === id) ?? mockOpportunities[0]
  return { ...base, ...patch }
}

function task(partial: Partial<TaskRecord>): TaskRecord {
  return {
    id: 't1',
    priority: 'A',
    action: 'Call counsel',
    opportunityId: 'opp-f',
    projectName: 'Project F',
    owner: 'Dennis DiCapua',
    dueDate: '2026-10-10',
    status: 'Open',
    notes: '',
    ...partial,
  }
}

describe('attention (Active and Pending only, from linked tasks)', () => {
  it('is red when the canonical linked task is overdue', () => {
    const deal = opp('opp-f', { status: 'Active' })
    const tasks = [task({ dueDate: '2026-10-29' })]
    const warning = primaryDealWarning(deal, tasks, NOW)
    expect(warning?.level).toBe('red')
    expect(warning?.reason).toBe('Next action overdue')
  })

  it('is navy for today, Nov 1 and Nov 6, and silent for Nov 7', () => {
    const deal = opp('opp-f', { status: 'Pending' })
    for (const due of ['2026-10-30', '2026-11-01', '2026-11-06']) {
      expect(primaryDealWarning(deal, [task({ dueDate: due })], NOW)?.level).toBe('navy')
    }
    expect(primaryDealWarning(deal, [task({ dueDate: '2026-11-07' })], NOW)).toBeNull()
  })

  it('is red for Active or Pending deals with no unfinished linked task, ignoring typed text', () => {
    for (const status of ['Active', 'Pending'] as OpportunityStatus[]) {
      const deal = opp('opp-g', { status, nextAction: 'Typed text', nextActionManual: 'Typed text', nextActionDate: '2026-11-20' })
      expect(primaryDealWarning(deal, [], NOW)?.reason).toBe('No next action assigned')
    }
  })

  it('never warns for Completed or inactive statuses, even with stale overdue tasks', () => {
    const stale = [task({ dueDate: '2026-09-01' })]
    for (const status of ['Completed', 'Inactive', 'Declined', 'Withdrew', 'Closed'] as OpportunityStatus[]) {
      expect(dealWarnings(opp('opp-f', { status }), stale, NOW)).toHaveLength(0)
      expect(dealWarnings(opp('opp-f', { status }), [], NOW)).toHaveLength(0)
    }
  })

  it('does not count completed or archived tasks as unfinished', () => {
    const deal = opp('opp-f', { status: 'Pending' })
    const done = task({ status: 'Done', dueDate: '2026-10-01', completedAt: '2026-10-01T12:00:00Z', archivedAt: '2026-10-09T12:00:00Z' })
    expect(primaryDealWarning(deal, [done], NOW)?.reason).toBe('No next action assigned')
  })

  it('counts unique deals, not tasks', () => {
    const deal = opp('opp-f', { status: 'Active' })
    const tasks = [task({ id: 'a', dueDate: '2026-10-01' }), task({ id: 'b', dueDate: '2026-10-02' }), task({ id: 'c', dueDate: '2026-11-02' })]
    expect(dealWarnings(deal, tasks, NOW)).toHaveLength(1)
    expect(uniqueAttentionCount([deal], tasks, NOW)).toBe(1)
  })

  it('picks the earliest due task, then priority, then ID, with undated tasks last', () => {
    const tasks = [
      task({ id: 'z', dueDate: null }),
      task({ id: 'b', dueDate: '2026-11-02', priority: 'B' }),
      task({ id: 'c', dueDate: '2026-11-02', priority: 'A' }),
      task({ id: 'a', dueDate: '2026-11-02', priority: 'A' }),
    ]
    expect(pickMostUrgentTask(tasks, NOW)?.id).toBe('a')
    const summary = applyNextActionSummary(opp('opp-f'), tasks, NOW)
    expect(summary.nextActionTaskId).toBe('a')
  })

  it('ranks overdue deals ahead of upcoming dates', () => {
    const overdue = opp('opp-b', { id: 'opp-b', status: 'Active' })
    const upcoming = opp('opp-a', { id: 'opp-a', status: 'Active' })
    const tasks = [
      task({ id: 'x', opportunityId: 'opp-b', dueDate: '2026-10-20' }),
      task({ id: 'y', opportunityId: 'opp-a', dueDate: '2026-11-03' }),
    ]
    const ranked = rankOpportunitiesByNextAction([upcoming, overdue], tasks, NOW)
    expect(ranked[0].id).toBe('opp-b')
  })
})
