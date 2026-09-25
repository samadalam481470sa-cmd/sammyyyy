import type { OpportunityStatusId, PipelineStageId } from '../config/picklists';
import { OPPORTUNITY_STATUSES, PIPELINE_STAGES } from '../config/picklists';
import type { OpportunityView } from '../types';

export interface DashboardMetrics {
  activeCount: number;
  pendingCount: number;
  activeNwp: number;
  activePfEbitda: number;
  attentionCount: number;
  totalCount: number;
}

function sum(views: OpportunityView[], pick: (view: OpportunityView) => number): number {
  return views.reduce((total, view) => total + pick(view), 0);
}

/**
 * Executive KPIs. These describe the book of business, so they respond to
 * search scope but keep their meaning regardless of the status/stage filters.
 */
export function summarizeOpportunities(views: OpportunityView[]): DashboardMetrics {
  const active = views.filter((view) => view.status === 'active');
  const pending = views.filter((view) => view.status === 'pending');

  return {
    activeCount: active.length,
    pendingCount: pending.length,
    activeNwp: sum(active, (view) => view.nwp),
    activePfEbitda: sum(active, (view) => view.pfEbitda),
    attentionCount: views.filter((view) => view.needsAttention).length,
    totalCount: views.length,
  };
}

export interface StageSummary {
  id: PipelineStageId;
  label: string;
  shortLabel: string;
  count: number;
  nwp: number;
  /** Share of the largest stage count, used for the pipeline bars. */
  intensity: number;
}

export function buildStageSummary(views: OpportunityView[]): StageSummary[] {
  const summaries = PIPELINE_STAGES.map((stage) => {
    const inStage = views.filter((view) => view.stage === stage.id);
    return {
      id: stage.id,
      label: stage.label,
      shortLabel: stage.shortLabel,
      count: inStage.length,
      nwp: sum(inStage, (view) => view.nwp),
      intensity: 0,
    } satisfies StageSummary;
  });

  const maxCount = Math.max(1, ...summaries.map((summary) => summary.count));
  return summaries.map((summary) => ({ ...summary, intensity: summary.count / maxCount }));
}

export interface StatusSummary {
  id: OpportunityStatusId;
  label: string;
  count: number;
  nwp: number;
  color: string;
}

export function buildStatusSummary(views: OpportunityView[]): StatusSummary[] {
  return OPPORTUNITY_STATUSES.map((status) => {
    const inStatus = views.filter((view) => view.status === status.id);
    return {
      id: status.id,
      label: status.label,
      count: inStatus.length,
      nwp: sum(inStatus, (view) => view.nwp),
      color: status.chartColor,
    } satisfies StatusSummary;
  });
}
