/**
 * "Needs Attention" business logic.
 *
 * Rather than flagging opportunities with a static boolean baked into the
 * mock data, attention is derived from the same fields a real API would
 * return (next action, next action date, last activity date, deal lead).
 * This keeps the KPI count and the alerts list honest reflections of the
 * underlying data — if the dataset changes, these recalculate automatically.
 */
import type { Opportunity } from '../types/opportunity';
import { daysSince, daysUntil } from './dateUtils';

/** Only opportunities still being actively worked are eligible for attention flags. */
const ATTENTION_ELIGIBLE_STATUSES: Opportunity['status'][] = ['Active', 'Pending'];

const STALLED_THRESHOLD_DAYS = 30;
const UPCOMING_DEADLINE_WINDOW_DAYS = 7;

export type AttentionReasonCode =
  | 'overdue_next_action'
  | 'missing_next_action'
  | 'stalled_activity'
  | 'upcoming_deadline'
  | 'missing_owner';

export interface AttentionReason {
  code: AttentionReasonCode;
  label: string;
}

/** Returns every attention reason that currently applies to an opportunity. */
export function getAttentionReasons(opportunity: Opportunity): AttentionReason[] {
  if (!ATTENTION_ELIGIBLE_STATUSES.includes(opportunity.status)) {
    return [];
  }

  const reasons: AttentionReason[] = [];

  if (!opportunity.dealLead.trim()) {
    reasons.push({ code: 'missing_owner', label: 'No deal owner assigned' });
  }

  if (!opportunity.nextAction || !opportunity.nextActionDate) {
    reasons.push({ code: 'missing_next_action', label: 'No next action assigned' });
  } else {
    const diff = daysUntil(opportunity.nextActionDate);
    if (diff < 0) {
      reasons.push({ code: 'overdue_next_action', label: 'Next action overdue' });
    } else if (diff <= UPCOMING_DEADLINE_WINDOW_DAYS) {
      reasons.push({ code: 'upcoming_deadline', label: 'Upcoming deadline within 7 days' });
    }
  }

  if (daysSince(opportunity.lastActivityDate) >= STALLED_THRESHOLD_DAYS) {
    reasons.push({ code: 'stalled_activity', label: 'No activity in 30+ days' });
  }

  return reasons;
}

export function needsAttention(opportunity: Opportunity): boolean {
  return getAttentionReasons(opportunity).length > 0;
}
