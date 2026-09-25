import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { PipelineStageId } from '../config/picklists';
import {
  ALL_STATUSES,
  DEFAULT_FILTERS,
  hasActiveFilters,
  type DashboardFilters,
  type FilterDimension,
  type StatusFilterValue,
} from '../lib/filtering';
import { DashboardFiltersContext, type DashboardFiltersValue } from './dashboardFiltersContext';

/**
 * Filter state lives above the routes so the global search in the header and
 * the dashboard widgets stay in sync, and so future modules can reuse it.
 */
export function DashboardFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);

  const setStatus = useCallback((status: StatusFilterValue) => {
    setFilters((current) => ({ ...current, status }));
  }, []);

  const setStage = useCallback((stage: PipelineStageId | null) => {
    setFilters((current) => ({ ...current, stage }));
  }, []);

  const toggleStage = useCallback((stage: PipelineStageId) => {
    setFilters((current) => ({ ...current, stage: current.stage === stage ? null : stage }));
  }, []);

  const setAttentionOnly = useCallback((value: boolean) => {
    setFilters((current) => ({ ...current, attentionOnly: value }));
  }, []);

  const toggleAttentionOnly = useCallback(() => {
    setFilters((current) => ({ ...current, attentionOnly: !current.attentionOnly }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setFilters((current) => ({ ...current, search }));
  }, []);

  const clearFilter = useCallback((dimension: FilterDimension) => {
    setFilters((current) => {
      switch (dimension) {
        case 'status':
          return { ...current, status: ALL_STATUSES };
        case 'stage':
          return { ...current, stage: null };
        case 'attention':
          return { ...current, attentionOnly: false };
        case 'search':
          return { ...current, search: '' };
        default:
          return current;
      }
    });
  }, []);

  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const value = useMemo<DashboardFiltersValue>(
    () => ({
      filters,
      setStatus,
      setStage,
      toggleStage,
      setAttentionOnly,
      toggleAttentionOnly,
      setSearch,
      clearFilter,
      clearFilters,
      isFiltered: hasActiveFilters(filters),
    }),
    [
      filters,
      setStatus,
      setStage,
      toggleStage,
      setAttentionOnly,
      toggleAttentionOnly,
      setSearch,
      clearFilter,
      clearFilters,
    ],
  );

  return (
    <DashboardFiltersContext.Provider value={value}>{children}</DashboardFiltersContext.Provider>
  );
}
