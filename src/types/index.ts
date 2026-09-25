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

/** Everything the dashboard needs for a single render pass. */
export interface DashboardSnapshot {
  opportunities: Opportunity[];
  tasks: TaskItem[];
  activity: ActivityEvent[];
  team: TeamMember[];
  generatedAt: IsoDateTime;
}
