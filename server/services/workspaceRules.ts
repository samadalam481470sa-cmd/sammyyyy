/**
 * Rules the server enforces on shared records. Keeping them here means the browser can never
 * talk its way past them, even with a stale screen or a hand-written request.
 */

type Row = Record<string, unknown>

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase()

export interface LeadDependencies {
  primary: number
  additional: number
  taskOwner: number
  /** Deals that still carry this lead's name without an id, kept for reporting. */
  legacyName: number
  total: number
}

/** Everything that still points at a lead. A lead with any of these cannot be deleted. */
export function leadDependencies(lead: Row, opportunities: readonly Row[], tasks: readonly Row[]): LeadDependencies {
  const id = String(lead.id ?? '')
  const name = norm(lead.name)
  let primary = 0
  let additional = 0
  let legacyName = 0
  for (const opp of opportunities) {
    if (opp.primaryLeadId === id) primary += 1
    else if (name && !opp.primaryLeadId && norm(opp.dealLead) === name) legacyName += 1
    if (Array.isArray(opp.additionalLeadIds) && opp.additionalLeadIds.includes(id)) additional += 1
  }
  let taskOwner = 0
  for (const task of tasks) {
    if (task.deletedAt) continue
    if (task.ownerId === id || (name && norm(task.owner) === name)) taskOwner += 1
  }
  return { primary, additional, taskOwner, legacyName, total: primary + additional + taskOwner + legacyName }
}

/**
 * Any signed-in person may edit a lead, but the Microsoft account link does not follow those edits.
 * It can only be set from empty to the person's own account, and it never moves after that.
 */
export function protectLeadIdentity(incoming: Row, existing: Row | null, subject: string | null): Row {
  const current = (existing?.authAccountId as string | null | undefined) ?? null
  const asked = (incoming.authAccountId as string | null | undefined) ?? null
  const authAccountId = current ?? (asked && asked === subject ? asked : null)
  return { ...incoming, authAccountId }
}

/** Lead ids this change newly adds to a deal or task. Existing references are history and stay valid. */
export function deadLeadReferences(collection: 'opportunities' | 'tasks', incoming: Row, existing: Row | null): string[] {
  const refs = (row: Row | null): string[] => {
    if (!row) return []
    if (collection === 'tasks') return row.ownerId ? [String(row.ownerId)] : []
    const extra = Array.isArray(row.additionalLeadIds) ? row.additionalLeadIds.map(String) : []
    return row.primaryLeadId ? [String(row.primaryLeadId), ...extra] : extra
  }
  const before = new Set(refs(existing))
  return refs(incoming).filter((id) => !before.has(id))
}

/** Top-level field names that differ, for the audit trail. Values are never logged. */
export function changedFields(before: Row | null, after: Row | null): string[] {
  if (!before || !after) return []
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter((key) => key !== 'id' && JSON.stringify(before[key]) !== JSON.stringify(after[key])).sort()
}
