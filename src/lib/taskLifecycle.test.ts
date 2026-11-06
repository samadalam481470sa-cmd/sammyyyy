import { describe, expect, it } from 'vitest'
import type { TaskRecord } from '@/data/mockModules'
import { applyTaskArchiveRules, isActiveListTask, isHistoryTask } from './taskLifecycle'


function task(partial: Partial<TaskRecord>): TaskRecord {
  return {
    id: 't',
    priority: 'B',
    action: 'Close file',
    opportunityId: 'opp-a',
    projectName: 'Project A',
    owner: 'Dennis DiCapua',
    dueDate: '2026-10-01',
    status: 'Done',
    notes: '',
    completedAt: '2026-10-01T15:00:00Z',
    ...partial,
  }
}

describe('taskLifecycle', () => {
  it('a completed task is in history at once', () => {
    const recent = task({ completedAt: '2026-10-14T15:00:00Z' })
    expect(isActiveListTask(recent)).toBe(false)
    expect(isHistoryTask(recent)).toBe(true)
  })

  it('a task left over from the old flow is archived on its completion date', () => {
    const { tasks } = applyTaskArchiveRules([task({ completedAt: '2026-10-01T15:00:00Z' })])
    expect(tasks[0].archivedAt).toBe('2026-10-01T15:00:00Z')
    expect(isHistoryTask(tasks[0])).toBe(true)
    expect(isActiveListTask(tasks[0])).toBe(false)
  })

  it('excludes deleted tasks from history', () => {
    const deleted = task({ deletedAt: '2026-10-16T12:00:00Z', archivedAt: null })
    expect(isHistoryTask(deleted)).toBe(false)
    expect(isActiveListTask(deleted)).toBe(false)
  })
})
