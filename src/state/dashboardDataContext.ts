import { createContext } from 'react';
import type { DashboardData } from '../hooks/useDashboardData';

export const DashboardDataContext = createContext<DashboardData | null>(null);
