import type { Opportunity, OpportunityUpdate } from '@/types'

const EDIT_KEYS = [
  'projectName',
  'entityName',
  'type',
  'status',
  'stage',
  'dealLead',
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
] as const satisfies ReadonlyArray<keyof OpportunityUpdate>

export interface OpportunityDraft {
  projectName: string
  entityName: string
  type: Opportunity['type']
  status: Opportunity['status']
  stage: Opportunity['stage']
  dealLead: string
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
}

export function snapshotOpportunityDraft(record: Opportunity): OpportunityDraft {
  return {
    projectName: record.projectName,
    entityName: record.entityName,
    type: record.type,
    status: record.status,
    stage: record.stage,
    dealLead: record.dealLead,
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
    if (saved[key] !== draft[key]) {
      Object.assign(patch, { [key]: draft[key] })
    }
  }
  return patch
}
