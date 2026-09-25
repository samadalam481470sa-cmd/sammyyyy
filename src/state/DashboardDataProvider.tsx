import type { ReactNode } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { DashboardDataContext } from './dashboardDataContext';

/**
 * Loads the acquisition dataset once and shares it with the shell (header
 * alerts) and the dashboard widgets.
 */
export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const data = useDashboardData();
  return <DashboardDataContext.Provider value={data}>{children}</DashboardDataContext.Provider>;
}
