import type { OpportunityStatusId, PipelineStageId } from '../config/picklists';
import { stageIndex, stageLabel, statusLabel } from '../config/picklists';
import type { OpportunityView } from '../types';

export const ALL_STATUSES = 'all';
export type StatusFilterValue = OpportunityStatusId | typeof ALL_STATUSES;

export interface DashboardFilters {
  status: StatusFilterValue;
  stage: PipelineStageId | null;
  attentionOnly: boolean;
  search: string;
}

export const DEFAULT_FILTERS: DashboardFilters = {
  status: ALL_STATUSES,
  stage: null,
  attentionOnly: false,
  search: '',
};

export type FilterDimension = 'status' | 'stage' | 'attention' | 'search';

export function matchesSearch(view: OpportunityView, term: string): boolean {
  const query = term.trim().toLowerCase();
  if (!query) return true;

  return [view.projectName, view.entityName, view.dealLead, view.specialty]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(query));
}

/**
 * Applies the dashboard filters. `ignore` lets a component opt out of one
 * dimension — a facet chart, for example, should not filter itself away.
 */
export function filterOpportunities(
  views: OpportunityView[],
  filters: DashboardFilters,
  ignore: FilterDimension[] = [],
): OpportunityView[] {
  const skip = new Set(ignore);

  return views.filter((view) => {
    if (!skip.has('search') && !matchesSearch(view, filters.search)) return false;
    if (!skip.has('attention') && filters.attentionOnly && !view.needsAttention) return false;
    if (!skip.has('status') && filters.status !== ALL_STATUSES && view.status !== filters.status) {
      return false;
    }
    if (!skip.has('stage') && filters.stage && view.stage !== filters.stage) return false;
    return true;
  });
}

export function hasActiveFilters(filters: DashboardFilters): boolean {
  return (
    filters.status !== ALL_STATUSES ||
    filters.stage !== null ||
    filters.attentionOnly ||
    filters.search.trim().length > 0
  );
}

export interface FilterChip {
  dimension: FilterDimension;
  label: string;
}

/** Human-readable summary of what is currently filtering the dashboard. */
export function describeFilters(filters: DashboardFilters): FilterChip[] {
  const chips: FilterChip[] = [];

  if (filters.status !== ALL_STATUSES) {
    chips.push({ dimension: 'status', label: `Status: ${statusLabel(filters.status)}` });
  }
  if (filters.stage) {
    chips.push({ dimension: 'stage', label: `Stage: ${stageLabel(filters.stage)}` });
  }
  if (filters.attentionOnly) {
    chips.push({ dimension: 'attention', label: 'Needs attention' });
  }
  if (filters.search.trim()) {
    chips.push({ dimension: 'search', label: `Search: “${filters.search.trim()}”` });
  }

  return chips;
}

const PRIORITY_WEIGHT: Record<string, number> = { A: 0, B: 1, C: 2 };

/**
 * Ordering for the Priority Deals table: what needs attention first, then the
 * team's A/B/C priority, then the deals furthest along the process.
 */
export function sortPriorityDeals(views: OpportunityView[]): OpportunityView[] {
  return [...views].sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;

    const priorityDelta = (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9);
    if (priorityDelta !== 0) return priorityDelta;

    const stageDelta = stageIndex(b.stage) - stageIndex(a.stage);
    if (stageDelta !== 0) return stageDelta;

    return b.nwp - a.nwp;
  });
}

/**
 * The status the pipeline and the stage chart describe. Both are about deals
 * in flight, so "All Deals" resolves to Active.
 */
export function resolveScopeStatus(filters: DashboardFilters): OpportunityStatusId {
  return filters.status === ALL_STATUSES ? 'active' : filters.status;
}
