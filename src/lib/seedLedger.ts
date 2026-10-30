/**
 * Seed ledger: remembers, per signed-in owner, every seed row that was ever placed in their data.
 *
 * Rules
 * - A seed row is added at most once. After that, a user's edit or deletion always wins.
 * - Browsers that already had CRM data before this ledger existed start with every older seed
 *   row marked as already seeded, so documents or deals they deleted earlier stay deleted.
 *   Only seed rows that did not ship before (for example the Oct 30, 2026 rows) are added for them.
 * - New deals never take a project name or deal number that is already in use.
 */
import type { Opportunity } from '@/types'
import type { PortableDatabase, SeedSnapshot } from '@/lib/portableDatabase'
import { indexToLetterCode } from '@/lib/demoAliases'
import { mockOpportunities } from '@/data/mockOpportunities'
import { mockContacts, mockDocuments, mockTasksDb } from '@/data/mockModules'
import { coverOpportunities, sprintExtraTasks } from '@/data/sprintSeed'

const LEDGER_PREFIX = 'newport_crm_seed_ledger__'

type CollectionName = 'opportunities' | 'tasks' | 'contacts' | 'documents' | 'activity'
const COLLECTIONS: CollectionName[] = ['opportunities', 'tasks', 'contacts', 'documents', 'activity']

export interface SeedLedger {
  /** True when this owner had data before the ledger existed. Older seed rows are never re-added. */
  legacyBaseline: boolean
  seen: Set<string>
}

function ledgerKey(owner: string): string {
  return `${LEDGER_PREFIX}${owner}`
}

export function readSeedLedger(owner: string): SeedLedger | null {
  try {
    const raw = localStorage.getItem(ledgerKey(owner))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { legacyBaseline?: unknown; seen?: unknown }
    if (!Array.isArray(parsed.seen)) return null
    return {
      legacyBaseline: parsed.legacyBaseline === true,
      seen: new Set(parsed.seen.filter((row): row is string => typeof row === 'string')),
    }
  } catch {
    return null
  }
}

export function writeSeedLedger(owner: string, ledger: SeedLedger): void {
  try {
    localStorage.setItem(
      ledgerKey(owner),
      JSON.stringify({ legacyBaseline: ledger.legacyBaseline, seen: [...ledger.seen].sort() }),
    )
  } catch {
    // private mode / quota: the merge still behaves for this session
  }
}

let legacyKeys: Set<string> | null = null

/** Seed rows that shipped before the ledger existed (dataset "anon-letter-v1" and its sprint rows). */
export function legacySeedKeys(): Set<string> {
  if (legacyKeys) return legacyKeys
  legacyKeys = new Set([
    ...mockOpportunities.map((row) => `opportunities/${row.id}`),
    ...mockTasksDb.map((row) => `tasks/${row.id}`),
    ...sprintExtraTasks().map((row) => `tasks/${row.id}`),
    ...coverOpportunities(mockContacts, mockOpportunities).map((row) => `contacts/${row.id}`),
    ...mockDocuments.map((row) => `documents/${row.id}`),
  ])
  return legacyKeys
}

function isLegacySeedKey(key: string): boolean {
  return legacySeedKeys().has(key)
}

function usedNames(rows: Opportunity[]): Set<string> {
  return new Set(rows.map((row) => row.projectName.trim().toLowerCase()).filter(Boolean))
}

/** Give a new seed deal a free project name and deal number when its own are already taken. */
function placeNewDeal(seed: Opportunity, existing: Opportunity[]): Opportunity {
  const names = usedNames(existing)
  const numbers = new Set(existing.map((row) => row.projectNumber).filter((n): n is number => typeof n === 'number'))
  let projectName = seed.projectName
  if (names.has(projectName.trim().toLowerCase())) {
    for (let index = 42; index < 2000; index += 1) {
      const candidate = `Project ${indexToLetterCode(index)}`
      if (!names.has(candidate.toLowerCase())) {
        projectName = candidate
        break
      }
    }
  }
  let projectNumber = seed.projectNumber
  if (projectNumber == null || numbers.has(projectNumber)) {
    projectNumber = Math.max(0, ...numbers) + 1
  }
  if (projectName === seed.projectName && projectNumber === seed.projectNumber) return seed
  return { ...seed, projectName, projectNumber, entityName: projectName.replace(/^Project /, 'Entity ') }
}

/**
 * Pure merge. Returns the merged database and the updated ledger.
 * Rows already present are recorded as seen; missing rows are added only if never seen.
 */
export function mergeSeedRecordsOnce(
  doc: PortableDatabase,
  seeds: SeedSnapshot,
  ledger: SeedLedger,
): { database: PortableDatabase; ledger: SeedLedger } {
  const seen = new Set(ledger.seen)
  const next = { ...doc } as PortableDatabase
  const renamedDeals = new Map<string, Opportunity>()
  for (const name of COLLECTIONS) {
    const current = doc[name] as { id: string }[]
    const present = new Set(current.map((row) => row.id))
    for (const id of present) seen.add(`${name}/${id}`)
    const additions: { id: string }[] = []
    for (const row of seeds[name] as { id: string }[]) {
      const key = `${name}/${row.id}`
      if (present.has(row.id) || seen.has(key)) continue
      if (ledger.legacyBaseline && isLegacySeedKey(key)) {
        seen.add(key)
        continue
      }
      seen.add(key)
      if (name === 'opportunities') {
        const placed = placeNewDeal(row as Opportunity, [...(current as Opportunity[]), ...(additions as Opportunity[])])
        if (placed !== row) renamedDeals.set(placed.id, placed)
        additions.push(placed)
      } else {
        additions.push(row)
      }
    }
    if (additions.length) (next as unknown as Record<string, unknown[]>)[name] = [...current, ...additions]
  }
  if (renamedDeals.size) {
    // Keep task and contact project labels in step with a deal that had to take a new name.
    next.tasks = next.tasks.map((task) =>
      task.opportunityId && renamedDeals.has(task.opportunityId)
        ? { ...task, projectName: renamedDeals.get(task.opportunityId)!.projectName }
        : task,
    )
    next.contacts = next.contacts.map((contact) =>
      contact.opportunityId && renamedDeals.has(contact.opportunityId)
        ? { ...contact, projectName: renamedDeals.get(contact.opportunityId)!.projectName }
        : contact,
    )
  }
  return { database: next, ledger: { legacyBaseline: ledger.legacyBaseline, seen } }
}

/**
 * Merge seeds for one owner and save the ledger.
 * `hadDataBefore` marks an owner whose browser stored CRM data before the ledger existed.
 */
export function mergeSeedRecordsForOwner(
  doc: PortableDatabase,
  seeds: SeedSnapshot,
  owner: string,
  hadDataBefore = true,
): PortableDatabase {
  const ledger = readSeedLedger(owner) ?? { legacyBaseline: hadDataBefore, seen: new Set<string>() }
  const result = mergeSeedRecordsOnce(doc, seeds, ledger)
  writeSeedLedger(owner, result.ledger)
  return result.database
}
