/** Data-access hook for the recent activity feed. See useOpportunities.ts for rationale. */
import { useMemo } from 'react';
import { MOCK_ACTIVITY } from '../data/mockActivity';
import type { ActivityItem } from '../types/opportunity';

export function useRecentActivity(): ActivityItem[] {
  return useMemo(() => MOCK_ACTIVITY, []);
}
