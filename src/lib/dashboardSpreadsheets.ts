import * as XLSX from 'xlsx'
import { loadOwnedCollection, saveOwnedCollection } from '@/lib/demoStore'

export interface SheetGrid {
  headers: string[]
  rows: string[][]
}

export interface DashboardSheet {
  id: string
  title: string
  sourceName: string
  headers: string[]
  rows: string[][]
}

const STORE = 'dashboard_sheets'

export function spreadsheetTitle(index: number): string {
  return `Spreadsheet ${index}`
}

export function gridFromMatrix(matrix: unknown[][]): SheetGrid {
  const rows = matrix
    .filter((row) => Array.isArray(row))
    .map((row) => row.map((cell) => (cell == null ? '' : String(cell))))
  const width = Math.max(1, ...rows.map((row) => row.length))
  const padded = (rows.length ? rows : [['']]).map((row) => {
    const next = row.slice(0, width)
    while (next.length < width) next.push('')
    return next
  })
  const headers = padded[0].map((cell, index) => cell.trim() || `Column ${index + 1}`)
  const body = padded.slice(1)
  return { headers, rows: body.length ? body : [headers.map(() => '')] }
}

export function gridFromArrayBuffer(buffer: ArrayBuffer): SheetGrid {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return gridFromMatrix([])
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: '',
  })
  return gridFromMatrix(matrix)
}

export function gridFromText(text: string): SheetGrid {
  const trimmed = text.trim()
  if (!trimmed) return gridFromMatrix([])
  const workbook = XLSX.read(trimmed, { type: 'string' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return gridFromMatrix([])
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: '',
  })
  return gridFromMatrix(matrix)
}

export function nextSpreadsheetIndex(sheets: Pick<DashboardSheet, 'title'>[]): number {
  const used = sheets.map((sheet) => {
    const match = /^Spreadsheet (\d+)$/.exec(sheet.title)
    return match ? Number(match[1]) : 0
  })
  return Math.max(0, ...used) + 1
}

export function createDashboardSheet(grid: SheetGrid, index: number, sourceName: string): DashboardSheet {
  return {
    id: `sheet_${Date.now()}_${index}`,
    title: spreadsheetTitle(index),
    sourceName,
    headers: grid.headers.slice(),
    rows: grid.rows.map((row) => row.slice()),
  }
}

export function updateSheetCell(
  sheet: DashboardSheet,
  rowIndex: number,
  columnIndex: number,
  value: string,
): DashboardSheet {
  if (rowIndex < 0 || columnIndex < 0 || columnIndex >= sheet.headers.length) return sheet
  if (rowIndex >= sheet.rows.length) return sheet
  const rows = sheet.rows.map((row, index) => {
    if (index !== rowIndex) return row
    const next = row.slice()
    while (next.length < sheet.headers.length) next.push('')
    next[columnIndex] = value
    return next
  })
  return { ...sheet, rows }
}

export function updateSheetHeader(sheet: DashboardSheet, columnIndex: number, value: string): DashboardSheet {
  if (columnIndex < 0 || columnIndex >= sheet.headers.length) return sheet
  const headers = sheet.headers.slice()
  headers[columnIndex] = value
  return { ...sheet, headers }
}

export function loadDashboardSheets(ownerKey: string): DashboardSheet[] {
  return loadOwnedCollection<DashboardSheet>(STORE, ownerKey, []).filter(
    (sheet) => sheet && Array.isArray(sheet.headers) && Array.isArray(sheet.rows) && typeof sheet.title === 'string',
  )
}

export function saveDashboardSheets(ownerKey: string, sheets: DashboardSheet[]): void {
  saveOwnedCollection(STORE, ownerKey, sheets)
}
