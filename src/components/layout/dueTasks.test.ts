import { describe, expect, it } from 'vitest'
import { dueTasks } from './MailNotificationsPanel'
import { overdueTaskList } from '@/lib/taskSort'
import type { TaskRecord } from '@/data/mockModules'

const task = (id: string, dueDate: string | null, status = 'Open', extra: Partial<TaskRecord> = {}): TaskRecord => ({
  id, priority: 'A', action: id, opportunityId: null, projectName: 'P', owner: 'S', dueDate, status, notes: '', ...extra,
})

describe('bell task alerts', () => {
  it('lists exactly the Tasks page Overdue list: unfinished overdue tasks only', () => {
    const now = new Date(2026, 9, 30, 12, 0, 0)
    const rows = [
      task('later', '2026-11-05'),
      task('today', '2026-10-30'),
      task('overdue-b', '2026-10-08', 'Open', { priority: 'B' }),
      task('overdue-a', '2026-10-20', 'In Progress'),
      task('done', '2026-10-01', 'Done', { completedAt: '2026-10-29T12:00:00Z' }),
      task('archived', '2026-10-01', 'Open', { archivedAt: '2026-10-02' }),
      task('deleted', '2026-10-01', 'Open', { deletedAt: '2026-10-02' }),
      task('nodate', null),
    ]
    expect(dueTasks(rows, now).map((r) => r.id)).toEqual(['overdue-a', 'overdue-b'])
    expect(dueTasks(rows, now)).toEqual(overdueTaskList(rows, now))
  })
})
