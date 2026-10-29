import { describe, expect, it } from 'vitest'
import { taskWarning } from './taskWarning'
import type { TaskRecord } from '@/data/mockModules'

const now = new Date(2026, 9, 29, 9, 0)
const task = (dueDate: string | null, extra: Partial<TaskRecord> = {}): TaskRecord =>
  ({ id: 't', action: 'Call', priority: 'A', opportunityId: null, projectName: '', owner: '', dueDate, status: 'Open', notes: '', ...extra }) as TaskRecord

describe('task warning triangles', () => {
  it('red for overdue, navy for today through 7 days, none otherwise', () => {
    expect(taskWarning(task('2026-10-28'), now)?.level).toBe('red')
    expect(taskWarning(task('2026-10-29'), now)?.level).toBe('navy')
    expect(taskWarning(task('2026-11-05'), now)?.level).toBe('navy')
    expect(taskWarning(task('2026-11-06'), now)).toBeNull()
    expect(taskWarning(task(null), now)).toBeNull()
  })
  it('no warning for done or archived tasks', () => {
    expect(taskWarning(task('2026-10-01', { status: 'Done' }), now)).toBeNull()
    expect(taskWarning(task('2026-10-30', { archivedAt: '2026-10-28' }), now)).toBeNull()
  })
})
