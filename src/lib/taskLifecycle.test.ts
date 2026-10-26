import { describe, expect, it } from 'vitest'
import type { TaskRecord } from '@/data/mockModules'
import { applyTaskArchiveRules, isActiveListTask, isHistoryTask } from './taskLifecycle'

const NOW = new Date('2026-10-16T15:00:00Z')

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
  it('keeps a freshly completed task on the active list', () => {
    const recent = task({ completedAt: '2026-10-14T15:00:00Z' })
    expect(isActiveListTask(recent, NOW)).toBe(true)
    expect(isHistoryTask(recent, NOW)).toBe(false)
  })

  it('moves a done task to history after seven days without requiring the browser to stay open', () => {
    const { tasks } = applyTaskArchiveRules([task({ completedAt: '2026-10-01T15:00:00Z' })], NOW)
    expect(tasks[0].archivedAt).toBeTruthy()
    expect(isHistoryTask(tasks[0], NOW)).toBe(true)
    expect(isActiveListTask(tasks[0], NOW)).toBe(false)
  })

  it('excludes deleted tasks from history', () => {
    const deleted = task({ deletedAt: '2026-10-16T12:00:00Z', archivedAt: null })
    expect(isHistoryTask(deleted, NOW)).toBe(false)
    expect(isActiveListTask(deleted, NOW)).toBe(false)
  })
})
