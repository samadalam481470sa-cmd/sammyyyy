import { describe, expect, it } from 'vitest'
import { asNumber, mapHeader, rowToOpportunityDraft } from './excelImport'

describe('excelImport mapping', () => {
  it('fuzzy-matches common financial headers', () => {
    expect(mapHeader('Net Written Premium')).toBe('nwp')
    expect(mapHeader('NWP ($)')).toBe('nwp')
    expect(mapHeader('Pro Forma EBITDA')).toBe('pfEbitda')
    expect(mapHeader('Company Name')).toBe('entityName')
    expect(mapHeader('Deal Lead')).toBe('dealLead')
  })

  it('leaves unknown headers unmatched', () => {
    expect(mapHeader('Random Widget Score')).toBeNull()
  })

  it('parses currency-like numbers', () => {
    expect(asNumber('$1,250,000')).toBe(1250000)
    expect(asNumber('32.9')).toBe(32.9)
  })

  it('onlyMapped draft skips unmapped fields', () => {
    const draft = rowToOpportunityDraft({ nwp: 500000, projectName: 'Alpha' }, 0, {
      onlyMapped: true,
    })
    expect(draft.projectName).toBe('Alpha')
    expect(draft.nwp).toBe(500000)
    expect(draft.entityName).toBeUndefined()
    expect(draft.status).toBeUndefined()
  })
})
