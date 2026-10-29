import { describe, expect, it } from 'vitest'
import { dueTasks } from './MailNotificationsPanel'
import type { TaskRecord } from '@/data/mockModules'

const task = (id: string, dueDate: string | null, status = 'Open', extra: Partial<TaskRecord> = {}): TaskRecord => ({
  id, priority: 'A', action: id, opportunityId: null, projectName: 'P', owner: 'S', dueDate, status, notes: '', ...extra,
})

describe('bell task alerts', () => {
  it('lists open tasks that are overdue or due by tomorrow, soonest first', () => {
    const now = new Date('2026-10-29T12:00:00Z')
    const rows = dueTasks(
      [
        task('later', '2026-11-05'),
        task('tomorrow', '2026-10-30'),
        task('overdue', '2026-10-08'),
        task('done', '2026-10-01', 'Completed'),
        task('archived', '2026-10-01', 'Open', { archivedAt: '2026-10-02' }),
        task('nodate', null),
      ],
      now,
    )
    expect(rows.map((r) => r.id)).toEqual(['overdue', 'tomorrow'])
  })
})
