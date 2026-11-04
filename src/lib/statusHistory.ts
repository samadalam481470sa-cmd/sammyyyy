import type { CompletionCorrection, Opportunity, OpportunityStatus, StatusChange } from '@/types'

/**
 * Status history and the Completed (legally closed) rules.
 * - A change is recorded only when a save actually changes the status.
 * - Completed means legally closed. Choosing it needs a confirmation with the legal closing date,
 *   and the stage becomes Closing. Being at Closing alone never makes a deal Completed.
 * - completedAt is the first time the deal entered Completed (kept for history).
 * - completionConfirmedAt / closedAt / closingSnapshot describe the CURRENT completion. Leaving
 *   Completed clears them; completionCorrections keeps every confirmation and reversal.
 * - Operational screens use the status at once. Completion REPORTS wait 24 hours from the
 *   confirmation (see completionReportState), computed at read time, so no timer is needed.
 */

export const COMPLETION_REPORT_DELAY_MS = 24 * 60 * 60 * 1000

export type StatusPatch = Pick<
  Opportunity,
  'statusHistory' | 'completedAt' | 'closedAt' | 'completionConfirmedAt' | 'closingSnapshot' | 'completionCorrections'
>

function isYmd(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function applyStatusChange(
  existing: Opportunity,
  nextStatus: OpportunityStatus | undefined,
  at: string,
  closedAt?: string | null,
  financials?: { nwp?: number; pfEbitda?: number; netRevenue?: number },
): StatusPatch {
  const history = existing.statusHistory ?? []
  const corrections = existing.completionCorrections ?? []
  const keep: StatusPatch = {
    statusHistory: history,
    completedAt: existing.completedAt ?? null,
    closedAt: existing.closedAt ?? null,
    completionConfirmedAt: existing.completionConfirmedAt ?? null,
    closingSnapshot: existing.closingSnapshot ?? null,
    completionCorrections: corrections,
  }
  if (!nextStatus || nextStatus === existing.status) {
    // Correcting the legal closing date of a deal that stays Completed.
    if (existing.status === 'Completed' && isYmd(closedAt) && closedAt !== existing.closedAt) {
      return { ...keep, closedAt }
    }
    return keep
  }
  const change: StatusChange = { from: existing.status, to: nextStatus, at }
  const completedAt = existing.completedAt ?? (nextStatus === 'Completed' ? at : null)
  if (nextStatus === 'Completed') {
    const legal = isYmd(closedAt) ? closedAt : at.slice(0, 10)
    const correction: CompletionCorrection = { action: 'confirmed', at, closedAt: legal, toStatus: 'Completed' }
    return {
      statusHistory: [...history, change],
      completedAt,
      closedAt: legal,
      completionConfirmedAt: at,
      closingSnapshot: {
        nwp: Number(financials?.nwp ?? existing.nwp) || 0,
        pfEbitda: Number(financials?.pfEbitda ?? existing.pfEbitda) || 0,
        netRevenue: Number(financials?.netRevenue ?? existing.netRevenue) || 0,
      },
      completionCorrections: [...corrections, correction],
    }
  }
  if (existing.status === 'Completed') {
    const correction: CompletionCorrection = { action: 'reversed', at, closedAt: existing.closedAt ?? null, toStatus: nextStatus }
    return {
      statusHistory: [...history, change],
      completedAt,
      closedAt: null,
      completionConfirmedAt: null,
      closingSnapshot: null,
      completionCorrections: [...corrections, correction],
    }
  }
  return { ...keep, statusHistory: [...history, change], completedAt }
}

export function initialStatusHistory(status: OpportunityStatus, at: string, closedAt?: string | null): StatusPatch {
  const base: StatusPatch = {
    statusHistory: [{ from: null, to: status, at }],
    completedAt: status === 'Completed' ? at : null,
    closedAt: null,
    completionConfirmedAt: null,
    closingSnapshot: null,
    completionCorrections: [],
  }
  if (status !== 'Completed') return base
  const legal = isYmd(closedAt) ? closedAt : at.slice(0, 10)
  return {
    ...base,
    closedAt: legal,
    completionConfirmedAt: at,
    completionCorrections: [{ action: 'confirmed', at, closedAt: legal, toStatus: 'Completed' }],
  }
}

export type CompletionReportState = 'not_completed' | 'provisional' | 'final'

/** When the current completion was confirmed. Older records fall back to their recorded completion time. */
export function completionConfirmedTime(o: Opportunity): string | null {
  if (o.status !== 'Completed') return null
  if (o.completionConfirmedAt) return o.completionConfirmedAt
  const history = o.statusHistory ?? []
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].to === 'Completed') return history[i].at
  }
  return o.completedAt ?? null
}

/**
 * Completion reporting state, derived from saved timestamps and the current record:
 * - not_completed: status is not Completed (a reversal removes the deal from completion reports).
 * - provisional: confirmed less than 24 hours ago.
 * - final: confirmed 24 hours ago or more (or an older record with no confirmation time).
 */
export function completionReportState(o: Opportunity, now = new Date()): CompletionReportState {
  if (o.status !== 'Completed') return 'not_completed'
  const confirmed = completionConfirmedTime(o)
  if (!confirmed) return 'final'
  const t = new Date(confirmed).getTime()
  if (Number.isNaN(t)) return 'final'
  return now.getTime() - t >= COMPLETION_REPORT_DELAY_MS ? 'final' : 'provisional'
}

/** The legal closing date used by completion reports (YYYY-MM-DD), or null when never recorded. */
export function legalClosingDate(o: Opportunity): string | null {
  if (o.status !== 'Completed') return null
  if (isYmd(o.closedAt)) return o.closedAt
  const confirmed = completionConfirmedTime(o)
  return confirmed ? confirmed.slice(0, 10) : null
}

/** Values counted at legal closing: the closing snapshot, or the current figures for older records. */
export function closingValues(o: Opportunity): { nwp: number; pfEbitda: number } {
  const snap = o.closingSnapshot
  if (snap) return { nwp: Number(snap.nwp) || 0, pfEbitda: Number(snap.pfEbitda) || 0 }
  return { nwp: Number(o.nwp) || 0, pfEbitda: Number(o.pfEbitda) || 0 }
}

/** Completion events kept for the activity record (+1 into Completed, -1 out of it). */
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

/** Completed deals whose closing date was never recorded. Reports list them as undated. */
export function hasUndatedCompletion(opportunity: Opportunity): boolean {
  return opportunity.status === 'Completed' && !legalClosingDate(opportunity)
}

/** Stage/status combinations that the business rules call contradictory. Flagged, never auto-fixed. */
export function statusStageConflict(opportunity: Pick<Opportunity, 'status' | 'stage'>): string | null {
  if (opportunity.status === 'Completed' && opportunity.stage !== 'Closing') {
    return 'Completed deals should be at the Closing stage.'
  }
  return null
}
