import { describe, expect, it } from 'vitest'
import type { TaskRecord } from '@/data/mockModules'
import { sortVisibleTasks } from './taskSort'

const NOW = new Date(2026, 9, 16, 12, 0, 0) // Oct 16, 2026, noon local

function task(partial: Partial<TaskRecord>): TaskRecord {
  return {
    id: 't',
    priority: 'B',
    action: 'Task',
    opportunityId: 'opp-a',
    projectName: 'Project A',
    owner: 'Mary Sbaschnig',
    dueDate: null,
    status: 'Open',
    notes: '',
    ...partial,
  }
}

describe('task sort', () => {
  it('orders overdue A/B/C then non-overdue A/B/C, with undated after dated', () => {
    const rows = sortVisibleTasks(
      [
        task({ id: 'undated-a', priority: 'A', action: 'Undated A', dueDate: null }),
        task({ id: 'future-b', priority: 'B', action: 'Future B', dueDate: '2026-10-20' }),
        task({ id: 'overdue-c', priority: 'C', action: 'Overdue C', dueDate: '2026-10-01' }),
        task({ id: 'overdue-a', priority: 'A', action: 'Overdue A', dueDate: '2026-10-02' }),
        task({ id: 'done', priority: 'A', action: 'Done', dueDate: '2026-10-01', status: 'Done', completedAt: '2026-10-15T12:00:00Z' }),
        task({ id: 'today-a', priority: 'A', action: 'Today A', dueDate: '2026-10-16' }),
      ],
      NOW,
    )
    expect(rows.map((row) => row.id)).toEqual([
      'overdue-a',
      'overdue-c',
      'today-a',
      'undated-a',
      'future-b',
      'done',
    ])
  })
})
