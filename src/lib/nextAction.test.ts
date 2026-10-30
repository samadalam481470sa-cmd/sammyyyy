import { describe, expect, it } from 'vitest'
import { mockOpportunities } from '@/data/mockOpportunities'
import type { TaskRecord } from '@/data/mockModules'
import { resolveNextAction, syncDrivingTaskFromOpportunityPatch } from './nextAction'

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
  it('shows no next action when there are no unfinished linked tasks (typed text never drives it)', () => {
    const opp = mockOpportunities[0]
    const summary = resolveNextAction(opp, [], NOW)
    expect(summary.source).toBe('manual')
    expect(summary.nextAction).toBeNull()
    expect(summary.taskId).toBeNull()
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

  it('updates the driving linked task when opportunity next-action fields are saved', () => {
    const opp = mockOpportunities[0]
    const tasks = [
      task({ id: 't-drive', action: 'Review sample materials', dueDate: '2026-10-10', status: 'Open' }),
    ]
    const synced = syncDrivingTaskFromOpportunityPatch(opp, tasks, {
      nextAction: 'Call banker',
      nextActionDate: '2026-11-01',
      priority: 'B',
    }, NOW)
    const updated = synced.tasks.find((row) => row.id === 't-drive')
    expect(updated?.action).toBe('Call banker')
    expect(updated?.dueDate).toBe('2026-11-01')
    expect(updated?.priority).toBe('B')
    const summary = resolveNextAction(opp, synced.tasks, NOW)
    expect(summary.nextAction).toBe('Call banker')
    expect(summary.nextActionDate).toBe('2026-11-01')
  })
})
