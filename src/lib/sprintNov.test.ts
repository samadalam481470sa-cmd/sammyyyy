import { describe, expect, it } from 'vitest'
import type { Opportunity } from '@/types'
import type { TaskRecord } from '@/data/mockModules'
import { applyStatusChange, completionReportState } from './statusHistory'
import { attentionRows } from './attention'
import { isPausedTask, isWorkingTask, taskHistoryKind } from './taskLifecycle'
import { overdueTaskList, rankWeekPriorityTasks } from './taskSort'
import { applyTaskDataFixes, backfillSeedDates } from './dataFixes'
import { matchContactsByEmail } from '@/components/meetings/useMeetingController'
import { meetingLinkInfo } from './graphCalendar'

const NOW = new Date(2026, 10, 4, 10, 0, 0)

function opp(id: string, status: Opportunity['status'], extra: Partial<Opportunity> = {}): Opportunity {
  return {
    id, projectNumber: Number(id.replace(/\D/g, '')) || 1, projectName: `Project ${id}`, entityName: 'Entity', type: 'Platform Acquisition', status, stage: 'NDA',
    dealLead: 'Mary Sbaschnig', sourceType: 'Other', sourceName: '', specialty: '', geography: '', nwp: 10, netRevenue: 2, pfEbitda: 1,
    nextAction: null, nextActionDate: null, priority: 'B', lastActivityDate: '2026-10-01T00:00:00Z', needsAttention: false, attentionReasons: [], ...extra,
  }
}
function task(id: string, opportunityId: string | null, due: string, extra: Partial<TaskRecord> = {}): TaskRecord {
  return { id, priority: 'B', action: id, opportunityId, projectName: '', owner: 'Mary Sbaschnig', dueDate: due, status: 'Open', notes: '', ...extra }
}

describe('Nov 2026 sprint rules', () => {
  it('tasks of inactive deals are paused, not completed, and come back when the deal is active', () => {
    const t = task('t1', 'o1', '2026-10-01')
    const active = [opp('o1', 'Active')]
    const inactive = [opp('o1', 'Inactive')]
    expect(isWorkingTask(t, active, NOW)).toBe(true)
    expect(isWorkingTask(t, inactive, NOW)).toBe(false)
    expect(isPausedTask(t, inactive, NOW)).toBe(true)
    expect(overdueTaskList([t], NOW, inactive)).toHaveLength(0)
    expect(rankWeekPriorityTasks([t], NOW, inactive)).toHaveLength(0)
    expect(overdueTaskList([t], NOW, active)).toHaveLength(1)
    expect(t.status).toBe('Open')
    // A standalone task is kept in the working list, never silently lost.
    expect(isWorkingTask(task('t2', null, '2026-11-10'), active, NOW)).toBe(true)
  })

  it('task history separates completed, archived and deleted, and never lists paused tasks', () => {
    expect(taskHistoryKind(task('a', 'o1', '2026-10-01', { status: 'Done', completedAt: '2026-10-02' }))).toBe('Completed')
    expect(taskHistoryKind(task('b', 'o1', '2026-10-01', { deletedAt: '2026-10-02' }))).toBe('Cancelled/Deleted')
    expect(taskHistoryKind(task('c', 'o1', '2026-10-01'))).toBeNull()
  })

  it('Needs Attention orders most overdue first, then no task, then no lead, then due soon; one row per deal', () => {
    const opps = [opp('o1', 'Active'), opp('o2', 'Active'), opp('o3', 'Pending'), opp('o4', 'Active', { dealLead: '' }), opp('o5', 'Active'), opp('o6', 'Inactive')]
    const tasks = [
      task('t1', 'o1', '2026-10-30'),
      task('t2', 'o2', '2026-10-10'),
      task('t4', 'o4', '2026-12-30'),
      task('t5', 'o5', '2026-11-06'),
      task('t6', 'o6', '2026-10-01'),
    ]
    const rows = attentionRows(opps, tasks, NOW)
    expect(rows.map((r) => r.opportunity.id)).toEqual(['o2', 'o1', 'o3', 'o4', 'o5'])
    expect(rows[0].overdueDays).toBeGreaterThan(rows[1].overdueDays)
    expect(new Set(rows.map((r) => r.opportunity.id)).size).toBe(rows.length)
  })

  it('Completed needs a legal closing date, snapshots values and a reversal clears it with a correction record', () => {
    const base = opp('o1', 'Active')
    const done = applyStatusChange(base, 'Completed', '2026-11-04T16:00:00.000Z', '2026-11-03')
    expect(done.closedAt).toBe('2026-11-03')
    expect(done.completionConfirmedAt).toBe('2026-11-04T16:00:00.000Z')
    expect(done.closingSnapshot).toEqual({ nwp: 10, pfEbitda: 1, netRevenue: 2 })
    const completed = { ...base, ...done, status: 'Completed' as const }
    expect(completionReportState(completed, new Date('2026-11-04T20:00:00Z'))).toBe('provisional')
    expect(completionReportState(completed, new Date('2026-11-05T16:00:01Z'))).toBe('final')
    const back = applyStatusChange(completed, 'Active', '2026-11-04T18:00:00.000Z')
    expect(back.closedAt).toBeNull()
    expect(back.completionCorrections?.map((c) => c.action)).toEqual(['confirmed', 'reversed'])
    expect(completionReportState({ ...completed, ...back, status: 'Active' })).toBe('not_completed')
  })

  it('seed date backfill is deterministic, marks seed data and never overwrites real dates', () => {
    const seed = opp('opp-c', 'Completed', { projectNumber: 3 })
    const once = backfillSeedDates(seed)
    expect(once.createdAt).toBeTruthy()
    expect(once.closedAt! > once.createdAt!.slice(0, 10)).toBe(true)
    expect(once.seedDates).toBe(true)
    expect(backfillSeedDates(once)).toBe(once)
    const real = opp('opp_local_1', 'Completed')
    expect(backfillSeedDates(real)).toBe(real)
    const dated = opp('opp-d', 'Active', { projectNumber: 4, createdAt: '2024-01-01T00:00:00Z' })
    expect(backfillSeedDates(dated).createdAt).toBe('2024-01-01T00:00:00Z')
  })

  it('fictional task date fix applies once and only to untouched seed values', () => {
    const rows = [task('task-5', 'o1', '2026-10-15'), task('task-6', 'o1', '2026-10-21'), task('task-sprint-2', 'o1', '2026-10-26', { dueDateHistory: [{ from: 'a', to: 'b', at: 'c' }] })]
    const fixed = applyTaskDataFixes(rows)
    expect(fixed[0].dueDate).toBe('2026-11-06')
    expect(fixed[1]).toBe(rows[1])
    expect(fixed[2]).toBe(rows[2])
    expect(applyTaskDataFixes(fixed)).toBe(fixed)
  })

  it('meeting attendees match Relationships only by exact email; links infer the platform', () => {
    const contacts = [{ id: 'c1', email: 'Alex@Example.com' }, { id: 'c2', email: '' }] as never
    const meeting = { attendees: [{ name: 'Alex', email: 'alex@example.com', type: 'required', response: '' }, { name: 'Guest', email: 'guest@other.com', type: 'required', response: '' }], organizer: null } as never
    expect(matchContactsByEmail(meeting, contacts)).toEqual(['c1'])
    expect(meetingLinkInfo('https://us02web.zoom.us/j/123')?.platform).toBe('Zoom')
    expect(meetingLinkInfo('https://meet.google.com/abc-defg-hij')?.platform).toBe('Google Meet')
    expect(meetingLinkInfo('https://teams.microsoft.com/l/meetup-join/x')?.platform).toBe('Teams')
    expect(meetingLinkInfo('https://example.com/room')?.platform).toBe('Other link')
    expect(meetingLinkInfo('http://zoom.us/j/1')).toBeNull()
  })
})
