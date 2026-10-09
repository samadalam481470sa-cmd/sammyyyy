import { describe, expect, it } from 'vitest'
import type { Opportunity } from '@/types'
import {
  opportunityDraftPatch,
  opportunityDraftsEqual,
  snapshotOpportunityDraft,
} from './opportunityDraft'

const base: Opportunity = {
  id: 'opp-a',
  projectNumber: 1,
  projectName: 'Project A',
  entityName: 'Entity A',
  type: 'Platform Acquisition',
  status: 'Active',
  stage: 'NDA',
  dealLead: 'Dennis DiCapua',
  sourceType: 'Investment Banker',
  sourceName: 'Demo Advisory Group',
  specialty: 'Specialty Casualty',
  geography: 'Southeast US',
  nwp: 10_000_000,
  netRevenue: 2_000_000,
  pfEbitda: 1_000_000,
  nextAction: 'Review sample materials',
  nextActionDate: '2026-09-26',
  priority: 'A',
  lastActivityDate: '2026-09-25T14:00:00Z',
  needsAttention: false,
  attentionReasons: [],
  outstandingItems: ['Call counsel'],
  diligenceNotes: 'Sample note',
}

describe('opportunityDraft', () => {
  it('does not mark a freshly opened record dirty', () => {
    const snap = snapshotOpportunityDraft(base)
    expect(opportunityDraftsEqual(snap, snapshotOpportunityDraft(base))).toBe(true)
    expect(Object.keys(opportunityDraftPatch(snap, snap))).toHaveLength(0)
  })

  it('treats reverted edits as clean', () => {
    const saved = snapshotOpportunityDraft(base)
    const dirty = { ...saved, status: 'Pending' as const, stage: 'Due Diligence' as const }
    expect(opportunityDraftsEqual(saved, dirty)).toBe(false)
    const reverted = { ...dirty, status: saved.status, stage: saved.stage }
    expect(opportunityDraftsEqual(saved, reverted)).toBe(true)
  })

  it('diffs only changed fields including outstanding items', () => {
    const saved = snapshotOpportunityDraft(base)
    const draft = {
      ...saved,
      nextAction: 'Follow up',
      outstandingItems: ['Call counsel', 'Request data room'],
    }
    const patch = opportunityDraftPatch(saved, draft)
    expect(patch).toEqual({
      nextAction: 'Follow up',
      outstandingItems: ['Call counsel', 'Request data room'],
    })
  })
})
