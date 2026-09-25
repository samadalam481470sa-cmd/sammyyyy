/**
 * Central filtering state for the dashboard.
 *
 * Keeping this logic in one hook (rather than duplicated across the
 * pipeline, table, charts, and alerts components) guarantees every section
 * of the dashboard reacts consistently to the status filter, stage
 * selection, attention toggle, and global search.
 */
import { useCallback, useMemo, useState } from 'react';
import type { Opportunity, OpportunityStage } from '../types/opportunity';
import type { StatusFilterValue } from '../data/constants';
import { getAttentionReasons } from '../lib/attention';

export interface DashboardFiltersState {
  statusFilter: StatusFilterValue;
  stageFilter: OpportunityStage | null;
  attentionOnly: boolean;
  search: string;
}

export interface UseDashboardFiltersResult extends DashboardFiltersState {
  setStatusFilter: (value: StatusFilterValue) => void;
  selectStage: (stage: OpportunityStage) => void;
  toggleAttentionOnly: () => void;
  setSearch: (value: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  /** Opportunities after applying only the search box (used to drive the pipeline overview). */
  searchedOpportunities: Opportunity[];
  /** Opportunities after applying every active filter (used by the table + charts). */
  filteredOpportunities: Opportunity[];
}

const DEFAULT_STATE: DashboardFiltersState = {
  statusFilter: 'All',
  stageFilter: null,
  attentionOnly: false,
  search: '',
};

export function useDashboardFilters(opportunities: Opportunity[]): UseDashboardFiltersResult {
  const [state, setState] = useState<DashboardFiltersState>(DEFAULT_STATE);

  const setStatusFilter = useCallback((value: StatusFilterValue) => {
    setState((prev) => ({ ...prev, statusFilter: value, stageFilter: null, attentionOnly: false }));
  }, []);

  const selectStage = useCallback((stage: OpportunityStage) => {
    setState((prev) => ({
      ...prev,
      // Stages are a property of active pipeline work, so selecting one
      // scopes the status filter to Active as well.
      statusFilter: 'Active',
      stageFilter: prev.stageFilter === stage ? null : stage,
      attentionOnly: false,
    }));
  }, []);

  const toggleAttentionOnly = useCallback(() => {
    setState((prev) => ({
      ...prev,
      attentionOnly: !prev.attentionOnly,
      stageFilter: null,
    }));
  }, []);

  const setSearch = useCallback((value: string) => {
    setState((prev) => ({ ...prev, search: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const searchedOpportunities = useMemo(() => {
    const query = state.search.trim().toLowerCase();
    if (!query) return opportunities;
    return opportunities.filter(
      (o) => o.projectName.toLowerCase().includes(query) || o.entityName.toLowerCase().includes(query),
    );
  }, [opportunities, state.search]);

  const filteredOpportunities = useMemo(() => {
    return searchedOpportunities
      .filter((o) => (state.statusFilter === 'All' ? true : o.status === state.statusFilter))
      .filter((o) => (state.stageFilter ? o.stage === state.stageFilter : true))
      .filter((o) => (state.attentionOnly ? getAttentionReasons(o).length > 0 : true));
  }, [searchedOpportunities, state.statusFilter, state.stageFilter, state.attentionOnly]);

  const hasActiveFilters =
    state.statusFilter !== 'All' || state.stageFilter !== null || state.attentionOnly || state.search.trim() !== '';

  return {
    ...state,
    setStatusFilter,
    selectStage,
    toggleAttentionOnly,
    setSearch,
    clearFilters,
    hasActiveFilters,
    searchedOpportunities,
    filteredOpportunities,
  };
}
