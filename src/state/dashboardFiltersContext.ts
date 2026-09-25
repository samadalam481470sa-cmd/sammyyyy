import { createContext } from 'react';
import type { PipelineStageId } from '../config/picklists';
import type { DashboardFilters, FilterDimension, StatusFilterValue } from '../lib/filtering';

export interface DashboardFiltersValue {
  filters: DashboardFilters;
  setStatus: (status: StatusFilterValue) => void;
  setStage: (stage: PipelineStageId | null) => void;
  /** Selecting the stage already in use clears it, so stages act as toggles. */
  toggleStage: (stage: PipelineStageId) => void;
  setAttentionOnly: (value: boolean) => void;
  toggleAttentionOnly: () => void;
  setSearch: (value: string) => void;
  clearFilter: (dimension: FilterDimension) => void;
  clearFilters: () => void;
  isFiltered: boolean;
}

export const DashboardFiltersContext = createContext<DashboardFiltersValue | null>(null);
