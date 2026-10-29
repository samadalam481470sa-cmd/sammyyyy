/**
 * Reports exports built in the browser from the same opportunities the CRM shows
 * (the shared workspace when connected, otherwise this browser's copy). This works on the
 * static site, where there is no /api/export route.
 */
import type { Opportunity } from '@/types'

export const CSV_COLUMNS = [
  'projectNumber',
  'projectName',
  'entityName',
  'type',
  'status',
  'stage',
  'dealLead',
  'sourceType',
  'sourceName',
  'specialty',
  'geography',
  'nwp',
  'netRevenue',
  'pfEbitda',
  'nextAction',
  'nextActionDate',
  'priority',
  'lastActivityDate',
  'needsAttention',
  'attentionReasons',
  'outstandingItems',
  'diligenceNotes',
] as const

function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : Array.isArray(value) ? value.join('; ') : String(value)
  // A cell starting with = + - @ runs as a formula in Excel. Text values are made safe.
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function opportunitiesCsv(opportunities: Opportunity[]): string {
  const rows = [...opportunities].sort((a, b) => (a.projectNumber ?? 0) - (b.projectNumber ?? 0))
  const lines = rows.map((o) => CSV_COLUMNS.map((col) => csvCell(o[col as keyof Opportunity])).join(','))
  return [CSV_COLUMNS.join(','), ...lines].join('\r\n')
}

export function opportunitiesJson(opportunities: Opportunity[], exportedAt = new Date()): string {
  return JSON.stringify({ exportedAt: exportedAt.toISOString(), count: opportunities.length, opportunities }, null, 2)
}

/** Hand the viewer a file to save. */
export function saveFile(name: string, content: string, type: string): void {
  // The byte-order mark makes Excel read the CSV as UTF-8.
  const blob = new Blob([type.startsWith('text/csv') ? '﻿' + content : content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportFileName(ext: 'csv' | 'json', now = new Date()): string {
  return `newport-opportunities-${now.toISOString().slice(0, 10)}.${ext}`
}
