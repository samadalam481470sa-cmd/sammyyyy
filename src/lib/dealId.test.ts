import { describe, expect, it } from 'vitest'
import { dealIdFromOpportunity, formatDealId, nextProjectNumber } from './dealId'

describe('dealId', () => {
  it('formats stable DEAL-001 style ids from project numbers', () => {
    expect(formatDealId(1)).toBe('DEAL-001')
    expect(formatDealId(16)).toBe('DEAL-016')
    expect(dealIdFromOpportunity({ id: 'opp-a', projectNumber: 1 })).toBe('DEAL-001')
  })

  it('does not reuse numbers when the list is filtered or reordered', () => {
    const records = [{ projectNumber: 1 }, { projectNumber: 16 }, { projectNumber: 2 }]
    expect(nextProjectNumber(records)).toBe(17)
    expect(nextProjectNumber(records.slice(0, 1))).toBe(2)
  })
})
