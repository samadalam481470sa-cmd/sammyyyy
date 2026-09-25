import { ATTENTION_RULES, getAttentionReason } from '../config/picklists';
import type { AttentionFlag, Opportunity, OpportunityView } from '../types';
import { daysSince, daysUntil, formatDateShort } from './format';

function flag(
  reason: AttentionFlag['reason'],
  detail: string,
): AttentionFlag {
  const config = getAttentionReason(reason);
  return {
    reason,
    label: config?.label ?? reason,
    severity: config?.severity ?? 'medium',
    detail,
  };
}

/**
 * Derives why an opportunity needs attention. Thresholds live in
 * `ATTENTION_RULES` so the sponsor can tune them without touching components.
 */
export function deriveAttentionFlags(
  opportunity: Opportunity,
  now: Date = new Date(),
): AttentionFlag[] {
  if (!ATTENTION_RULES.appliesToStatuses.includes(opportunity.status)) return [];

  const flags: AttentionFlag[] = [];

  if (!opportunity.nextAction) {
    flags.push(flag('missing_next_action', 'Nothing scheduled for this opportunity'));
  } else if (opportunity.nextActionDate) {
    const days = daysUntil(opportunity.nextActionDate, now);
    if (days < 0) {
      const overdue = Math.abs(days);
      flags.push(
        flag('overdue_next_action', `${opportunity.nextAction} — ${overdue} day${overdue === 1 ? '' : 's'} overdue`),
      );
    }
  }

  const sinceActivity = daysSince(opportunity.lastActivityDate, now);
  if (sinceActivity >= ATTENTION_RULES.stalledActivityDays) {
    flags.push(flag('stalled_activity', `Last activity ${sinceActivity} days ago`));
  }

  if (opportunity.criticalDate) {
    const days = daysUntil(opportunity.criticalDate, now);
    if (days >= 0 && days <= ATTENTION_RULES.upcomingDeadlineDays) {
      const label = opportunity.criticalDateLabel ?? 'Deadline';
      flags.push(
        flag(
          'upcoming_deadline',
          `${label} ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`} (${formatDateShort(opportunity.criticalDate, now)})`,
        ),
      );
    }
  }

  if (!opportunity.dealLead) {
    flags.push(flag('missing_deal_lead', 'Opportunity has no deal lead'));
  }

  if (opportunity.flaggedForAttention) {
    flags.push(flag('flagged', 'Manually flagged by the deal team'));
  }

  return flags;
}

/** Wraps an opportunity with the values the UI derives from it. */
export function toOpportunityView(
  opportunity: Opportunity,
  now: Date = new Date(),
): OpportunityView {
  const attentionFlags = deriveAttentionFlags(opportunity, now);
  return {
    ...opportunity,
    attentionFlags,
    needsAttention: attentionFlags.length > 0,
    daysUntilNextAction: opportunity.nextActionDate
      ? daysUntil(opportunity.nextActionDate, now)
      : null,
    daysSinceLastActivity: daysSince(opportunity.lastActivityDate, now),
  };
}

export function toOpportunityViews(
  opportunities: Opportunity[],
  now: Date = new Date(),
): OpportunityView[] {
  return opportunities.map((opportunity) => toOpportunityView(opportunity, now));
}

const SEVERITY_WEIGHT: Record<AttentionFlag['severity'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Highest-severity flag first — used for card ordering and row indicators. */
export function sortByAttentionSeverity(views: OpportunityView[]): OpportunityView[] {
  return [...views].sort((a, b) => {
    const aWeight = Math.min(...a.attentionFlags.map((item) => SEVERITY_WEIGHT[item.severity]));
    const bWeight = Math.min(...b.attentionFlags.map((item) => SEVERITY_WEIGHT[item.severity]));
    if (aWeight !== bWeight) return aWeight - bWeight;
    return b.attentionFlags.length - a.attentionFlags.length;
  });
}
