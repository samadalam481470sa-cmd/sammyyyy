/**
 * Reviewed import of a backup file into live records. It never deletes anything, and a record
 * already saved is only replaced when the person ticks that choice on the review screen.
 */
import type { PortableDatabase } from '@/lib/portableDatabase'

export const IMPORT_COLLECTIONS = ['opportunities', 'tasks', 'documents', 'contacts', 'dealLeads'] as const
export type ImportCollection = (typeof IMPORT_COLLECTIONS)[number]

/** new: no record has this id. same: nothing to do. changed: this id differs. duplicate: a new id that repeats an existing record. */
export type ImportKind = 'new' | 'same' | 'changed' | 'duplicate'

export interface ImportRow {
  collection: ImportCollection
  id: string
  kind: ImportKind
  label: string
  data: Record<string, unknown>
  /** For changed rows: the file's copy was edited after the saved one. */
  fileIsNewer?: boolean
}

export interface ImportPreview {
  fileName: string
  rows: ImportRow[]
  counts: Record<ImportKind, number>
}

export interface ImportOptions {
  includeChanged: boolean
  includeDuplicates: boolean
}

export interface ImportResult {
  added: number
  replaced: number
  /** Someone deleted these on purpose, so the file did not bring them back. */
  keptDeleted: number
  failed: string[]
}

type Row = Record<string, unknown>
type Current = Record<ImportCollection, { id: string }[]>

const DERIVED = new Set(['updatedAt', 'nextAction', 'nextActionDate', 'nextActionTaskId', 'attentionReasons'])

function comparable(row: Row): string {
  const keys = Object.keys(row).filter((key) => !DERIVED.has(key)).sort()
  return JSON.stringify(keys.map((key) => [key, row[key] ?? null]))
}

const clean = (value: unknown) => String(value ?? '').trim().toLowerCase()

/** What makes two records the same real-world thing when their ids differ. */
function identity(collection: ImportCollection, row: Row): string {
  switch (collection) {
    case 'opportunities':
      return clean(row.projectName) && `${clean(row.projectName)}|${clean(row.entityName)}`
    case 'tasks':
      return clean(row.action) && `${clean(row.action)}|${clean(row.opportunityId)}|${clean(row.dueDate)}`
    case 'documents':
      return clean(row.name) && `${clean(row.name)}|${clean(row.opportunityId)}`
    case 'contacts':
      return clean(row.email) || clean(row.name)
    case 'dealLeads':
      return clean(row.email) || clean(row.name)
  }
}

function labelOf(row: Row, id: string): string {
  const value = row.projectName ?? row.action ?? row.name
  return typeof value === 'string' && value.trim() ? value.trim() : id
}

export function compareImport(database: PortableDatabase, current: Current, fileName: string): ImportPreview {
  const rows: ImportRow[] = []
  for (const collection of IMPORT_COLLECTIONS) {
    const incoming = (database[collection] ?? []) as unknown as Row[]
    const saved = current[collection] as unknown as Row[]
    const byId = new Map(saved.map((row) => [String(row.id), row]))
    const identities = new Set(saved.map((row) => identity(collection, row)).filter(Boolean))
    const seen = new Set<string>()
    for (const row of incoming) {
      const id = String(row?.id ?? '')
      if (!id || seen.has(id)) continue
      seen.add(id)
      const existing = byId.get(id)
      const label = labelOf(row, id)
      if (existing) {
        if (comparable(existing) === comparable(row)) rows.push({ collection, id, kind: 'same', label, data: row })
        else rows.push({ collection, id, kind: 'changed', label, data: row, fileIsNewer: String(row.updatedAt ?? '') > String(existing.updatedAt ?? '') })
        continue
      }
      const who = identity(collection, row)
      rows.push({ collection, id, kind: who && identities.has(who) ? 'duplicate' : 'new', label, data: row })
    }
  }
  const counts: Record<ImportKind, number> = { new: 0, same: 0, changed: 0, duplicate: 0 }
  for (const row of rows) counts[row.kind] += 1
  return { fileName, rows, counts }
}
