import type { Opportunity, OpportunityStatus, StatusChange } from '@/types'

/**
 * Status history rules.
 * - A change is recorded only when a save actually changes the status.
 * - completedAt is the first time the deal entered Completed. It is not cleared by a reversal;
 *   the reversal stays visible in statusHistory so reports can subtract it on the reversal date.
 */
export function applyStatusChange(
  existing: Opportunity,
  nextStatus: OpportunityStatus | undefined,
  at: string,
): Pick<Opportunity, 'statusHistory' | 'completedAt'> {
  const history = existing.statusHistory ?? []
  if (!nextStatus || nextStatus === existing.status) {
    return { statusHistory: history, completedAt: existing.completedAt ?? null }
  }
  const change: StatusChange = { from: existing.status, to: nextStatus, at }
  const completedAt = existing.completedAt ?? (nextStatus === 'Completed' ? at : null)
  return { statusHistory: [...history, change], completedAt }
}

export function initialStatusHistory(status: OpportunityStatus, at: string): Pick<Opportunity, 'statusHistory' | 'completedAt'> {
  return {
    statusHistory: [{ from: null, to: status, at }],
    completedAt: status === 'Completed' ? at : null,
  }
}

/** Completion events: +1 when a deal enters Completed, -1 when it leaves Completed. */
export interface CompletionEvent {
  opportunityId: string
  at: string
  delta: 1 | -1
}

export function completionEvents(opportunity: Opportunity): CompletionEvent[] {
  const history = opportunity.statusHistory ?? []
  if (history.length) {
    const events: CompletionEvent[] = []
    for (const change of history) {
      if (change.to === 'Completed' && change.from !== 'Completed') {
        events.push({ opportunityId: opportunity.id, at: change.at, delta: 1 })
      } else if (change.from === 'Completed' && change.to !== 'Completed') {
        events.push({ opportunityId: opportunity.id, at: change.at, delta: -1 })
      }
    }
    return events
  }
  if (opportunity.status === 'Completed' && opportunity.completedAt) {
    return [{ opportunityId: opportunity.id, at: opportunity.completedAt, delta: 1 }]
  }
  return []
}

/** Completed deals whose completion date was never recorded. Reports list them as undated. */
export function hasUndatedCompletion(opportunity: Opportunity): boolean {
  return opportunity.status === 'Completed' && completionEvents(opportunity).length === 0
}

/** Stage/status combinations that the business rules call contradictory. Flagged, never auto-fixed. */
export function statusStageConflict(opportunity: Pick<Opportunity, 'status' | 'stage'>): string | null {
  if (opportunity.status === 'Completed' && opportunity.stage !== 'Closing') {
    return 'Completed deals should be at the Closing stage.'
  }
  return null
}
