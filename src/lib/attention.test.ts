import { describe, expect, it } from 'vitest'
import type { Opportunity } from '@/types'
import type { TaskRecord } from '@/data/mockModules'
import { mockOpportunities } from '@/data/mockOpportunities'
import {
  dealWarnings,
  primaryDealWarning,
  rankOpportunitiesByNextAction,
  uniqueAttentionCount,
} from './attention'
import { applyNextActionSummary } from './nextAction'

const NOW = new Date('2026-10-16T12:00:00-04:00')

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
    projectName: 'Project A',
    owner: 'Dennis DiCapua',
    dueDate: '2026-10-10',
    status: 'Open',
    notes: '',
    ...partial,
  }
}

describe('attention', () => {
  it('uses red for overdue unfinished next actions and unique deal counts', () => {
    const deal = applyNextActionSummary(opp('opp-b'), [], NOW)
    const warning = primaryDealWarning(deal, [], NOW)
    expect(warning?.level).toBe('red')
    expect(warning?.reason).toBe('Next action overdue')
    expect(uniqueAttentionCount([deal], [], NOW)).toBe(1)
  })

  it('uses yellow for unfinished next actions due within seven days including today', () => {
    const deal = applyNextActionSummary(
      opp('opp-a', { nextAction: 'Review', nextActionDate: '2026-10-16', status: 'Pending' }),
      [],
      NOW,
    )
    const warning = primaryDealWarning(deal, [], NOW)
    expect(warning?.level).toBe('yellow')
  })

  it('uses red for Active deals with no next action', () => {
    const deal = applyNextActionSummary(
      opp('opp-g', { status: 'Active', nextAction: null, nextActionDate: null, nextActionManual: null }),
      [],
      NOW,
    )
    expect(primaryDealWarning(deal, [], NOW)?.reason).toBe('No next action assigned')
  })

  it('does not warn from completed or archived tasks', () => {
    const deal = opp('opp-f', {
      status: 'Pending',
      nextAction: null,
      nextActionManual: null,
      nextActionDate: null,
    })
    const done = task({
      status: 'Done',
      dueDate: '2026-10-01',
      completedAt: '2026-10-01T12:00:00Z',
      archivedAt: '2026-10-09T12:00:00Z',
    })
    expect(dealWarnings(deal, [done], NOW)).toHaveLength(0)
  })

  it('ranks overdue deals ahead of upcoming dates', () => {
    const overdue = opp('opp-b', { nextActionDate: '2026-09-24' })
    const upcoming = opp('opp-a', { nextActionDate: '2026-10-20' })
    const ranked = rankOpportunitiesByNextAction([upcoming, overdue], [], NOW)
    expect(ranked[0].id).toBe('opp-b')
  })
})
