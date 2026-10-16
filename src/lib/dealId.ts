import { demoProjectNumber } from '@/lib/demoAliases'

export function formatDealId(projectNumber: number): string {
  const n = Number.isFinite(projectNumber) ? Math.max(1, Math.floor(projectNumber)) : 1
  return `DEAL-${String(n).padStart(3, '0')}`
}

export function dealIdFromOpportunity(record: { id: string; projectNumber?: number }): string {
  return formatDealId(record.projectNumber ?? demoProjectNumber(record.id))
}

/** Next unique project number in the current persisted set (never reuse on filter/sort). */
export function nextProjectNumber(records: Array<{ projectNumber?: number }>): number {
  return records.reduce((max, row) => Math.max(max, row.projectNumber ?? 0), 0) + 1
}
