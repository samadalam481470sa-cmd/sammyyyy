import { describe, expect, it } from 'vitest'
import { opportunitiesCsv, opportunitiesJson } from './reportExport'
import type { Opportunity } from '@/types'

const opp = (n: number, extra: Partial<Opportunity> = {}) =>
  ({ id: `o${n}`, projectNumber: n, projectName: `Project ${n}`, entityName: 'Entity, Inc', status: 'Active', nwp: 1000, attentionReasons: [], ...extra }) as unknown as Opportunity

describe('report exports', () => {
  it('writes a header and one row per deal, sorted, with commas quoted', () => {
    const csv = opportunitiesCsv([opp(2), opp(1)])
    const lines = csv.split('\r\n')
    expect(lines[0].startsWith('projectNumber,projectName,entityName')).toBe(true)
    expect(lines).toHaveLength(3)
    expect(lines[1].startsWith('1,Project 1,"Entity, Inc"')).toBe(true)
  })
  it('blocks spreadsheet formulas in text cells', () => {
    const csv = opportunitiesCsv([opp(1, { projectName: '=HYPERLINK("x")' })])
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
  })
  it('exports JSON with a count', () => {
    const json = JSON.parse(opportunitiesJson([opp(1), opp(2)]))
    expect(json.count).toBe(2)
    expect(json.opportunities[0].id).toBe('o1')
  })
})
