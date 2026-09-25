/**
 * Centralised pick-lists for the acquisition CRM.
 *
 * Every dropdown, badge, chart series and filter reads from these lists so the
 * sponsor can rename or re-order values in one place. Nothing in the UI should
 * hard-code a status, stage, type or source string.
 */

export type BadgeTone =
  | 'emerald'
  | 'amber'
  | 'slate'
  | 'accent'
  | 'rose'
  | 'stone'
  | 'teal'
  | 'navy';

export interface PicklistOption<TId extends string = string> {
  id: TId;
  label: string;
  description?: string;
}

/* -------------------------------------------------------------------------- */
/* Status — the broad condition of an opportunity.                            */
/* Status is deliberately NOT the same concept as Stage.                      */
/* -------------------------------------------------------------------------- */

export const OPPORTUNITY_STATUSES = [
  {
    id: 'active',
    label: 'Active',
    description: 'Being actively worked by the deal team',
    tone: 'emerald',
    chartColor: '#0f766e',
  },
  {
    id: 'pending',
    label: 'Pending',
    description: 'Awaiting information or an internal decision',
    tone: 'amber',
    chartColor: '#d97706',
  },
  {
    id: 'inactive',
    label: 'Inactive',
    description: 'Paused — may be revisited later',
    tone: 'slate',
    chartColor: '#94a3b8',
  },
  {
    id: 'closed',
    label: 'Closed',
    description: 'Transaction closed',
    tone: 'accent',
    chartColor: '#1c90ec',
  },
  {
    id: 'declined',
    label: 'Declined',
    description: 'Newport elected not to proceed',
    tone: 'rose',
    chartColor: '#e11d48',
  },
  {
    id: 'withdrew',
    label: 'Withdrew',
    description: 'Counterparty withdrew from the process',
    tone: 'stone',
    chartColor: '#78716c',
  },
  {
    id: 'completed',
    label: 'Completed',
    description: 'Integration complete',
    tone: 'navy',
    chartColor: '#0f2542',
  },
] as const satisfies readonly (PicklistOption & {
  tone: BadgeTone;
  chartColor: string;
})[];

export type OpportunityStatusId = (typeof OPPORTUNITY_STATUSES)[number]['id'];

/* -------------------------------------------------------------------------- */
/* Stage — where a deal sits inside the acquisition process.                   */
/* Preliminary names, pending sponsor confirmation. Renaming or re-ordering    */
/* this array updates the pipeline, charts, filters and drawer automatically.  */
/* -------------------------------------------------------------------------- */

export const PIPELINE_STAGES = [
  { id: 'target_identified', label: 'Target Identified', shortLabel: 'Target ID' },
  { id: 'initial_outreach', label: 'Initial Outreach', shortLabel: 'Outreach' },
  { id: 'preliminary_discussion', label: 'Preliminary Discussion', shortLabel: 'Prelim.' },
  { id: 'nda', label: 'NDA', shortLabel: 'NDA' },
  { id: 'initial_review', label: 'Initial Review', shortLabel: 'Review' },
  { id: 'ioi_loi', label: 'IOI / LOI', shortLabel: 'IOI / LOI' },
  { id: 'exclusivity', label: 'Exclusivity', shortLabel: 'Exclusivity' },
  { id: 'due_diligence', label: 'Due Diligence', shortLabel: 'Diligence' },
  { id: 'closing', label: 'Closing', shortLabel: 'Closing' },
] as const satisfies readonly (PicklistOption & { shortLabel: string })[];

export type PipelineStageId = (typeof PIPELINE_STAGES)[number]['id'];

/* -------------------------------------------------------------------------- */
/* Opportunity type                                                            */
/* -------------------------------------------------------------------------- */

export const OPPORTUNITY_TYPES = [
  { id: 'platform', label: 'Platform Acquisition' },
  { id: 'add_on', label: 'Add-on Acquisition' },
  { id: 'organic', label: 'Organic Growth Initiative' },
  { id: 'carrier_capacity', label: 'Carrier Capacity' },
] as const satisfies readonly PicklistOption[];

export type OpportunityTypeId = (typeof OPPORTUNITY_TYPES)[number]['id'];

/* -------------------------------------------------------------------------- */
/* Source type                                                                 */
/* -------------------------------------------------------------------------- */

export const SOURCE_TYPES = [
  { id: 'investment_banker', label: 'Investment Banker' },
  { id: 'intermediary', label: 'Intermediary' },
  { id: 'direct_mga', label: 'Direct MGA Relationship' },
  { id: 'carrier_partner', label: 'Carrier Partner' },
  { id: 'other', label: 'Other' },
] as const satisfies readonly PicklistOption[];

export type SourceTypeId = (typeof SOURCE_TYPES)[number]['id'];

/* -------------------------------------------------------------------------- */
/* Priority — Newport's A / B / C working convention                           */
/* -------------------------------------------------------------------------- */

export const PRIORITY_LEVELS = [
  { id: 'A', label: 'A', description: 'Must move this week', tone: 'rose' },
  { id: 'B', label: 'B', description: 'Important but can wait', tone: 'amber' },
  { id: 'C', label: 'C', description: 'Monitor only', tone: 'slate' },
] as const satisfies readonly (PicklistOption & { tone: BadgeTone })[];

export type PriorityId = (typeof PRIORITY_LEVELS)[number]['id'];

/* -------------------------------------------------------------------------- */
/* Attention rules — thresholds are configurable, not scattered in components  */
/* -------------------------------------------------------------------------- */

export const ATTENTION_RULES = {
  /** Attention rules only apply to opportunities still in play. */
  appliesToStatuses: ['active', 'pending'] as OpportunityStatusId[],
  /** An opportunity with no activity for this many days is treated as stalled. */
  stalledActivityDays: 30,
  /** A critical date inside this window is surfaced as an upcoming deadline. */
  upcomingDeadlineDays: 7,
} as const;

export const ATTENTION_REASONS = [
  { id: 'overdue_next_action', label: 'Next action overdue', severity: 'high' },
  { id: 'missing_next_action', label: 'No next action assigned', severity: 'high' },
  { id: 'stalled_activity', label: 'No activity in 30+ days', severity: 'medium' },
  { id: 'upcoming_deadline', label: 'Upcoming deadline within 7 days', severity: 'medium' },
  { id: 'missing_deal_lead', label: 'No deal owner assigned', severity: 'high' },
  { id: 'flagged', label: 'Flagged by the deal team', severity: 'low' },
] as const satisfies readonly (PicklistOption & {
  severity: 'high' | 'medium' | 'low';
})[];

export type AttentionReasonId = (typeof ATTENTION_REASONS)[number]['id'];

/* -------------------------------------------------------------------------- */
/* Lookup helpers                                                              */
/* -------------------------------------------------------------------------- */

function buildLookup<TOption extends { id: string }>(
  options: readonly TOption[],
): (id: string) => TOption | undefined {
  const map = new Map(options.map((option) => [option.id, option]));
  return (id: string) => map.get(id);
}

export const getStatus = buildLookup(OPPORTUNITY_STATUSES);
export const getStage = buildLookup(PIPELINE_STAGES);
export const getOpportunityType = buildLookup(OPPORTUNITY_TYPES);
export const getSourceType = buildLookup(SOURCE_TYPES);
export const getPriority = buildLookup(PRIORITY_LEVELS);
export const getAttentionReason = buildLookup(ATTENTION_REASONS);

export function statusLabel(id: OpportunityStatusId): string {
  return getStatus(id)?.label ?? id;
}

export function stageLabel(id: PipelineStageId): string {
  return getStage(id)?.label ?? id;
}

/** Index of a stage in the acquisition process, used for sorting and shading. */
export function stageIndex(id: PipelineStageId): number {
  return PIPELINE_STAGES.findIndex((stage) => stage.id === id);
}
