/**
 * Field-aware merge when two people edit one record at the same time.
 * A field only one person changed is kept. A field both changed to different values is a real
 * conflict: the saved value stays, and the person is told exactly what was not applied.
 */

type Row = Record<string, unknown>

/** Worked out from other records or stamped on every save, so a difference here is never a real conflict. */
const DERIVED_FIELDS = new Set([
  'id',
  'updatedAt',
  'nextAction',
  'nextActionDate',
  'nextActionTaskId',
  'attentionReasons',
  'needsAttention',
  'attention',
  'projectName_lower',
])

/** Stamped or appended by saves. One person's change is kept; both changing it is not news to anyone. */
const QUIET_FIELDS = new Set(['lastActivity', 'lastActivityAt', 'lastActivityDate', 'lastActivityLabel', 'statusHistory', 'stageHistory', 'dueDateHistory', 'restoreHistory', 'closedHistory'])

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export interface FieldConflict {
  field: string
  mine: unknown
  theirs: unknown
}

export interface MergeResult {
  /** The record to keep. Null when it stays deleted. */
  merged: Row | null
  /** True when the merged record still holds changes the server does not have. */
  hasMine: boolean
  conflicts: FieldConflict[]
  /** The other person deleted it, or this person deleted what the other person edited. */
  deleteConflict: 'theirs-deleted' | 'mine-deleted' | null
}

export function mergeRecord(base: Row | null, mine: Row | null, theirs: Row | null): MergeResult {
  if (!theirs) {
    // Deleted on the server. Editing an out-of-date copy never brings it back.
    return { merged: null, hasMine: false, conflicts: [], deleteConflict: mine && base && !same(mine, base) ? 'theirs-deleted' : mine && !base ? 'theirs-deleted' : null }
  }
  if (!mine) return { merged: theirs, hasMine: false, conflicts: [], deleteConflict: 'mine-deleted' }
  const merged: Row = { ...theirs }
  const conflicts: FieldConflict[] = []
  let hasMine = false
  for (const field of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
    if (DERIVED_FIELDS.has(field)) continue
    const m = mine[field]
    const t = theirs[field]
    const b = base?.[field]
    if (same(m, t) || same(m, b)) continue
    if (base && same(t, b)) {
      merged[field] = m
      hasMine = true
      continue
    }
    if (!QUIET_FIELDS.has(field)) conflicts.push({ field, mine: m, theirs: t })
  }
  return { merged, hasMine, conflicts, deleteConflict: null }
}

/** Field names as people read them. */
export function fieldLabel(field: string): string {
  const named: Record<string, string> = {
    status: 'Status',
    stage: 'Acquisition Stage',
    dealLead: 'Deal Lead',
    primaryLeadId: 'Primary Deal Lead',
    additionalLeadIds: 'Additional Deal Leads',
    action: 'Action',
    dueDate: 'Due Date',
    ownerId: 'Owner',
    owner: 'Owner',
    priority: 'Priority',
    notes: 'Notes',
  }
  if (named[field]) return named[field]
  const words = field.replace(/([a-z])([A-Z])/g, '$1 $2')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function displayValue(value: unknown): string {
  if (value == null || value === '') return 'empty'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.length ? `${value.length} items` : 'empty'
  return 'a changed value'
}

/** The name people use for a record, without assuming its type. */
export function recordLabel(row: Row | null, fallback: string): string {
  const value = row?.projectName ?? row?.action ?? row?.name ?? row?.message
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}
