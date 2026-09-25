/**
 * Executive KPI calculations. Pure functions over the opportunity dataset —
 * no UI logic is hard-coded around specific numbers, so these recompute
 * correctly as the underlying data (eventually a live API) changes.
 */
import type { Opportunity } from '../types/opportunity';
import { needsAttention } from './attention';

export interface DashboardKpis {
  activeDealCount: number;
  pendingDealCount: number;
  activeNwpTotal: number;
  activePfEbitdaTotal: number;
  needsAttentionCount: number;
}

export function computeDashboardKpis(opportunities: Opportunity[]): DashboardKpis {
  const activeDeals = opportunities.filter((o) => o.status === 'Active');
  const pendingDeals = opportunities.filter((o) => o.status === 'Pending');

  return {
    activeDealCount: activeDeals.length,
    pendingDealCount: pendingDeals.length,
    activeNwpTotal: activeDeals.reduce((sum, o) => sum + o.nwp, 0),
    activePfEbitdaTotal: activeDeals.reduce((sum, o) => sum + o.pfEbitda, 0),
    needsAttentionCount: opportunities.filter(needsAttention).length,
  };
}
