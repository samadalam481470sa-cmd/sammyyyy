import { describe, expect, it } from 'vitest'
import { createdAtFromInput, createdDateInput, draftDateProblem, opportunityDraftPatch, snapshotOpportunityDraft } from './opportunityDraft'
import { opportunityUpdateActivity } from './activityLog'
import { applyStatusChange } from './statusHistory'
import type { Opportunity } from '@/types'

const base = {
  id: 'o1', projectName: 'Project Z', entityName: 'Entity Z', type: 'Platform Acquisition', status: 'Completed', stage: 'Closing',
  dealLead: '', sourceType: 'Other', sourceName: '', specialty: '', geography: '', nwp: 1, netRevenue: 1, pfEbitda: 1,
  nextAction: null, nextActionDate: null, priority: 'B', lastActivityDate: '2026-11-01T00:00:00Z', needsAttention: false, attentionReasons: [],
  createdAt: '2026-10-01T15:00:00.000Z', closedAt: '2026-10-20', completionConfirmedAt: '2026-10-20T15:00:00.000Z',
} as unknown as Opportunity

describe('opportunity business dates', () => {
  it('a picked Created date round-trips to the same local day', () => {
    expect(createdDateInput(createdAtFromInput('2019-03-07'))).toBe('2019-03-07')
  })

  it('a Created correction becomes a createdAt patch; Updated is never in the draft', () => {
    const saved = snapshotOpportunityDraft(base)
    const patch = opportunityDraftPatch(saved, { ...saved, createdDate: '2018-05-01' })
    expect(createdDateInput(patch.createdAt)).toBe('2018-05-01')
    expect('updatedAt' in patch).toBe(false)
  })

  it('validates future dates and ordering, and allows old historical dates', () => {
    const today = '2026-11-06'
    expect(draftDateProblem({ createdDate: '2001-01-01', status: 'Active', closedAt: null }, today)).toBeNull()
    expect(draftDateProblem({ createdDate: '2026-12-01', status: 'Active', closedAt: null }, today)).toMatch(/future/)
    expect(draftDateProblem({ createdDate: '2026-10-01', status: 'Completed', closedAt: '2026-09-01' }, today)).toMatch(/before the Created/)
    expect(draftDateProblem({ createdDate: '2026-10-01', status: 'Completed', closedAt: '2026-11-07' }, today)).toMatch(/future/)
  })

  it('correcting the legal closing date keeps the 24-hour window and adds no completion event', () => {
    const next = applyStatusChange(base, undefined, '2026-11-06T13:00:00.000Z', '2026-10-15')
    expect(next.closedAt).toBe('2026-10-15')
    expect(next.completionConfirmedAt).toBe(base.completionConfirmedAt)
    expect(next.completionCorrections).toEqual(base.completionCorrections ?? [])
    expect(next.statusHistory).toEqual(base.statusHistory ?? [])
  })

  it('Recent Activity names the field and the old and new dates', () => {
    const created = opportunityUpdateActivity('Samad', base, { createdAt: createdAtFromInput('2018-05-01') })
    expect(created?.message).toMatch(/Created date of Project Z from Oct 1, 2026 to May 1, 2018/)
    const closed = opportunityUpdateActivity('Samad', base, { closedAt: '2026-10-15' })
    expect(closed?.message).toMatch(/Legally Closed date of Project Z from Oct 20, 2026 to Oct 15, 2026/)
  })
})
