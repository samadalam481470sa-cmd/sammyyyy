import type {
  OpportunityTypeId,
  SourceTypeId,
  StageId,
  StatusId,
  TaskPriorityId,
} from '../config/picklists'

/**
 * Core acquisition opportunity record.
 * Monetary values are stored in whole US dollars.
 * Dates are ISO strings (YYYY-MM-DD) so records serialize cleanly from an API.
 */
export interface Opportunity {
  id: string
  /** Confidential project code name — the primary identifier shown in the UI. */
  projectName: string
  /** The actual target entity. Displayed with less prominence than the code name. */
  entityName: string
  type: OpportunityTypeId
  status: StatusId
  /** Stage only applies while a deal is progressing through the process. */
  stage: StageId
  dealLead: string | null
  sourceType: SourceTypeId
  sourceName: string
  specialty: string
  geography: string
  /** Net Written Premium, USD. */
  nwp: number
  netRevenue: number
  /** Pro Forma EBITDA, USD. */
  pfEbitda: number
  nextAction: string | null
  nextActionDate: string | null
  priority: TaskPriorityId
  lastActivityDate: string
}

/** Reasons an opportunity is flagged for attention — derived, never stored. */
export type AttentionReasonKind =
  | 'overdue-next-action'
  | 'missing-next-action'
  | 'stalled'
  | 'upcoming-deadline'
  | 'no-deal-lead'

export interface AttentionReason {
  kind: AttentionReasonKind
  message: string
}

/** Opportunity enriched with derived attention info by the data layer. */
export interface EnrichedOpportunity extends Opportunity {
  needsAttention: boolean
  attentionReasons: AttentionReason[]
}

export interface PriorityTask {
  id: string
  priority: TaskPriorityId
  action: string
  projectName: string
  owner: string
  dueDate: string
}

export type ActivityKind =
  | 'stage-change'
  | 'status-change'
  | 'note'
  | 'document'
  | 'loi'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  message: string
  /** ISO timestamp of when the activity occurred. */
  timestamp: string
}

export interface CurrentUser {
  firstName: string
  lastName: string
  initials: string
}
