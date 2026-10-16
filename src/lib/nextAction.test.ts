import { describe, expect, it } from 'vitest'
import { mockOpportunities } from '@/data/mockOpportunities'
import type { TaskRecord } from '@/data/mockModules'
import { resolveNextAction } from './nextAction'

const NOW = new Date('2026-10-16T12:00:00Z')

function task(partial: Partial<TaskRecord>): TaskRecord {
  return {
    id: 't',
    priority: 'B',
    action: 'Follow up',
    opportunityId: 'opp-a',
    projectName: 'Project A',
    owner: 'Dennis DiCapua',
    dueDate: null,
    status: 'Open',
    notes: '',
    ...partial,
  }
}

describe('nextAction reconciliation', () => {
  it('keeps the manual next action when there are no unfinished linked tasks', () => {
    const opp = mockOpportunities[0]
    const summary = resolveNextAction(opp, [], NOW)
    expect(summary.source).toBe('manual')
    expect(summary.nextAction).toBe(opp.nextAction)
  })

  it('uses the oldest overdue unfinished task as the opportunity summary', () => {
    const opp = mockOpportunities[0]
    const tasks = [
      task({ id: 't-new', action: 'Upcoming call', dueDate: '2026-10-20' }),
      task({ id: 't-old', action: 'Overdue call', dueDate: '2026-09-01', priority: 'A' }),
      task({ id: 't-done', action: 'Finished', dueDate: '2026-08-01', status: 'Done', completedAt: '2026-08-02T00:00:00Z' }),
    ]
    const summary = resolveNextAction(opp, tasks, NOW)
    expect(summary.source).toBe('task')
    expect(summary.nextAction).toBe('Overdue call')
    expect(summary.taskId).toBe('t-old')
  })
})
