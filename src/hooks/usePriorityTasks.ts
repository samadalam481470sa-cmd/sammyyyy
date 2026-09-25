/** Data-access hook for "This Week's Priorities" tasks. See useOpportunities.ts for rationale. */
import { useMemo } from 'react';
import { MOCK_PRIORITY_TASKS } from '../data/mockTasks';
import type { PriorityTask } from '../types/opportunity';

export function usePriorityTasks(): PriorityTask[] {
  return useMemo(() => MOCK_PRIORITY_TASKS, []);
}
