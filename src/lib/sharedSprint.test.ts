import { describe, expect, it } from 'vitest'
import type { TaskRecord } from '@/data/mockModules'
import { allocateBellSpace, BELL_SIZES, todaysMeetings } from './bellSlots'
import { DEFAULT_DEAL_LEADS, leadUsage, migrateTaskOwner, taskOwnerOptions, type DealLead } from './dealLeads'
import { monthlyCountAxis } from './reports'
import { applyTaskArchiveRules, applyTaskStatusTransition, isListedTask, isWorkingTask, restoreTaskFields, taskHistoryKind } from './taskLifecycle'

const task = (over: Partial<TaskRecord> = {}): TaskRecord => ({ id: 't', priority: 'A', action: 'Call', opportunityId: 'o1', projectName: 'P', owner: 'Mary Sbaschnig', dueDate: '2026-10-01', status: 'Open', notes: '', ...over })
const parents = [{ id: 'o1', status: 'Active' }, { id: 'o2', status: 'Completed' }, { id: 'o3', status: 'Inactive' }]

describe('completing and restoring a task', () => {
  it('Done goes to history at once, with no waiting period', () => {
    const done = applyTaskStatusTransition(task(), 'Done', new Date('2026-11-05T12:00:00Z'))
    expect(done.archivedAt).toBeTruthy()
    expect(taskHistoryKind(done)).toBe('Completed')
    expect(isListedTask(done, parents)).toBe(false)
  })

  it('a task finished under the old flow is in history too', () => {
    const old = task({ status: 'Done', completedAt: '2026-11-04T00:00:00.000Z', archivedAt: null })
    const [migrated] = applyTaskArchiveRules([old]).tasks
    expect(migrated.archivedAt).toBe('2026-11-04T00:00:00.000Z')
    expect(taskHistoryKind(old)).toBe('Completed')
    expect(isListedTask(old, parents)).toBe(false)
  })

  it('Restore returns it Open, keeps the due date and records the earlier completion', () => {
    const done = { ...task({ initialDueDate: '2026-10-01' }), status: 'Done', completedAt: '2026-11-01T00:00:00.000Z', archivedAt: '2026-11-01T00:00:00.000Z' }
    const restored = { ...done, ...restoreTaskFields(done, 'Sam') }
    expect(restored).toMatchObject({ status: 'Open', completedAt: null, archivedAt: null, dueDate: '2026-10-01', initialDueDate: '2026-10-01' })
    expect(restored.restoreHistory?.[0]).toMatchObject({ completedAt: '2026-11-01T00:00:00.000Z', restoredBy: 'Sam' })
    expect(applyTaskArchiveRules([restored]).tasks[0].archivedAt).toBeNull()
    expect(isListedTask(restored, parents)).toBe(true)
  })

  it('live lists hold Active and Pending deals only', () => {
    expect(isWorkingTask(task({ opportunityId: 'o1' }), parents)).toBe(true)
    expect(isWorkingTask(task({ opportunityId: 'o2' }), parents)).toBe(false)
    expect(isWorkingTask(task({ opportunityId: 'o3' }), parents)).toBe(false)
  })
})

describe('Task Owner comes from the roster', () => {
  const roster: DealLead[] = [
    ...DEFAULT_DEAL_LEADS,
    { id: 'lead-x', name: 'Off Duty', jobTitle: '', email: '', phone: '', status: 'Inactive', authAccountId: null, createdAt: '', updatedAt: '' },
  ]

  it('offers Active leads only, sorted', () => {
    expect(taskOwnerOptions(roster, null).map((o) => o.id)).toEqual(['lead-dennis', 'lead-mary'])
  })

  it('keeps showing an inactive current owner and a historical name', () => {
    expect(taskOwnerOptions(roster, { ownerId: 'lead-x', owner: 'Off Duty' }).map((o) => o.id)).toContain('lead-x')
    const legacy = taskOwnerOptions(roster, { ownerId: null, owner: 'Alex Rivera' })
    expect(legacy[0]).toMatchObject({ id: 'legacy:Alex Rivera', label: 'Alex Rivera' })
  })

  it('an empty roster has no options', () => {
    expect(taskOwnerOptions([], null)).toEqual([])
  })

  it('old tasks link by exact name, and an unknown name stays as written', () => {
    expect(migrateTaskOwner({ owner: 'Mary Sbaschnig', ownerId: 'user-mary' }, roster).ownerId).toBe('lead-mary')
    expect(migrateTaskOwner({ owner: 'Alex Rivera', ownerId: null }, roster)).toEqual({ owner: 'Alex Rivera', ownerId: null })
  })

  it('counts every use of a lead before a delete', () => {
    const usage = leadUsage(
      { id: 'L', name: 'Lee' },
      [{ primaryLeadId: 'L', additionalLeadIds: [], dealLead: 'Lee' }, { primaryLeadId: null, additionalLeadIds: ['L'], dealLead: '' }, { primaryLeadId: null, additionalLeadIds: [], dealLead: 'lee' }],
      [{ ownerId: 'L', owner: 'Lee' }, { ownerId: 'L', owner: 'Lee', deletedAt: '2026-01-01' }],
    )
    expect(usage).toEqual({ primary: 1, additional: 1, taskOwner: 1, legacyName: 1, total: 4 })
  })
})

describe('bell', () => {
  // A typical desktop drawer list area (900px window minus the drawer's header and footer).
  const H = 760
  const rowsTotal = (a: { meetings: number; tasks: number; mail: number }) =>
    (a.meetings ? BELL_SIZES.section : 0) + a.meetings * BELL_SIZES.row + (a.tasks ? BELL_SIZES.section : 0) + a.tasks * BELL_SIZES.row + (a.mail ? BELL_SIZES.section : 0) + a.mail * BELL_SIZES.mailRow

  it('one meeting, four overdue tasks, seven emails all fit without scrolling', () => {
    const a = allocateBellSpace({ meetings: 1, tasks: 4, mail: 7 }, H)
    expect(a.meetings).toBe(1)
    expect(a.tasks).toBeGreaterThanOrEqual(1)
    expect(a.mail).toBeGreaterThanOrEqual(1)
    expect(rowsTotal(a)).toBeLessThanOrEqual(H)
  })

  it('keeps at least one task and one email when there are many of both and no meetings', () => {
    const a = allocateBellSpace({ meetings: 0, tasks: 40, mail: 40 }, H)
    expect(a.meetings).toBe(0)
    expect(a.tasks).toBeGreaterThanOrEqual(1)
    expect(a.mail).toBeGreaterThanOrEqual(1)
    expect(Math.abs(a.tasks - a.mail)).toBeLessThanOrEqual(1)
    expect(rowsTotal(a)).toBeLessThanOrEqual(H)
  })

  it('many meetings take the space but leave one task and one email visible', () => {
    const a = allocateBellSpace({ meetings: 30, tasks: 7, mail: 9 }, H)
    expect(a.meetings).toBeLessThan(30)
    expect(a.meetings).toBeGreaterThan(5)
    expect(a.tasks).toBe(1)
    expect(a.mail).toBe(1)
    expect(rowsTotal(a)).toBeLessThanOrEqual(H)
  })

  it('a single populated group uses the space, and a mailbox notice is reserved', () => {
    expect(allocateBellSpace({ meetings: 0, tasks: 3, mail: 0, mailRows: false }, H)).toEqual({ meetings: 0, tasks: 3, mail: 0 })
    const onlyMail = allocateBellSpace({ meetings: 0, tasks: 0, mail: 30 }, H)
    expect(onlyMail.mail).toBeGreaterThan(8)
    expect(rowsTotal(onlyMail)).toBeLessThanOrEqual(H)
  })

  it('a very short drawer still shows one row of each group (and scrolls)', () => {
    expect(allocateBellSpace({ meetings: 5, tasks: 5, mail: 5 }, 200)).toEqual({ meetings: 1, tasks: 1, mail: 1 })
  })

  const start = new Date('2026-11-05T00:00:00')
  const end = new Date('2026-11-06T00:00:00')
  const now = new Date('2026-11-05T12:00:00')
  const at = (h: number) => new Date(`2026-11-05T${String(h).padStart(2, '0')}:00:00`).toISOString()

  it('orders upcoming first, drops cancelled and other days, and lists a saved copy once', () => {
    const list = todaysMeetings(
      [
        { id: 'past', subject: 'Early', start: at(8), end: at(9) },
        { id: 'later', subject: 'Late', start: at(16), end: at(17), platform: 'Teams' },
        { id: 'soon', subject: 'Soon', start: at(13), end: at(14) },
        { id: 'off', subject: 'Cancelled', start: at(15), end: at(16), isCancelled: true },
        { id: 'tmw', subject: 'Tomorrow', start: new Date('2026-11-06T10:00:00').toISOString(), end: new Date('2026-11-06T11:00:00').toISOString() },
      ],
      [
        { id: 'm1', outlookEventId: 'soon', displayTitle: 'Soon saved', start: at(13), end: at(14) },
        { id: 'm2', displayTitle: 'Soon', start: at(13), end: at(14) },
        { id: 'm3', displayTitle: 'Saved only', start: at(14), end: at(15) },
      ],
      start,
      end,
      now,
    )
    expect(list.map((m) => m.id)).toEqual(['soon', 'm3', 'later', 'past'])
    expect(list[3].past).toBe(true)
  })
})

describe('monthly chart axis', () => {
  it('leaves headroom with whole-number ticks from zero', () => {
    expect(monthlyCountAxis([0, 0])).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] })
    expect(monthlyCountAxis([0, 1, 0]).max).toBe(4)
    expect(monthlyCountAxis([3, 0]).max).toBe(6)
    expect(monthlyCountAxis([]).ticks[0]).toBe(0)
  })

  it('scales with larger counts', () => {
    for (const peak of [4, 7, 12, 25, 60, 300, 9000]) {
      const axis = monthlyCountAxis([peak])
      expect(axis.max).toBeGreaterThan(peak)
      expect(axis.ticks.length).toBeLessThanOrEqual(8)
      expect(axis.ticks.every((tick) => Number.isInteger(tick) && tick >= 0)).toBe(true)
      expect(axis.ticks.at(-1)).toBe(axis.max)
    }
  })
})
