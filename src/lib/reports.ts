/**
 * Report calculations. Every value is derived from saved records at the moment of viewing.
 *
 * Period semantics (no historical snapshots are stored):
 * - Active + Pending figures: deals whose CURRENT status is Active or Pending and whose recorded
 *   creation date falls in the period.
 * - Completed figures: deals whose CURRENT status is Completed and whose recorded first completion
 *   date falls in the period.
 * - All Time includes every deal, dated or not. A period filter leaves out deals with no recorded
 *   date, and the page says how many.
 * Trends use recorded events only:
 * - Created = createdAt. Completed = each recorded move INTO Completed (+1); a recorded move OUT of
 *   Completed is a reversal (-1) on its own date. Cumulative values add on completion and subtract
 *   on reversal, so they move only when a completion or a reversal actually happened.
 */
import type { Opportunity } from '@/types'
import type { TaskRecord } from '@/data/mockModules'
import { ACQUISITION_STAGES, OPPORTUNITY_STATUSES } from '@/data/constants'
import { safeMoney } from '@/utils/dashboard'
import { completionEvents } from '@/lib/statusHistory'
import { parseDateValue, startOfLocalDay } from '@/lib/calendarDate'

export type PeriodKind = 'all' | 'month' | 'year' | 'range'

export interface PeriodFilter {
  kind: PeriodKind
  /** YYYY-MM */
  month?: string
  /** YYYY */
  year?: string
  /** YYYY-MM-DD, inclusive */
  from?: string
  to?: string
}

export interface Period {
  /** Inclusive start, exclusive end. null = unbounded (All Time). */
  from: Date | null
  to: Date | null
  label: string
  isAllTime: boolean
}

function localDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

export function resolvePeriod(filter: PeriodFilter): Period {
  if (filter.kind === 'month' && filter.month && /^\d{4}-\d{2}$/.test(filter.month)) {
    const [y, m] = filter.month.split('-').map(Number)
    const from = new Date(y, m - 1, 1)
    return { from, to: new Date(y, m, 1), label: from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), isAllTime: false }
  }
  if (filter.kind === 'year' && filter.year && /^\d{4}$/.test(filter.year)) {
    const y = Number(filter.year)
    return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1), label: String(y), isAllTime: false }
  }
  if (filter.kind === 'range') {
    const from = filter.from ? localDate(filter.from) : null
    const toDay = filter.to ? localDate(filter.to) : null
    const to = toDay ? new Date(toDay.getFullYear(), toDay.getMonth(), toDay.getDate() + 1) : null
    if (from || to) {
      const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      const label = `${from ? fmt(from) : 'Start'} – ${toDay ? fmt(toDay) : 'Today'}`
      return { from, to, label, isAllTime: false }
    }
  }
  return { from: null, to: null, label: 'All Time', isAllTime: true }
}

export function inPeriod(iso: string | null | undefined, period: Period): boolean {
  if (period.isAllTime) return true
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  if (period.from && t < period.from.getTime()) return false
  if (period.to && t >= period.to.getTime()) return false
  return true
}

const isPipeline = (o: Opportunity) => o.status === 'Active' || o.status === 'Pending'

export interface Totals {
  deals: number
  nwp: number
  pfEbitda: number
}

function totals(rows: Opportunity[]): Totals {
  return {
    deals: rows.length,
    nwp: rows.reduce((s, o) => s + safeMoney(o.nwp), 0),
    pfEbitda: rows.reduce((s, o) => s + safeMoney(o.pfEbitda), 0),
  }
}

export interface ScopedDeals {
  /** Active + Pending deals in scope. */
  pipeline: Opportunity[]
  /** Completed deals in scope. */
  completed: Opportunity[]
  /** All statuses in scope (by creation date), for Deals by Status. */
  allStatuses: Opportunity[]
  /** Deals left out of a period view because the needed date was never recorded. */
  undatedCreated: number
  undatedCompleted: number
}

export function scopeDeals(opportunities: Opportunity[], period: Period): ScopedDeals {
  const created = (o: Opportunity) => inPeriod(o.createdAt, period)
  const completedAt = (o: Opportunity) => o.completedAt ?? completionEvents(o).find((e) => e.delta === 1)?.at ?? null
  return {
    pipeline: opportunities.filter((o) => isPipeline(o) && created(o)),
    completed: opportunities.filter((o) => o.status === 'Completed' && inPeriod(completedAt(o), period)),
    allStatuses: opportunities.filter(created),
    undatedCreated: period.isAllTime ? 0 : opportunities.filter((o) => !o.createdAt).length,
    undatedCompleted: period.isAllTime ? 0 : opportunities.filter((o) => o.status === 'Completed' && !completedAt(o)).length,
  }
}

export interface ReportKpis {
  pipeline: Totals
  completed: Totals
}

export function reportKpis(scoped: ScopedDeals): ReportKpis {
  return { pipeline: totals(scoped.pipeline), completed: totals(scoped.completed) }
}

export function dealsByStatus(rows: Opportunity[]) {
  return OPPORTUNITY_STATUSES.map((status) => ({ status, count: rows.filter((o) => o.status === status).length }))
}

export function pipelineByStage(pipeline: Opportunity[]) {
  return ACQUISITION_STAGES.map((stage) => ({ stage, count: pipeline.filter((o) => o.stage === stage).length }))
}

export function countByLead(rows: Opportunity[], leads: string[]) {
  const names = new Set(leads)
  rows.forEach((o) => names.add(o.dealLead?.trim() || 'Unassigned'))
  return [...names]
    .sort((a, b) => (a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b)))
    .map((lead) => ({ lead, count: rows.filter((o) => (o.dealLead?.trim() || 'Unassigned') === lead).length }))
}

/** Pipeline Overview chart 4: NWP and PF EBITDA side by side for each category. */
export function financialGroups(k: ReportKpis) {
  return [
    { category: 'Active + Pending', nwp: k.pipeline.nwp, pfEbitda: k.pipeline.pfEbitda },
    { category: 'Completed', nwp: k.completed.nwp, pfEbitda: k.completed.pfEbitda },
    { category: 'Combined', nwp: k.pipeline.nwp + k.completed.nwp, pfEbitda: k.pipeline.pfEbitda + k.completed.pfEbitda },
  ]
}

/** Lead Analysis chart 3: per lead, NWP and PF EBITDA for Active + Pending and for Completed (no combined). */
export function leadFinancials(scoped: ScopedDeals, leads: string[]) {
  const names = new Set(leads)
  ;[...scoped.pipeline, ...scoped.completed].forEach((o) => names.add(o.dealLead?.trim() || 'Unassigned'))
  const of = (rows: Opportunity[], lead: string) => totals(rows.filter((o) => (o.dealLead?.trim() || 'Unassigned') === lead))
  return [...names].sort().map((lead) => {
    const p = of(scoped.pipeline, lead)
    const c = of(scoped.completed, lead)
    return { lead, pipelineNwp: p.nwp, pipelinePfEbitda: p.pfEbitda, completedNwp: c.nwp, completedPfEbitda: c.pfEbitda }
  })
}

export interface MissedDeadlines {
  rows: { owner: string; count: number }[]
  /** Tasks counted from their current due date because no original due date was recorded. */
  presentStateOnly: number
  total: number
}

/**
 * Lead Analysis chart 4: missed deadlines by assigned task owner.
 * A task counts once if its ORIGINAL due date falls in the period and passed before the task was
 * completed (or is still open past it today). Moving the due date later does not erase the miss.
 */
export function missedDeadlinesByOwner(tasks: TaskRecord[], period: Period, owners: string[], now = new Date()): MissedDeadlines {
  const counts = new Map<string, number>(owners.map((o) => [o, 0]))
  let presentStateOnly = 0
  const today = startOfLocalDay(now).getTime()
  for (const task of tasks) {
    if (task.deletedAt) continue
    const recorded = task.initialDueDate !== undefined
    const due = recorded ? task.initialDueDate : task.dueDate
    if (!due) continue
    const dueDay = parseDateValue(due)
    if (!dueDay) continue
    const dueStart = startOfLocalDay(dueDay).getTime()
    if (!period.isAllTime) {
      if (period.from && dueStart < period.from.getTime()) continue
      if (period.to && dueStart >= period.to.getTime()) continue
    }
    if (dueStart >= today) continue
    let missed: boolean
    if (task.completedAt) {
      missed = startOfLocalDay(new Date(task.completedAt)).getTime() > dueStart
    } else if (task.archivedAt) {
      // Archived without a completion time: no proof either way, so it is not counted.
      missed = false
    } else {
      missed = task.status !== 'Done'
    }
    if (!missed) continue
    if (!recorded) presentStateOnly += 1
    const owner = task.owner?.trim() || 'Unassigned'
    counts.set(owner, (counts.get(owner) ?? 0) + 1)
  }
  const rows = [...counts.entries()].map(([owner, count]) => ({ owner, count })).sort((a, b) => a.owner.localeCompare(b.owner))
  return { rows, presentStateOnly, total: rows.reduce((s, r) => s + r.count, 0) }
}

export interface TrendPoint {
  month: string
  label: string
  created: number
  completed: number
  cumulativeNwp: number
  cumulativePfEbitda: number
}

export interface Trends {
  points: TrendPoint[]
  undatedCreated: number
  undatedCompleted: number
  reversals: number
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Monthly trend points from recorded created and completion events. */
export function buildTrends(opportunities: Opportunity[], period: Period, now = new Date()): Trends {
  type Ev = { at: Date; kind: 'created' | 'completed'; delta: number; nwp: number; pfEbitda: number }
  const events: Ev[] = []
  let undatedCreated = 0
  let undatedCompleted = 0
  let reversals = 0
  for (const o of opportunities) {
    if (o.createdAt) events.push({ at: new Date(o.createdAt), kind: 'created', delta: 1, nwp: 0, pfEbitda: 0 })
    else undatedCreated += 1
    const comp = completionEvents(o)
    if (!comp.length && o.status === 'Completed') undatedCompleted += 1
    for (const e of comp) {
      if (e.delta < 0) reversals += 1
      events.push({ at: new Date(e.at), kind: 'completed', delta: e.delta, nwp: safeMoney(o.nwp) * e.delta, pfEbitda: safeMoney(o.pfEbitda) * e.delta })
    }
  }
  const valid = events.filter((e) => !Number.isNaN(e.at.getTime())).sort((a, b) => a.at.getTime() - b.at.getTime())
  if (!valid.length) return { points: [], undatedCreated, undatedCompleted, reversals }
  const first = period.from ?? new Date(valid[0].at.getFullYear(), valid[0].at.getMonth(), 1)
  const lastBound = period.to ? new Date(period.to.getTime() - 1) : now
  const end = new Date(lastBound.getFullYear(), lastBound.getMonth(), 1)
  const points: TrendPoint[] = []
  // Cumulative completed values start from everything completed before the window.
  let cumNwp = 0
  let cumPfe = 0
  for (const e of valid) {
    if (e.kind === 'completed' && e.at < first) {
      cumNwp += e.nwp
      cumPfe += e.pfEbitda
    }
  }
  for (let cursor = new Date(first.getFullYear(), first.getMonth(), 1); cursor <= end; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    const key = monthKey(cursor)
    const inMonth = valid.filter((e) => monthKey(e.at) === key && (!period.from || e.at >= period.from) && (!period.to || e.at < period.to))
    const created = inMonth.filter((e) => e.kind === 'created').length
    const completed = inMonth.filter((e) => e.kind === 'completed').reduce((s, e) => s + e.delta, 0)
    for (const e of inMonth) {
      if (e.kind !== 'completed') continue
      cumNwp += e.nwp
      cumPfe += e.pfEbitda
    }
    points.push({
      month: key,
      label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      created,
      completed,
      cumulativeNwp: cumNwp,
      cumulativePfEbitda: cumPfe,
    })
    if (points.length > 240) break
  }
  return { points, undatedCreated, undatedCompleted, reversals }
}

/** Opportunities in scope for an export of the current tab and period. */
export function exportScope(opportunities: Opportunity[], period: Period): Opportunity[] {
  if (period.isAllTime) return opportunities
  const s = scopeDeals(opportunities, period)
  const ids = new Set([...s.allStatuses, ...s.completed].map((o) => o.id))
  return opportunities.filter((o) => ids.has(o.id))
}
