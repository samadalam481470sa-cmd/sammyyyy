/**
 * Data-access hook for acquisition opportunities.
 *
 * Today this returns the local mock dataset synchronously. It is written as
 * a hook (rather than a plain import) so a future version can fetch from a
 * real API/database — swap the body for a `fetch`/react-query call and no
 * consuming component needs to change.
 */
import { useMemo } from 'react';
import { MOCK_OPPORTUNITIES } from '../data/mockOpportunities';
import type { Opportunity } from '../types/opportunity';

export interface UseOpportunitiesResult {
  opportunities: Opportunity[];
  isLoading: boolean;
  error: Error | null;
}

export function useOpportunities(): UseOpportunitiesResult {
  const opportunities = useMemo(() => MOCK_OPPORTUNITIES, []);

  return {
    opportunities,
    isLoading: false,
    error: null,
  };
}
