/**
 * Centralized configuration for pick-list values used across the CRM.
 *
 * Stage names, status names, and other list values are intentionally kept
 * here instead of scattered as string literals throughout components. Stage
 * names in particular are described as "preliminary" and may change after
 * sponsor feedback — updating this file is the single place needed to
 * rename, reorder, or restyle a value everywhere it appears in the app.
 */
import type {
  OpportunityStage,
  OpportunityStatus,
  OpportunityType,
  PriorityLevel,
  SourceType,
} from '../types/opportunity';

export interface StageConfig {
  id: OpportunityStage;
  label: string;
  shortLabel: string;
  description: string;
}

/** Ordered list of acquisition-process stages. Order drives pipeline display order. */
export const STAGES: StageConfig[] = [
  { id: 'Target Identified', label: 'Target Identified', shortLabel: 'Identified', description: 'Prospective target has been identified but not yet contacted.' },
  { id: 'Initial Outreach', label: 'Initial Outreach', shortLabel: 'Outreach', description: 'Initial contact has been made with the target or its representatives.' },
  { id: 'Preliminary Discussion', label: 'Preliminary Discussion', shortLabel: 'Discussion', description: 'Early conversations are underway to gauge mutual interest.' },
  { id: 'NDA', label: 'NDA', shortLabel: 'NDA', description: 'A non-disclosure agreement is in place or being negotiated.' },
  { id: 'Initial Review', label: 'Initial Review', shortLabel: 'Review', description: 'Newport is reviewing preliminary financial and operating materials.' },
  { id: 'IOI / LOI', label: 'IOI / LOI', shortLabel: 'IOI / LOI', description: 'An indication or letter of intent has been submitted or is in negotiation.' },
  { id: 'Exclusivity', label: 'Exclusivity', shortLabel: 'Exclusivity', description: 'Deal is under an exclusivity period ahead of full diligence.' },
  { id: 'Due Diligence', label: 'Due Diligence', shortLabel: 'Diligence', description: 'Formal financial, legal, and operational diligence is underway.' },
  { id: 'Closing', label: 'Closing', shortLabel: 'Closing', description: 'Final documentation and closing mechanics are in progress.' },
];

export const STAGE_ORDER: OpportunityStage[] = STAGES.map((s) => s.id);

export interface StatusConfig {
  id: OpportunityStatus;
  label: string;
  /** Tailwind utility classes for the status pill. */
  badgeClassName: string;
  dotClassName: string;
}

/** Full status list, including the synthetic "All Deals" filter option. */
export const STATUSES: StatusConfig[] = [
  { id: 'Active', label: 'Active', badgeClassName: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dotClassName: 'bg-emerald-500' },
  { id: 'Pending', label: 'Pending', badgeClassName: 'bg-amber-50 text-amber-700 ring-amber-600/20', dotClassName: 'bg-amber-500' },
  { id: 'Inactive', label: 'Inactive', badgeClassName: 'bg-slate-100 text-slate-600 ring-slate-500/20', dotClassName: 'bg-slate-400' },
  { id: 'Closed', label: 'Closed', badgeClassName: 'bg-navy-50 text-navy-700 ring-navy-600/20', dotClassName: 'bg-navy-600' },
  { id: 'Declined', label: 'Declined', badgeClassName: 'bg-rose-50 text-rose-700 ring-rose-600/20', dotClassName: 'bg-rose-500' },
  { id: 'Withdrew', label: 'Withdrew', badgeClassName: 'bg-orange-50 text-orange-700 ring-orange-600/20', dotClassName: 'bg-orange-500' },
  { id: 'Completed', label: 'Completed', badgeClassName: 'bg-accent-100 text-accent-700 ring-accent-600/30', dotClassName: 'bg-accent-500' },
];

export type StatusFilterValue = 'All' | OpportunityStatus;

export const STATUS_FILTER_OPTIONS: { id: StatusFilterValue; label: string }[] = [
  { id: 'All', label: 'All Deals' },
  ...STATUSES.map((s) => ({ id: s.id as StatusFilterValue, label: s.label })),
];

export function getStatusConfig(status: OpportunityStatus): StatusConfig {
  return STATUSES.find((s) => s.id === status) ?? STATUSES[0];
}

export function getStageConfig(stage: OpportunityStage): StageConfig {
  return STAGES.find((s) => s.id === stage) ?? STAGES[0];
}

/** Selectable opportunity types (deal structure). */
export const OPPORTUNITY_TYPES: OpportunityType[] = [
  'Platform Acquisition',
  'Add-on Acquisition',
  'Organic Growth Initiative',
  'Carrier Capacity',
];

/** Selectable source types (who originated the opportunity). */
export const SOURCE_TYPES: SourceType[] = [
  'Investment Banker',
  'Intermediary',
  'Direct MGA Relationship',
  'Carrier Partner',
  'Other',
];

export interface PriorityConfig {
  id: PriorityLevel;
  label: string;
  description: string;
  badgeClassName: string;
}

export const PRIORITY_LEVELS: PriorityConfig[] = [
  { id: 'A', label: 'A', description: 'Must move this week', badgeClassName: 'bg-navy-800 text-white' },
  { id: 'B', label: 'B', description: 'Important, can wait', badgeClassName: 'bg-accent-100 text-accent-700' },
  { id: 'C', label: 'C', description: 'Monitor only', badgeClassName: 'bg-slate-100 text-slate-600' },
];

export function getPriorityConfig(priority: PriorityLevel): PriorityConfig {
  return PRIORITY_LEVELS.find((p) => p.id === priority) ?? PRIORITY_LEVELS[2];
}
