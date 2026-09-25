import { useContext } from 'react';
import { DashboardFiltersContext, type DashboardFiltersValue } from '../state/dashboardFiltersContext';

export function useDashboardFilters(): DashboardFiltersValue {
  const value = useContext(DashboardFiltersContext);
  if (!value) {
    throw new Error('useDashboardFilters must be used inside a DashboardFiltersProvider');
  }
  return value;
}
