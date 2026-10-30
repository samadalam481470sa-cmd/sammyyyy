import { describe, expect, it } from 'vitest'
import type { Opportunity } from '@/types'
import type { TaskRecord } from '@/data/mockModules'
import { bundledSeedSnapshot } from './portableDatabase'
import {
  buildTrends,
  dealsByStatus,
  financialGroups,
  leadFinancials,
  missedDeadlinesByOwner,
  pipelineByStage,
  reportKpis,
  resolvePeriod,
  scopeDeals,
} from './reports'

const NOW = new Date(2026, 9, 30, 9, 0, 0)
const seeds = bundledSeedSnapshot()
const opps = seeds.opportunities
const ALL = resolvePeriod({ kind: 'all' })

function sum(rows: Opportunity[], key: 'nwp' | 'pfEbitda') {
  return rows.reduce((s, o) => s + o[key], 0)
}

describe('reports', () => {
  it('KPIs match exact sums of stored records', () => {
    const k = reportKpis(scopeDeals(opps, ALL))
    const pipeline = opps.filter((o) => o.status === 'Active' || o.status === 'Pending')
    const completed = opps.filter((o) => o.status === 'Completed')
    expect(k.pipeline).toEqual({ deals: pipeline.length, nwp: sum(pipeline, 'nwp'), pfEbitda: sum(pipeline, 'pfEbitda') })
    expect(k.completed).toEqual({ deals: completed.length, nwp: sum(completed, 'nwp'), pfEbitda: sum(completed, 'pfEbitda') })
    const groups = financialGroups(k)
    expect(groups[2].nwp).toBe(groups[0].nwp + groups[1].nwp)
    expect(groups[2].pfEbitda).toBe(groups[0].pfEbitda + groups[1].pfEbitda)
  })

  it('status chart covers all statuses; stage chart only Active + Pending', () => {
    const s = scopeDeals(opps, ALL)
    expect(dealsByStatus(s.allStatuses).reduce((a, r) => a + r.count, 0)).toBe(62)
    expect(pipelineByStage(s.pipeline).reduce((a, r) => a + r.count, 0)).toBe(s.pipeline.length)
  })

  it('period filters use recorded dates and report undated records', () => {
    const july = resolvePeriod({ kind: 'month', month: '2026-07' })
    const s = scopeDeals(opps, july)
    expect(s.completed.map((o) => o.projectName)).toEqual(['Project BA'])
    expect(s.undatedCreated).toBe(42)
    expect(s.undatedCompleted).toBeGreaterThan(0)
    const range = resolvePeriod({ kind: 'range', from: '2026-10-01', to: '2026-10-31' })
    expect(scopeDeals(opps, range).completed.map((o) => o.projectName)).toEqual(['Project BC'])
    expect(resolvePeriod({ kind: 'year', year: '2026' }).label).toBe('2026')
  })

  it('lead financials keep Active + Pending and Completed apart with no combined series', () => {
    const rows = leadFinancials(scopeDeals(opps, ALL), ['Mary Sbaschnig', 'Dennis DiCapua'])
    const mary = rows.find((r) => r.lead === 'Mary Sbaschnig')!
    expect(Object.keys(mary).sort()).toEqual(['completedNwp', 'completedPfEbitda', 'lead', 'pipelineNwp', 'pipelinePfEbitda'])
  })

  it('missed deadlines use the original due date and do not vanish when moved', () => {
    const t = (p: Partial<TaskRecord>): TaskRecord => ({ id: 'x', priority: 'A', action: 'a', opportunityId: null, projectName: '', owner: 'Mary Sbaschnig', dueDate: null, status: 'Open', notes: '', ...p })
    const rows = [
      t({ id: 'moved', initialDueDate: '2026-10-10', dueDate: '2026-11-20' }),
      t({ id: 'late', initialDueDate: '2026-10-12', dueDate: '2026-10-12', status: 'Done', completedAt: '2026-10-15T15:00:00Z' }),
      t({ id: 'ontime', initialDueDate: '2026-10-12', dueDate: '2026-10-12', status: 'Done', completedAt: '2026-10-11T15:00:00Z' }),
      t({ id: 'future', initialDueDate: '2026-11-12', dueDate: '2026-11-12' }),
      t({ id: 'legacy', dueDate: '2026-10-01', owner: 'Dennis DiCapua' }),
    ]
    const result = missedDeadlinesByOwner(rows, ALL, ['Mary Sbaschnig', 'Dennis DiCapua'], NOW)
    expect(result.rows.find((r) => r.owner === 'Mary Sbaschnig')?.count).toBe(2)
    expect(result.rows.find((r) => r.owner === 'Dennis DiCapua')?.count).toBe(1)
    expect(result.presentStateOnly).toBe(1)
  })

  it('trends count created and completed per month and cumulative values only change on completions', () => {
    const trends = buildTrends(opps, ALL, NOW)
    const totalCreated = trends.points.reduce((s, p) => s + p.created, 0)
    expect(totalCreated).toBe(opps.filter((o) => o.createdAt).length)
    const nwps = trends.points.map((p) => p.cumulativeNwp)
    expect(nwps.every((v, i) => i === 0 || v >= nwps[i - 1])).toBe(true)
    const last = trends.points[trends.points.length - 1]
    const dated = opps.filter((o) => o.status === 'Completed' && o.completedAt)
    expect(last.cumulativeNwp).toBe(sum(dated, 'nwp'))
    expect(trends.undatedCompleted).toBe(opps.filter((o) => o.status === 'Completed' && !o.completedAt).length)
  })

  it('a recorded reversal lowers cumulative completed values on the reversal date', () => {
    const base = opps.find((o) => o.projectName === 'Project BA')!
    const reversed: Opportunity = {
      ...base,
      status: 'Active',
      statusHistory: [...(base.statusHistory ?? []), { from: 'Completed', to: 'Active', at: '2026-09-10T15:00:00Z' }],
    }
    const trends = buildTrends([reversed], ALL, NOW)
    const aug = trends.points.find((p) => p.month === '2026-08')!
    const sep = trends.points.find((p) => p.month === '2026-09')!
    expect(aug.cumulativeNwp).toBe(base.nwp)
    expect(sep.cumulativeNwp).toBe(0)
    expect(sep.completed).toBe(-1)
    expect(trends.reversals).toBe(1)
  })
})
