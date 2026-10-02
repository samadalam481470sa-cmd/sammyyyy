import type {
  AttentionReasonId,
  OpportunityStatusId,
  OpportunityTypeId,
  PipelineStageId,
  PriorityId,
  SourceTypeId,
} from '../config/picklists';

/** ISO-8601 date-time string, e.g. `2026-04-18T14:00:00.000Z`. */
export type IsoDateTime = string;

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  title: string;
}

/**
 * An acquisition opportunity. Newport tracks whole companies (MGAs), so a
 * record is a target business rather than a sales lead.
 *
 * `status` (broad condition) and `stage` (position in the acquisition process)
 * are intentionally independent fields.
 */
export interface Opportunity {
  id: string;
  /** Confidential code name — the primary identifier used across the UI. */
  projectName: string;
  /** Legal/trading name of the target business. */
  entityName: string;
  type: OpportunityTypeId;
  status: OpportunityStatusId;
  stage: PipelineStageId;
  /** `null` when no owner has been assigned yet. */
  dealLead: string | null;
  sourceType: SourceTypeId;
  sourceName: string;
  specialty: string;
  geography: string;
  /** Net Written Premium, in USD. */
  nwp: number;
  /** Net revenue, in USD. */
  netRevenue: number;
  /** Pro forma EBITDA, in USD. */
  pfEbitda: number;
  nextAction: string | null;
  nextActionDate: IsoDateTime | null;
  priority: PriorityId;
  lastActivityDate: IsoDateTime;
  /** A hard process deadline (exclusivity expiry, bid date, funding date…). */
  criticalDate?: IsoDateTime;
  criticalDateLabel?: string;
  /** Manually raised by the deal team, in addition to the derived rules. */
  flaggedForAttention?: boolean;
}

export interface AttentionFlag {
  reason: AttentionReasonId;
  label: string;
  severity: 'high' | 'medium' | 'low';
  /** Short, human-readable context, e.g. "Overdue by 3 days". */
  detail: string;
}

/**
 * An opportunity plus the values derived from it. Components read the view
 * model so attention rules and date maths live in one place.
 */
export interface OpportunityView extends Opportunity {
  attentionFlags: AttentionFlag[];
  needsAttention: boolean;
  /** Negative when overdue, `null` when there is no next action date. */
  daysUntilNextAction: number | null;
  daysSinceLastActivity: number;
}

export interface TaskItem {
  id: string;
  priority: PriorityId;
  action: string;
  opportunityId: string;
  owner: string;
  dueDate: IsoDateTime;
}

export type ActivityKind =
  | 'stage_change'
  | 'status_change'
  | 'note'
  | 'document'
  | 'meeting'
  | 'task';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  /** Pre-composed summary, e.g. "moved Project Guardian to NDA". */
  description: string;
  actor: string;
  opportunityId: string;
  timestamp: IsoDateTime;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  organization: string;
  relationshipType: 'target_management' | 'banker' | 'intermediary' | 'carrier' | 'internal';
  email: string;
  phone: string;
  opportunityIds: string[];
}

export interface CarrierPartner {
  id: string;
  name: string;
  type: 'carrier' | 'reinsurer' | 'capacity';
  specialty: string;
  relationshipOwner: string;
  activeDeals: number;
  notes: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  category: 'nda' | 'ioi' | 'loi' | 'diligence' | 'financials' | 'other';
  opportunityId: string;
  uploadedBy: string;
  uploadedAt: IsoDateTime;
  status: 'draft' | 'final' | 'shared';
}

/** Everything the CRM shell needs for a single render pass. */
export interface DashboardSnapshot {
  opportunities: Opportunity[];
  tasks: TaskItem[];
  activity: ActivityEvent[];
  team: TeamMember[];
  contacts: Contact[];
  carriers: CarrierPartner[];
  documents: DocumentRecord[];
  generatedAt: IsoDateTime;
}

export interface NewOpportunityInput {
  projectName: string;
  entityName: string;
  type: Opportunity['type'];
  status: Opportunity['status'];
  stage: Opportunity['stage'];
  dealLead: string;
  specialty: string;
  geography: string;
  nwp: number;
  netRevenue: number;
  pfEbitda: number;
  nextAction: string;
  nextActionDate: string;
  priority: Opportunity['priority'];
  sourceType: Opportunity['sourceType'];
  sourceName: string;
}

export interface NewTaskInput {
  priority: TaskItem['priority'];
  action: string;
  opportunityId: string;
  owner: string;
  dueDate: string;
}

export interface NewActivityInput {
  kind: ActivityKind;
  description: string;
  opportunityId: string;
  actor: string;
}
