import type { Opportunity, OpportunityUpdate } from '@/types'
import { todayDateInput } from '@/lib/calendarDate'

const EDIT_KEYS = [
  'projectName',
  'entityName',
  'type',
  'status',
  'stage',
  'dealLead',
  'primaryLeadId',
  'additionalLeadIds',
  'sourceType',
  'sourceName',
  'specialty',
  'geography',
  'nwp',
  'netRevenue',
  'pfEbitda',
  'nextAction',
  'nextActionDate',
  'priority',
  'outstandingItems',
  'diligenceNotes',
  'closedAt',
] as const satisfies ReadonlyArray<keyof OpportunityUpdate>

export interface OpportunityDraft {
  projectName: string
  entityName: string
  type: Opportunity['type']
  status: Opportunity['status']
  stage: Opportunity['stage']
  dealLead: string
  primaryLeadId: string | null
  additionalLeadIds: string[]
  sourceType: Opportunity['sourceType']
  sourceName: string
  specialty: string
  geography: string
  nwp: number
  netRevenue: number
  pfEbitda: number
  nextAction: string | null
  nextActionDate: string | null
  priority: Opportunity['priority']
  outstandingItems: string[]
  diligenceNotes: string
  /** Legal closing date; only meaningful while Completed. */
  closedAt: string | null
  /** Business creation date as YYYY-MM-DD in the user's time zone; saved to createdAt. */
  createdDate: string | null
}

/** The local calendar day of a stored createdAt, or null when none is recorded. */
export function createdDateInput(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(createdAt)) return createdAt
  const t = new Date(createdAt)
  return Number.isNaN(t.getTime()) ? null : todayDateInput(t)
}

/** A picked YYYY-MM-DD stored at local noon, so reports and displays keep the same day everywhere nearby. */
export function createdAtFromInput(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0).toISOString()
}

/** Problems with the business dates in a draft, or null when they are fine. */
export function draftDateProblem(draft: Pick<OpportunityDraft, 'createdDate' | 'closedAt' | 'status'>, today = todayDateInput()): string | null {
  const ymd = /^\d{4}-\d{2}-\d{2}$/
  if (draft.createdDate != null && !ymd.test(draft.createdDate)) return 'Enter a valid Created date.'
  if (draft.createdDate && draft.createdDate > today) return 'The Created date cannot be in the future.'
  if (draft.status === 'Completed' && draft.closedAt != null) {
    if (!ymd.test(draft.closedAt)) return 'Enter a valid Legally Closed date.'
    if (draft.closedAt > today) return 'The Legally Closed date cannot be in the future.'
    if (draft.createdDate && draft.closedAt < draft.createdDate) return 'The Legally Closed date cannot be before the Created date.'
  }
  return null
}

export function snapshotOpportunityDraft(record: Opportunity): OpportunityDraft {
  return {
    projectName: record.projectName,
    entityName: record.entityName,
    type: record.type,
    status: record.status,
    stage: record.stage,
    dealLead: record.dealLead,
    primaryLeadId: record.primaryLeadId ?? null,
    additionalLeadIds: [...(record.additionalLeadIds ?? [])],
    sourceType: record.sourceType,
    sourceName: record.sourceName,
    specialty: record.specialty,
    geography: record.geography,
    nwp: Number(record.nwp) || 0,
    netRevenue: Number(record.netRevenue) || 0,
    pfEbitda: Number(record.pfEbitda) || 0,
    nextAction: record.nextAction ?? null,
    nextActionDate: record.nextActionDate ?? null,
    priority: record.priority,
    outstandingItems: [...(record.outstandingItems ?? [])],
    diligenceNotes: record.diligenceNotes ?? '',
    closedAt: record.closedAt ?? null,
    createdDate: createdDateInput(record.createdAt),
  }
}

function normalize(draft: OpportunityDraft): string {
  return JSON.stringify({
    ...draft,
    nwp: Number(draft.nwp) || 0,
    netRevenue: Number(draft.netRevenue) || 0,
    pfEbitda: Number(draft.pfEbitda) || 0,
    nextAction: draft.nextAction || null,
    nextActionDate: draft.nextActionDate || null,
    diligenceNotes: draft.diligenceNotes ?? '',
    closedAt: draft.closedAt ?? null,
    createdDate: draft.createdDate ?? null,
    outstandingItems: (draft.outstandingItems ?? []).map((l) => l.trim()).filter(Boolean),
  })
}

export function opportunityDraftsEqual(a: OpportunityDraft, b: OpportunityDraft): boolean {
  return normalize(a) === normalize(b)
}

export function opportunityDraftPatch(
  saved: OpportunityDraft,
  draft: OpportunityDraft,
): OpportunityUpdate {
  const patch: OpportunityUpdate = {}
  for (const key of EDIT_KEYS) {
    if (key === 'outstandingItems') {
      const left = (saved.outstandingItems ?? []).join('\n')
      const right = (draft.outstandingItems ?? []).join('\n')
      if (left !== right) patch.outstandingItems = [...(draft.outstandingItems ?? [])]
      continue
    }
    if (key === 'additionalLeadIds') {
      if (saved.additionalLeadIds.join('\n') !== draft.additionalLeadIds.join('\n')) patch.additionalLeadIds = [...draft.additionalLeadIds]
      continue
    }
    if (saved[key] !== draft[key]) {
      Object.assign(patch, { [key]: draft[key] })
    }
  }
  if (draft.createdDate && draft.createdDate !== saved.createdDate) patch.createdAt = createdAtFromInput(draft.createdDate)
  return patch
}
