import { describe, expect, it } from 'vitest'
import {
  anonymousEntityName,
  anonymousProjectName,
  DEMO_SEED_OPPORTUNITY_IDS,
  demoProjectNumber,
  indexToLetterCode,
  letterCodeForOpportunityId,
  letterCodeToIndex,
} from './demoAliases'

describe('demoAliases', () => {
  it('maps seed ids to A–P regardless of array shuffle', () => {
    const shuffled = [...DEMO_SEED_OPPORTUNITY_IDS].sort(() => 0.5 - Math.random())
    expect(letterCodeForOpportunityId('opp-a')).toBe('A')
    expect(letterCodeForOpportunityId('opp-b')).toBe('B')
    expect(letterCodeForOpportunityId('opp-p')).toBe('P')
    expect(shuffled.map((id) => letterCodeForOpportunityId(id)).sort()).toEqual(
      DEMO_SEED_OPPORTUNITY_IDS.map((id) => letterCodeForOpportunityId(id)).sort(),
    )
  })

  it('keeps matching project and entity letters for the same id', () => {
    for (const id of DEMO_SEED_OPPORTUNITY_IDS) {
      const code = letterCodeForOpportunityId(id)
      expect(anonymousProjectName(id)).toBe(`Project ${code}`)
      expect(anonymousEntityName(id)).toBe(`Entity ${code}`)
      expect(demoProjectNumber(id)).toBe(letterCodeToIndex(code) + 1)
    }
  })

  it('does not change a local id when other records are filtered', () => {
    const local = 'opp_local_12345'
    const first = letterCodeForOpportunityId(local)
    expect(letterCodeForOpportunityId(local)).toBe(first)
    expect(letterCodeForOpportunityId(local)).toBe(letterCodeForOpportunityId(local))
    expect(first).not.toBe('A')
  })

  it('round-trips excel-style letter codes', () => {
    expect(indexToLetterCode(0)).toBe('A')
    expect(indexToLetterCode(25)).toBe('Z')
    expect(indexToLetterCode(26)).toBe('AA')
    expect(letterCodeToIndex('A')).toBe(0)
    expect(letterCodeToIndex('P')).toBe(15)
    expect(letterCodeToIndex('AA')).toBe(26)
  })
})
