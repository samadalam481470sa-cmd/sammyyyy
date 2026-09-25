import { useEffect, useMemo, useState } from 'react';
import { toOpportunityViews } from '../lib/attention';
import { fetchDashboardSnapshot } from '../services/dashboardService';
import type { DashboardSnapshot, OpportunityView } from '../types';

export interface DashboardData {
  isLoading: boolean;
  error: Error | null;
  snapshot: DashboardSnapshot | null;
  /** Opportunities enriched with derived attention/date values. */
  opportunities: OpportunityView[];
  opportunitiesById: Map<string, OpportunityView>;
}

/**
 * Loads the dashboard snapshot through the service layer. The async shape is
 * intentional: pointing `fetchDashboardSnapshot` at a real API is the only
 * change required to run this dashboard on live data.
 */
export function useDashboardData(): DashboardData {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchDashboardSnapshot()
      .then((result) => {
        if (cancelled) return;
        setSnapshot(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause : new Error('Unable to load dashboard data'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const opportunities = useMemo(
    () => (snapshot ? toOpportunityViews(snapshot.opportunities) : []),
    [snapshot],
  );

  const opportunitiesById = useMemo(
    () => new Map(opportunities.map((opportunity) => [opportunity.id, opportunity])),
    [opportunities],
  );

  return { isLoading, error, snapshot, opportunities, opportunitiesById };
}
