import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildPortableDatabase,
  bundledSeedSnapshot,
  persistMigratedDatabase,
  readDeviceCollections,
  writeDeviceCollections,
  writeStoredSchemaVersion,
  type PortableCollections,
} from './portableDatabase'
import { mergeSeedRecordsOnce, readSeedLedger } from './seedLedger'
import { seedV2Opportunities, seedV2Tasks } from '@/data/sprintSeedV2'
import { mockDocuments } from '@/data/mockModules'
import { saveOwnedCollection } from './demoStore'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, String(value)),
  }
}

const owner = 'email:ledger@example.com'

function countIds(rows: { id: string }[]) {
  return new Set(rows.map((row) => row.id)).size === rows.length
}

describe('seed ledger', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })

  it('adds every seed row once for a fresh browser and adds nothing on reload', () => {
    const empty: PortableCollections = { opportunities: [], tasks: [], contacts: [], documents: [], activity: [] }
    const first = persistMigratedDatabase(owner, empty)
    expect(first.opportunities).toHaveLength(62)
    const second = persistMigratedDatabase(owner, readDeviceCollections(owner))
    const third = persistMigratedDatabase(owner, readDeviceCollections(owner))
    expect(second.opportunities).toHaveLength(62)
    expect(third.tasks).toHaveLength(second.tasks.length)
    expect(countIds(third.opportunities) && countIds(third.tasks) && countIds(third.contacts)).toBe(true)
  })

  it('never restores a deleted custom document or a deleted new deal', () => {
    persistMigratedDatabase(owner, { opportunities: [], tasks: [], contacts: [], documents: [], activity: [] })
    const stored = readDeviceCollections(owner)
    const custom = stored.documents.find((doc) => doc.docType === 'Financials')!
    expect(custom).toBeTruthy()
    writeDeviceCollections(owner, {
      ...stored,
      documents: stored.documents.filter((doc) => doc.id !== custom.id),
      opportunities: stored.opportunities.filter((row) => row.id !== 'opp-aq'),
    })
    for (let i = 0; i < 3; i += 1) {
      const reloaded = persistMigratedDatabase(owner, readDeviceCollections(owner))
      expect(reloaded.documents.some((doc) => doc.id === custom.id)).toBe(false)
      expect(reloaded.opportunities.some((row) => row.id === 'opp-aq')).toBe(false)
    }
  })

  it('keeps earlier deletions for a browser that had data before the ledger, and adds only new rows', () => {
    // A browser from before this sprint: it already deleted doc-2 and edited Project A.
    const seeds = bundledSeedSnapshot()
    const legacyOpps = seeds.opportunities.filter((row) => !row.id.match(/^opp-(a[q-z]|b[a-j])$/))
    saveOwnedCollection('opportunities', owner, legacyOpps.map((row) => (row.id === 'opp-a' ? { ...row, projectName: 'Edited A' } : row)))
    saveOwnedCollection('documents', owner, mockDocuments.filter((doc) => doc.id !== 'doc-2'))
    saveOwnedCollection('tasks', owner, [])
    saveOwnedCollection('contacts', owner, [])
    writeStoredSchemaVersion(owner, 2)
    const merged = persistMigratedDatabase(owner, readDeviceCollections(owner))
    expect(merged.documents.some((doc) => doc.id === 'doc-2')).toBe(false)
    expect(merged.opportunities.find((row) => row.id === 'opp-a')?.projectName).toBe('Edited A')
    expect(merged.opportunities).toHaveLength(62)
    // Older seed tasks the browser removed stay removed; the 20 new tasks arrive.
    expect(merged.tasks.map((row) => row.id).sort()).toEqual(seedV2Tasks.map((row) => row.id).sort())
    expect(readSeedLedger(owner)?.legacyBaseline).toBe(true)
  })

  it('never reuses an existing project name or deal number for a new deal', () => {
    const seeds = bundledSeedSnapshot()
    const mine = { ...seeds.opportunities[0], id: 'opp_local_1', projectName: 'Project AQ', projectNumber: 43 }
    const doc = buildPortableDatabase(
      { opportunities: [...seeds.opportunities.slice(0, 42), mine], tasks: [], contacts: [], documents: [], activity: [] },
      '',
    )
    const { database } = mergeSeedRecordsOnce(doc, seeds, { legacyBaseline: true, seen: new Set() })
    const names = database.opportunities.map((row) => row.projectName.toLowerCase())
    const numbers = database.opportunities.map((row) => row.projectNumber)
    expect(new Set(names).size).toBe(names.length)
    expect(new Set(numbers).size).toBe(numbers.length)
    const moved = database.opportunities.find((row) => row.id === 'opp-aq')!
    expect(moved.projectName).not.toBe('Project AQ')
    expect(database.tasks.filter((t) => t.opportunityId === 'opp-aq').every((t) => t.projectName === moved.projectName)).toBe(true)
    expect(seedV2Opportunities).toHaveLength(20)
  })
})
