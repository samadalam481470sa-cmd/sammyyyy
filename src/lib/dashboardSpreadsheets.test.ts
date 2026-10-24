import { describe, expect, it } from 'vitest'
import {
  createDashboardSheet,
  gridFromMatrix,
  gridFromText,
  nextSpreadsheetIndex,
  spreadsheetTitle,
  updateSheetCell,
  updateSheetHeader,
} from './dashboardSpreadsheets'

describe('dashboard spreadsheet columns', () => {
  it('names the first imported sheet Spreadsheet 1', () => {
    expect(spreadsheetTitle(1)).toBe('Spreadsheet 1')
    expect(spreadsheetTitle(2)).toBe('Spreadsheet 2')
    expect(nextSpreadsheetIndex([{ title: 'Spreadsheet 1' }])).toBe(2)
  })

  it('keeps the imported grid, including blank cells', () => {
    const grid = gridFromText('Project,Status\nHarbor,Active\n')
    expect(grid.headers).toEqual(['Project', 'Status'])
    expect(grid.rows[0]).toEqual(['Harbor', 'Active'])
    expect(gridFromMatrix([['A', ''], ['1', '2']]).rows).toEqual([['1', '2']])
  })

  it('saves a cell edit without touching other cells', () => {
    const sheet = createDashboardSheet(
      { headers: ['Project', 'Status'], rows: [['Harbor', 'Active']] },
      1,
      'book.xlsx',
    )
    const next = updateSheetCell(sheet, 0, 1, 'Pending')
    expect(next.rows[0]).toEqual(['Harbor', 'Pending'])
    expect(sheet.rows[0]).toEqual(['Harbor', 'Active'])
    expect(updateSheetHeader(next, 0, 'Deal').headers[0]).toBe('Deal')
  })
})
