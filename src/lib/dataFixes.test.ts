import { describe, expect, it } from 'vitest'
import { applyDataFixes } from './dataFixes'
import { bundledSeedSnapshot } from './portableDatabase'
import { mockOpportunities } from '@/data/mockOpportunities'
import { statusStageConflict } from './statusHistory'
import { BASE_CRM_USERS } from './crmUsers'

describe('starter data repairs', () => {
  it('fixes Completed stages and unknown deal leads in old stored data', () => {
    const fixed = applyDataFixes(mockOpportunities)
    expect(fixed.filter((o) => statusStageConflict(o))).toHaveLength(0)
    const names = new Set(BASE_CRM_USERS.map((u) => u.name))
    expect(fixed.every((o) => names.has(o.dealLead))).toBe(true)
    expect(applyDataFixes(fixed)).toBe(fixed)
  })

  it('never overwrites a later user edit', () => {
    const edited = mockOpportunities.map((o) => (o.id === 'opp-x' ? { ...o, dealLead: 'Mary Sbaschnig', status: 'Active' as const } : o))
    const fixed = applyDataFixes(edited).find((o) => o.id === 'opp-x')!
    expect(fixed.dealLead).toBe('Mary Sbaschnig')
    expect(fixed.stage).toBe('IOI / LOI')
  })

  it('ships clean starter data to new browsers', () => {
    const seeds = bundledSeedSnapshot().opportunities
    expect(seeds.filter((o) => statusStageConflict(o))).toHaveLength(0)
    expect(seeds.filter((o) => o.dealLead === 'Alex Rivera' || !o.dealLead)).toHaveLength(0)
  })
})
