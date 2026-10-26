import { describe, it, expect } from 'vitest'
import {
  computeFinancialTotals,
  computeKpis,
  filterDashboardOpportunities,
  filterOpportunities,
  hasActiveFilters,
  safeMoney,
} from '@/utils/dashboard'
import { mockOpportunities } from '@/data/mockOpportunities'
import type { DashboardFilters } from '@/types'

describe('dashboard filters', () => {
  it('keeps All Deals inclusive of every status', () => {
    const result = filterOpportunities(mockOpportunities, {
      status: 'All Deals',
      stage: null,
      search: '',
    })
    expect(result).toHaveLength(mockOpportunities.length)
    expect(result.some((o) => o.status === 'Inactive')).toBe(true)
    expect(result.some((o) => o.status === 'Closed')).toBe(true)
    expect(result.some((o) => o.status === 'Declined')).toBe(true)
    expect(result.some((o) => o.status === 'Withdrew')).toBe(true)
  })

  it('filters by Active status', () => {
    const filters: DashboardFilters = {
      status: 'Active',
      stage: null,
      search: '',
    }
    const result = filterOpportunities(mockOpportunities, filters)
    expect(result.every((o) => o.status === 'Active')).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('filters by stage', () => {
    const filters: DashboardFilters = {
      status: 'All Deals',
      stage: 'NDA',
      search: '',
    }
    const result = filterOpportunities(mockOpportunities, filters)
    expect(result.every((o) => o.stage === 'NDA')).toBe(true)
  })

  it('filters by search on project and entity', () => {
    const filters: DashboardFilters = {
      status: 'All Deals',
      stage: null,
      search: 'project a',
    }
    const result = filterOpportunities(mockOpportunities, filters)
    expect(result.some((row) => row.id === 'opp-a' && row.entityName === 'Entity A')).toBe(true)
    expect(result.every((row) => `${row.projectName} ${row.entityName}`.toLowerCase().includes('project a'))).toBe(true)
  })

  it('filters needs attention', () => {
    const filters: DashboardFilters = {
      status: 'Needs Attention',
      stage: null,
      search: '',
    }
    const result = filterOpportunities(mockOpportunities, filters)
    expect(result.every((o) => o.needsAttention)).toBe(true)
  })

  it('computes KPIs from data rather than hard-coded values', () => {
    const kpis = computeKpis(mockOpportunities)
    const active = mockOpportunities.filter((o) => o.status === 'Active')
    expect(kpis.activeDeals).toBe(active.length)
    expect(kpis.activeNwp).toBe(active.reduce((s, o) => s + o.nwp, 0))
  })

  it('limits Dashboard All Deals to Active, Pending, and Completed', () => {
    const result = filterDashboardOpportunities(mockOpportunities, {
      status: 'All Deals',
      stage: null,
      search: '',
    })
    expect(result.every((o) => ['Active', 'Pending', 'Completed'].includes(o.status))).toBe(true)
    expect(result.some((o) => o.status === 'Inactive')).toBe(false)
    expect(result.length).toBe(
      mockOpportunities.filter((o) => ['Active', 'Pending', 'Completed'].includes(o.status)).length,
    )
  })

  it('sums financials from the filtered set and ignores invalid numbers', () => {
    const totals = computeFinancialTotals([
      mockOpportunities[0],
      { ...mockOpportunities[0], id: 'bad', nwp: Number.NaN, pfEbitda: undefined as unknown as number },
    ])
    expect(totals.nwp).toBe(safeMoney(mockOpportunities[0].nwp))
    expect(Number.isNaN(totals.nwp)).toBe(false)
  })

  it('detects active filters', () => {
    expect(
      hasActiveFilters({ status: 'All Deals', stage: null, search: '' }),
    ).toBe(false)
    expect(
      hasActiveFilters({ status: 'Active', stage: null, search: '' }),
    ).toBe(true)
  })
})
