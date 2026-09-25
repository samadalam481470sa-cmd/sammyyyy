import type { Opportunity } from '../types/opportunity';
import { getAttentionReasons } from './attention';

const PRIORITY_RANK: Record<Opportunity['priority'], number> = { A: 0, B: 1, C: 2 };

/**
 * Orders opportunities the way an executive would want to see them: deals
 * needing attention first, then by internal priority, then by the most
 * imminent next action.
 */
export function sortByPriority(opportunities: Opportunity[]): Opportunity[] {
  return [...opportunities].sort((a, b) => {
    const attentionDiff = Number(getAttentionReasons(b).length > 0) - Number(getAttentionReasons(a).length > 0);
    if (attentionDiff !== 0) return attentionDiff;

    const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    if (a.nextActionDate && b.nextActionDate) {
      return new Date(a.nextActionDate).getTime() - new Date(b.nextActionDate).getTime();
    }
    if (a.nextActionDate) return -1;
    if (b.nextActionDate) return 1;
    return 0;
  });
}
