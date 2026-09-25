import { useContext } from 'react';
import { DashboardDataContext } from '../state/dashboardDataContext';
import type { DashboardData } from './useDashboardData';

export function useDashboard(): DashboardData {
  const value = useContext(DashboardDataContext);
  if (!value) {
    throw new Error('useDashboard must be used inside a DashboardDataProvider');
  }
  return value;
}
