import type {
  ActivityItem,
  AttentionReason,
  CurrentUser,
  EnrichedOpportunity,
  Opportunity,
  PriorityTask,
} from '../types'
import { daysUntil, formatDate } from '../lib/format'
import { currentUser, opportunities, priorityTasks, recentActivity } from './mockData'

/**
 * Data-access layer.
 *
 * Components read exclusively through these functions, so swapping the mock
 * data for real database/API calls later only requires changing this module
 * (e.g. converting these to async fetches or React Query hooks).
 */

const STALLED_AFTER_DAYS = 30
const DEADLINE_WARNING_DAYS = 7

/** Stages where an approaching next-action date is treated as a critical deadline. */
const CRITICAL_DEADLINE_STAGES = new Set(['exclusivity', 'closing', 'due-diligence'])

/** Statuses where a deal is being actively worked and attention rules apply. */
const IN_FLIGHT_STATUSES = new Set(['active', 'pending'])

export function deriveAttentionReasons(opp: Opportunity): AttentionReason[] {
  if (!IN_FLIGHT_STATUSES.has(opp.status)) return []

  const reasons: AttentionReason[] = []

  if (!opp.dealLead) {
    reasons.push({ kind: 'no-deal-lead', message: 'No deal owner assigned' })
  }

  if (!opp.nextAction) {
    reasons.push({ kind: 'missing-next-action', message: 'No next action assigned' })
  } else if (opp.nextActionDate) {
    const days = daysUntil(opp.nextActionDate)
    if (days < 0) {
      reasons.push({
        kind: 'overdue-next-action',
        message: `Next action overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`,
      })
    } else if (days <= DEADLINE_WARNING_DAYS && CRITICAL_DEADLINE_STAGES.has(opp.stage)) {
      reasons.push({
        kind: 'upcoming-deadline',
        message: `Critical deadline ${formatDate(opp.nextActionDate)} (${days} day${days === 1 ? '' : 's'})`,
      })
    }
  }

  const idleDays = -daysUntil(opp.lastActivityDate)
  if (idleDays >= STALLED_AFTER_DAYS) {
    reasons.push({ kind: 'stalled', message: `No activity in ${idleDays} days` })
  }

  return reasons
}

function enrich(opp: Opportunity): EnrichedOpportunity {
  const attentionReasons = deriveAttentionReasons(opp)
  return { ...opp, attentionReasons, needsAttention: attentionReasons.length > 0 }
}

export function getOpportunities(): EnrichedOpportunity[] {
  return opportunities.map(enrich)
}

export function getPriorityTasks(): PriorityTask[] {
  return [...priorityTasks].sort(
    (a, b) => a.priority.localeCompare(b.priority) || a.dueDate.localeCompare(b.dueDate),
  )
}

export function getRecentActivity(): ActivityItem[] {
  return [...recentActivity].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export function getCurrentUser(): CurrentUser {
  return currentUser
}
