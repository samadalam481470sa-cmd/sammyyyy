import { describe, expect, it } from 'vitest'
import type { TaskRecord } from '@/data/mockModules'
import type { Opportunity } from '@/types'
import { dealWarnings } from './attention'
import {
  additionalLeadOptions,
  claimableLead,
  DEFAULT_DEAL_LEADS,
  emailConflict,
  findOwnLead,
  isValidLeadEmail,
  leadAssignment,
  leadLinkChanges,
  leadLinks,
  leadPermissions,
  migrateOpportunityLeads,
  primaryLeadOptions,
  primaryLeadValue,
  UNASSIGNED_LEAD,
  type DealLead,
} from './dealLeads'
import { opportunityDraftPatch, snapshotOpportunityDraft } from './opportunityDraft'
import { buildPortableDatabase, parsePortableDatabase, serializePortableDatabase } from './portableDatabase'
import { buildTrends, completionSteps, countByLead, leadFinancials, monthlyStepSeries, resolvePeriod, scopeDeals } from './reports'
import { isDoneAwaitingArchive, isListedTask, isWorkingTask, taskHistoryKind } from './taskLifecycle'
import { rankWeekPriorityTasks, sortVisibleTasks } from './taskSort'

const NOW = new Date(2026, 10, 4, 12, 0, 0)

function task(id: string, priority: string, dueDate: string | null, extra: Partial<TaskRecord> = {}): TaskRecord {
  return { id, priority, action: id, opportunityId: 'o1', projectName: 'P', owner: 'Mary', dueDate, status: 'Open', notes: '', ...extra } as TaskRecord
}

function opp(partial: Partial<Opportunity>): Opportunity {
  return { id: 'o1', projectName: 'P', entityName: 'E', status: 'Active', stage: 'NDA', dealLead: '', nwp: 0, netRevenue: 0, pfEbitda: 0, ...partial } as Opportunity
}

describe('one task order', () => {
  it('a C overdue beats a due-soon A, a due-soon B beats a no-warning A, A/B/C inside each tier', () => {
    const rows = sortVisibleTasks(
      [
        task('later-a', 'A', '2026-12-04'),
        task('soon-b', 'B', '2026-11-05'),
        task('soon-a', 'A', '2026-11-10'),
        task('over-c', 'C', '2026-10-01'),
        task('over-a-new', 'A', '2026-11-01'),
        task('over-a-old', 'A', '2026-10-01'),
        task('later-b', 'B', '2026-12-01'),
      ],
      NOW,
    )
    expect(rows.map((r) => r.id)).toEqual(['over-a-old', 'over-a-new', 'over-c', 'soon-a', 'soon-b', 'later-a', 'later-b'])
  })

  it('due today is current, not overdue, and the Dashboard list uses the same order', () => {
    const tasks = [task('today-c', 'C', '2026-11-04'), task('over-c', 'C', '2026-11-03'), task('soon-a', 'A', '2026-11-06')]
    const opportunities = [{ id: 'o1', status: 'Active' }]
    expect(sortVisibleTasks(tasks, NOW).map((r) => r.id)).toEqual(['over-c', 'soon-a', 'today-c'])
    expect(rankWeekPriorityTasks(tasks, NOW, opportunities).map((r) => r.id)).toEqual(['over-c', 'soon-a', 'today-c'])
  })

  it('tasks follow their deal: paused on Inactive, Closed, Declined, Withdrew; back on Active, Pending, Completed', () => {
    const t = task('a', 'A', '2026-11-05')
    for (const status of ['Inactive', 'Closed', 'Declined', 'Withdrew']) expect(isWorkingTask(t, [{ id: 'o1', status }], NOW)).toBe(false)
    for (const status of ['Active', 'Pending', 'Completed']) expect(isWorkingTask(t, [{ id: 'o1', status }], NOW)).toBe(true)
  })
})

describe('Done stays on the list until archived', () => {
  const parents = [{ id: 'o1', status: 'Active' }]
  const done = task('d', 'A', '2026-10-01', { status: 'Done', completedAt: '2026-11-03T12:00:00.000Z' })

  it('selecting Done does not move a task to history', () => {
    expect(isListedTask(done, parents, NOW)).toBe(true)
    expect(isDoneAwaitingArchive(done, NOW)).toBe(true)
    expect(taskHistoryKind(done, NOW)).toBeNull()
  })

  it('a Done task is never overdue, so it is not a working task and not on the priorities list', () => {
    expect(isWorkingTask(done, parents, NOW)).toBe(false)
    expect(rankWeekPriorityTasks([done], NOW, parents)).toEqual([])
    expect(sortVisibleTasks([done, task('open', 'C', null)], NOW).map((r) => r.id)).toEqual(['open', 'd'])
  })

  it('confirmed archive, or seven days, moves it to history', () => {
    expect(taskHistoryKind({ ...done, archivedAt: '2026-11-04T00:00:00.000Z' }, NOW)).toBe('Completed')
    expect(isListedTask({ ...done, archivedAt: '2026-11-04T00:00:00.000Z' }, parents, NOW)).toBe(false)
    const week = new Date(2026, 10, 11, 12, 0, 0)
    expect(taskHistoryKind(done, week)).toBe('Completed')
    expect(isListedTask(done, parents, week)).toBe(false)
  })
})

describe('warning levels', () => {
  it('only an overdue deadline is red; missing action and missing lead are amber', () => {
    const none = dealWarnings(opp({ dealLead: '' }), [], NOW)
    expect(none.map((w) => [w.reason, w.level])).toEqual([
      ['No next action assigned', 'amber'],
      ['No deal owner assigned', 'amber'],
    ])
    const overdue = dealWarnings(opp({ dealLead: 'Mary' }), [task('t', 'A', '2026-10-01')], NOW)
    expect(overdue[0].level).toBe('red')
  })
})

const roster: DealLead[] = [
  ...DEFAULT_DEAL_LEADS,
  { id: 'lead-x', name: 'Xavier Lane', jobTitle: '', email: 'x@firm.com', phone: '', status: 'Active', authAccountId: 'acct-x', createdAt: '', updatedAt: '' },
  { id: 'lead-gone', name: 'Gone Person', jobTitle: '', email: 'g@firm.com', phone: '', status: 'Inactive', authAccountId: null, createdAt: '', updatedAt: '' },
]

describe('deal lead assignment model', () => {
  it('migrates an exact name to primary and keeps an unknown name as legacy, never erased', () => {
    const known = migrateOpportunityLeads(opp({ dealLead: 'mary sbaschnig' }), roster)
    expect(known.primaryLeadId).toBe('lead-mary')
    expect(known.additionalLeadIds).toEqual([])
    const unknown = migrateOpportunityLeads(opp({ dealLead: 'Alex Rivera' }), roster)
    expect(unknown.primaryLeadId).toBeNull()
    expect(unknown.dealLead).toBe('Alex Rivera')
    expect(primaryLeadValue(unknown)).toBe('legacy:Alex Rivera')
    expect(leadAssignment('legacy:Alex Rivera', [], roster).dealLead).toBe('Alex Rivera')
  })

  it('does not overwrite a saved assignment on later migrations', () => {
    const saved = opp({ dealLead: 'Mary Sbaschnig', primaryLeadId: null, additionalLeadIds: ['lead-x'] })
    expect(migrateOpportunityLeads(saved, roster)).toBe(saved)
  })

  it('the primary is never also additional, and ids are unique', () => {
    const team = leadAssignment('lead-mary', ['lead-mary', 'lead-dennis', 'lead-dennis'], roster)
    expect(team).toEqual({ primaryLeadId: 'lead-mary', additionalLeadIds: ['lead-dennis'], dealLead: 'Mary Sbaschnig' })
    expect(leadAssignment(UNASSIGNED_LEAD, [], roster)).toEqual({ primaryLeadId: null, additionalLeadIds: [], dealLead: '' })
  })

  it('new assignments offer Active leads only; an inactive current lead stays visible', () => {
    expect(primaryLeadOptions(roster, {}).map((o) => o.id)).not.toContain('lead-gone')
    expect(primaryLeadOptions(roster, { primaryLeadId: 'lead-gone' }).map((o) => o.id)).toContain('lead-gone')
    expect(additionalLeadOptions(roster, { primaryLeadId: 'lead-mary' }).map((o) => o.id)).toEqual(['lead-dennis', 'lead-x'])
  })

  it('both editors change one relationship: links derive from the opportunity', () => {
    const deals = [
      { ...opp({ id: 'a', projectNumber: 2 }), ...leadAssignment('lead-mary', ['lead-dennis'], roster) },
      { ...opp({ id: 'b', projectNumber: 1 }), ...leadAssignment('lead-dennis', [], roster) },
    ]
    expect(leadLinks(deals, 'lead-dennis').map((l) => [l.opportunity.id, l.role])).toEqual([['b', 'primary'], ['a', 'additional']])
    expect(leadLinks(deals, 'lead-mary').map((l) => l.role)).toEqual(['primary'])
  })

  it('removing a primary needs an explicit choice; additional and new links apply at once', () => {
    const deals = [
      { ...opp({ id: 'a' }), ...leadAssignment('lead-mary', [], roster) },
      { ...opp({ id: 'b' }), ...leadAssignment('lead-dennis', ['lead-mary'], roster) },
      { ...opp({ id: 'c' }), ...leadAssignment(UNASSIGNED_LEAD, [], roster) },
      { ...opp({ id: 'd' }), ...leadAssignment('lead-dennis', [], roster) },
    ]
    const mary = roster[0]
    const blocked = leadLinkChanges(deals, mary, ['c', 'd'], {}, roster)
    expect(blocked.needsReplacement).toEqual(['a'])
    const done = leadLinkChanges(deals, mary, ['c', 'd'], { a: 'lead-dennis' }, roster)
    expect(done.needsReplacement).toEqual([])
    const by = Object.fromEntries(done.changes.map((c) => [c.opportunityId, c.patch]))
    expect(by.a).toEqual({ primaryLeadId: 'lead-dennis', additionalLeadIds: [], dealLead: 'Dennis DiCapua' })
    expect(by.b.additionalLeadIds).toEqual([])
    expect(by.c.primaryLeadId).toBe('lead-mary')
    expect(by.d).toEqual({ primaryLeadId: 'lead-dennis', additionalLeadIds: ['lead-mary'], dealLead: 'Dennis DiCapua' })
    expect(leadLinkChanges(deals, mary, ['c', 'd'], { a: UNASSIGNED_LEAD }, roster).changes.find((c) => c.opportunityId === 'a')?.patch.primaryLeadId).toBeNull()
  })

  it('the editor sends team changes in its patch', () => {
    const before = snapshotOpportunityDraft(opp({ dealLead: 'Mary Sbaschnig', primaryLeadId: 'lead-mary', additionalLeadIds: [] }))
    expect(opportunityDraftPatch(before, { ...before, additionalLeadIds: ['lead-dennis'] })).toEqual({ additionalLeadIds: ['lead-dennis'] })
    expect(opportunityDraftPatch(before, { ...before })).toEqual({})
  })

  it('reports attribute a deal once, under its primary lead', () => {
    const deal = { ...opp({ nwp: 10_000_000, pfEbitda: 2_000_000, createdAt: '2026-01-01' }), ...leadAssignment('lead-mary', ['lead-dennis'], roster) }
    const scoped = scopeDeals([deal], resolvePeriod({ kind: 'all' }, NOW), NOW)
    const names = ['Mary Sbaschnig', 'Dennis DiCapua']
    const counts = Object.fromEntries(countByLead(scoped.pipeline, names).map((r) => [r.lead, r.count]))
    expect(counts).toEqual({ 'Mary Sbaschnig': 1, 'Dennis DiCapua': 0 })
    const money = Object.fromEntries(leadFinancials(scoped, names).map((r) => [r.lead, r.pipelineNwp]))
    expect(money).toEqual({ 'Mary Sbaschnig': 10_000_000, 'Dennis DiCapua': 0 })
  })
})

describe('self-registration rules', () => {
  it('signing in alone creates nothing and finds nothing', () => {
    expect(findOwnLead(roster, { id: 'new-account' })).toBeNull()
    expect(claimableLead(roster, { id: 'new-account', name: 'Brand New' })).toBeNull()
  })

  it('finds your record by account, even after the contact email changes', () => {
    const changed = roster.map((l) => (l.id === 'lead-x' ? { ...l, email: 'other@firm.com' } : l))
    expect(findOwnLead(changed, { id: 'acct-x' })?.id).toBe('lead-x')
    expect(claimableLead(changed, { id: 'acct-x', name: 'Xavier Lane' })).toBeNull()
  })

  it('an unlinked record with the same verified name is claimed, not duplicated', () => {
    expect(claimableLead(roster, { id: 'acct-mary', name: 'Mary Sbaschnig' })?.id).toBe('lead-mary')
  })

  it("you cannot take another person's email", () => {
    expect(emailConflict(roster, 'X@FIRM.com', null)?.id).toBe('lead-x')
    expect(emailConflict(roster, 'x@firm.com', 'lead-x')).toBeNull()
    expect(isValidLeadEmail('a@b.co')).toBe(true)
    expect(isValidLeadEmail('not-an-email')).toBe(false)
  })

  it('edit rights: self or admin for a profile, admin only for status', () => {
    const x = roster.find((l) => l.id === 'lead-x')!
    expect(leadPermissions(x, { id: 'acct-x' }, false)).toMatchObject({ isOwn: true, canEditProfile: true, canChangeStatus: false })
    expect(leadPermissions(x, { id: 'someone' }, false)).toMatchObject({ isOwn: false, canEditProfile: false, canChangeStatus: false })
    expect(leadPermissions(x, { id: 'someone' }, true)).toMatchObject({ canEditProfile: true, canChangeStatus: true })
  })

  it('the roster travels in a database backup, and older backups still import', () => {
    const base = { opportunities: [], tasks: [], contacts: [], documents: [], activity: [] }
    const withLeads = parsePortableDatabase(serializePortableDatabase(buildPortableDatabase({ ...base, dealLeads: roster }, '2026-11-04')))
    expect(withLeads.ok && withLeads.database.dealLeads?.length).toBe(roster.length)
    const older = parsePortableDatabase(serializePortableDatabase(buildPortableDatabase(base, '2026-11-04')))
    expect(older.ok && older.database.dealLeads).toBeUndefined()
  })
})

describe('Trends Over Time series', () => {
  const closed = (id: string, closedAt: string, nwp: number) =>
    opp({ id, status: 'Completed', closedAt, completionConfirmedAt: '2026-01-01T00:00:00.000Z', closingSnapshot: { nwp, pfEbitda: nwp / 10, netRevenue: 0 }, createdAt: '2025-01-01', nwp, pfEbitda: nwp / 10 })

  it('cumulative values are flat between closings and rise on the closing date', () => {
    const steps = completionSteps([closed('a', '2026-02-10', 100), closed('b', '2026-05-20', 50)], resolvePeriod({ kind: 'all' }, NOW), NOW)
    expect(steps.map((s) => s.cumulativeNwp)).toEqual([0, 100, 150, 150])
    expect(steps.map((s) => s.cumulativePfEbitda)).toEqual([0, 10, 15, 15])
    expect(steps[steps.length - 1].t).toBe(NOW.getTime())
  })

  it('a period keeps the opening balance from earlier closings', () => {
    const steps = completionSteps([closed('a', '2026-02-10', 100), closed('b', '2026-05-20', 50)], resolvePeriod({ kind: 'range', from: '2026-04-01', to: '2026-06-30' }, NOW), NOW)
    expect(steps[0].cumulativeNwp).toBe(100)
    expect(steps[steps.length - 1].cumulativeNwp).toBe(150)
  })

  it('a reversed deal is not in the series', () => {
    expect(completionSteps([{ ...closed('a', '2026-02-10', 100), status: 'Active' }], resolvePeriod({ kind: 'all' }, NOW), NOW)).toEqual([])
  })

  it('monthly counts are not a running total and can fall to zero', () => {
    const points = [2, 2, 2, 3, 0].map((created, i) => ({ month: `2026-0${i + 1}`, label: `M${i}`, created, completed: 0, cumulativeNwp: 0, cumulativePfEbitda: 0 }))
    const series = monthlyStepSeries(points, 'created')
    expect(series.map((p) => p.value)).toEqual([2, 2, 2, 2, 2, 2, 3, 3, 0, 0])
    expect(series.slice(0, 4).map((p) => p.x)).toEqual([0, 1, 1, 2])
  })

  it('monthly counts come from recorded dates, without changing buildTrends', () => {
    const trends = buildTrends([closed('a', '2026-10-10', 1)], resolvePeriod({ kind: 'all' }, NOW), NOW)
    expect(trends.points.find((p) => p.month === '2026-10')?.completed).toBe(1)
  })
})
