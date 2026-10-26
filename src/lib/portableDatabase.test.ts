/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivityItem, Opportunity } from '@/types'
import type { ContactRecord, DocumentRecord, TaskRecord } from '@/data/mockModules'
import { saveOwnedCollection } from '@/lib/demoStore'
import {
  APP_VERSION,
  DATABASE_DOWNLOAD_FILENAME,
  DATABASE_FILE_ERROR,
  DATABASE_VERSION_ERROR,
  bundledSeedSnapshot,
  exportDeviceDatabase,
  fetchSeedSnapshot,
  importDeviceDatabase,
  importPortableText,
  persistMigratedDatabase,
  portableDatabaseDownload,
  readDeviceCollections,
  readStoredSchemaVersion,
  SCHEMA_VERSION,
  serializePortableDatabase,
  buildPortableDatabase,
  writeStoredSchemaVersion,
  type SeedSnapshot,
} from '@/lib/portableDatabase'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function memoryStorage() {
  const store: Record<string, string> = {}
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key]
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
}

const emptySeeds: SeedSnapshot = {
  schemaVersion: SCHEMA_VERSION,
  appVersion: APP_VERSION,
  opportunities: [],
  tasks: [],
  contacts: [],
  documents: [],
  activity: [],
}

function opportunity(id: string, projectName: string): Opportunity {
  return {
    id,
    projectName,
    entityName: 'Company A',
    type: 'Platform Acquisition',
    status: 'Active',
    stage: 'Target Identified',
    dealLead: 'Mary Sbaschnig',
    sourceType: 'Other',
    sourceName: '',
    specialty: '',
    geography: '',
    nwp: 1,
    netRevenue: 1,
    pfEbitda: 1,
    nextAction: null,
    nextActionDate: null,
    priority: 'B',
    lastActivityDate: '2026-10-01',
    needsAttention: false,
    attentionReasons: [],
    outstandingItems: ['item'],
    diligenceNotes: 'notes',
  }
}

function task(id: string, action: string): TaskRecord {
  return {
    id,
    priority: 'A',
    action,
    opportunityId: 'opp-a',
    projectName: 'Project A',
    owner: 'Mary Sbaschnig',
    dueDate: '2026-10-26',
    status: 'Open',
    notes: '',
  }
}

function contact(id: string): ContactRecord {
  return {
    id,
    name: 'Alex',
    title: 'CEO',
    company: 'Company A',
    category: 'Management',
    email: 'alex@fictional-demo.test',
    phone: '(555) 010-0100',
    opportunityId: 'opp-a',
    projectName: 'Project A',
    status: 'Active',
    lastContactDate: '2026-10-12',
    notes: '',
  }
}

function documentRow(id: string): DocumentRecord {
  return {
    id,
    name: 'NDA',
    docType: 'NDA',
    opportunityId: 'opp-a',
    projectName: 'Project A',
    status: 'Draft',
    confidentiality: 'Internal',
    uploadedBy: 'Mary Sbaschnig',
    link: '',
    uploadedAt: '2026-10-01',
    notes: '',
  }
}

function activity(id: string): ActivityItem {
  return {
    id,
    actor: 'Mary',
    message: 'updated Project A',
    projectName: 'Project A',
    timestamp: '2026-10-26T00:00:00.000Z',
    type: 'update',
  }
}

describe('portable database', () => {
  const exportedAt = '2026-10-26T15:04:00.000Z'

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exports the current records with schema version, app version, and a timestamp', () => {
    const doc = buildPortableDatabase(
      {
        opportunities: [opportunity('opp-a', 'Project A')],
        tasks: [task('task-1', 'Call')],
        contacts: [contact('rel-1')],
        documents: [documentRow('doc-1')],
        activity: [activity('act-1')],
      },
      exportedAt,
    )
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION)
    expect(doc.appVersion).toBe(APP_VERSION)
    expect(doc.exportedAt).toBe(exportedAt)
    expect(doc.opportunities[0]?.projectName).toBe('Project A')
    expect(doc.tasks).toHaveLength(1)
    expect(doc.contacts).toHaveLength(1)
    expect(doc.documents).toHaveLength(1)
    expect(doc.activity).toHaveLength(1)
    const body = serializePortableDatabase(doc)
    expect(body).toContain(`"schemaVersion": ${SCHEMA_VERSION}`)
    expect(body).toContain('\n  "opportunities"')
    expect(portableDatabaseDownload(doc)).toMatchObject({
      filename: DATABASE_DOWNLOAD_FILENAME,
      type: 'application/json',
      body,
    })
    expect(DATABASE_DOWNLOAD_FILENAME).toBe('Newport-CRM-Database.json')
  })

  it('round-trips an import without dropping records', () => {
    const doc = buildPortableDatabase(
      {
        opportunities: [opportunity('opp-a', 'Edited Name')],
        tasks: [task('task-1', 'Edited task')],
        contacts: [contact('rel-1')],
        documents: [documentRow('doc-1')],
        activity: [activity('act-1')],
      },
      exportedAt,
    )
    const imported = importPortableText(serializePortableDatabase(doc), emptySeeds)
    expect(imported.ok).toBe(true)
    if (!imported.ok) return
    expect(imported.database.schemaVersion).toBe(SCHEMA_VERSION)
    expect(imported.database.exportedAt).toBe(exportedAt)
    expect(imported.database.opportunities).toEqual(doc.opportunities)
    expect(imported.database.tasks).toEqual(doc.tasks)
    expect(imported.database.contacts).toEqual(doc.contacts)
    expect(imported.database.documents).toEqual(doc.documents)
    expect(imported.database.activity).toEqual(doc.activity)
  })

  it('migrates a schema 1 document, keeps an edited name, and adds missing seed ids', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      opportunities: [{ id: 'opp-a', projectName: 'Edited Name', entityName: 'Kept Co' }],
      tasks: [task('task-user', 'Edited task')],
      contacts: [],
      documents: [],
      activity: [],
    })
    const seeds: SeedSnapshot = {
      ...emptySeeds,
      opportunities: [
        opportunity('opp-a', 'Seed Name'),
        opportunity('opp-new', 'New Seed'),
      ],
      tasks: [task('task-user', 'Seed task'), task('task-new', 'New task')],
    }
    const imported = importPortableText(raw, seeds)
    expect(imported.ok).toBe(true)
    if (!imported.ok) return
    expect(imported.database.schemaVersion).toBe(SCHEMA_VERSION)
    const edited = imported.database.opportunities.find((row) => row.id === 'opp-a')
    expect(edited?.projectName).toBe('Edited Name')
    expect(edited?.entityName).toBe('Kept Co')
    expect(edited?.outstandingItems).toEqual([])
    expect(edited?.diligenceNotes).toBe('')
    expect(imported.database.opportunities.some((row) => row.id === 'opp-new')).toBe(true)
    expect(imported.database.tasks.find((row) => row.id === 'task-user')?.action).toBe('Edited task')
    expect(imported.database.tasks.some((row) => row.id === 'task-new')).toBe(true)
  })

  describe('on this device', () => {
    const owner = 'email:editor@example.com'

    beforeEach(() => {
      vi.stubGlobal('localStorage', memoryStorage())
    })

    it('migrates stored schema 1 on load and keeps the edited opportunity', () => {
      writeStoredSchemaVersion(owner, 1)
      saveOwnedCollection('opportunities', owner, [
        { id: 'opp-a', projectName: 'Edited Name', entityName: 'Kept Co' },
      ])
      saveOwnedCollection('tasks', owner, [task('task-user', 'Edited task')])
      const seeds: SeedSnapshot = {
        ...emptySeeds,
        opportunities: [opportunity('opp-a', 'Seed Name'), opportunity('opp-new', 'New Seed')],
        tasks: [task('task-user', 'Seed task'), task('task-new', 'New task')],
      }
      const database = persistMigratedDatabase(owner, readDeviceCollections(owner), seeds)
      expect(database.opportunities.find((row) => row.id === 'opp-a')?.projectName).toBe('Edited Name')
      expect(database.opportunities.some((row) => row.id === 'opp-new')).toBe(true)
      expect(database.tasks.find((row) => row.id === 'task-user')?.action).toBe('Edited task')
      expect(readStoredSchemaVersion(owner)).toBe(SCHEMA_VERSION)
      const stored = readDeviceCollections(owner)
      expect(stored.opportunities.find((row) => row.id === 'opp-a')?.projectName).toBe('Edited Name')
      expect(stored.opportunities.some((row) => row.id === 'opp-new')).toBe(true)
      expect(stored.tasks.some((row) => row.id === 'task-new')).toBe(true)
    })

    it('round-trips a download through import and rejects an invalid file without clearing data', () => {
      const doc = buildPortableDatabase(
        {
          opportunities: [opportunity('opp-a', 'Edited Name')],
          tasks: [task('task-1', 'Edited task')],
          contacts: [contact('rel-1')],
          documents: [documentRow('doc-1')],
          activity: [activity('act-1')],
        },
        exportedAt,
      )
      const imported = importDeviceDatabase(owner, serializePortableDatabase(doc), emptySeeds)
      expect(imported.ok).toBe(true)
      const exported = exportDeviceDatabase(owner, exportedAt)
      expect(exported.schemaVersion).toBe(SCHEMA_VERSION)
      expect(exported.opportunities).toEqual(doc.opportunities)
      expect(exported.tasks).toEqual(doc.tasks)
      expect(exported.contacts).toEqual(doc.contacts)
      expect(exported.documents).toEqual(doc.documents)
      expect(exported.activity).toEqual(doc.activity)
      expect(portableDatabaseDownload(exported).filename).toBe('Newport-CRM-Database.json')

      const invalid = importDeviceDatabase(owner, '{', emptySeeds)
      expect(invalid).toEqual({ ok: false, error: DATABASE_FILE_ERROR })
      const broken = importDeviceDatabase(
        owner,
        JSON.stringify({ schemaVersion: SCHEMA_VERSION, opportunities: [{ name: 'no id' }] }),
        emptySeeds,
      )
      expect(broken).toEqual({ ok: false, error: DATABASE_FILE_ERROR })
      const newer = importDeviceDatabase(
        owner,
        JSON.stringify({
          schemaVersion: SCHEMA_VERSION + 1,
          appVersion: APP_VERSION,
          exportedAt,
          opportunities: [],
          tasks: [],
          contacts: [],
          documents: [],
          activity: [],
        }),
        emptySeeds,
      )
      expect(newer).toEqual({ ok: false, error: DATABASE_VERSION_ERROR })
      expect(exportDeviceDatabase(owner, exportedAt).opportunities).toEqual(doc.opportunities)
      expect(exportDeviceDatabase(owner, exportedAt).tasks).toEqual(doc.tasks)
    })
  })

  it('ships the seed snapshot from the seed modules and fetches it without caching', async () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string }
    expect(APP_VERSION).toBe(pkg.version)
    const seeds = bundledSeedSnapshot()
    expect(seeds.opportunities).toHaveLength(42)
    expect(seeds.tasks.some((row) => row.id === 'task-sprint-1')).toBe(true)
    const file = JSON.parse(readFileSync(resolve(root, 'public/database/newport-crm.json'), 'utf8')) as unknown
    expect(file).toEqual(JSON.parse(JSON.stringify(seeds)))

    const calls: { url: string; init?: RequestInit }[] = []
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return { ok: true, json: async () => seeds }
    }) as typeof fetch
    const fetched = await fetchSeedSnapshot('https://samadalam481470sa-cmd.github.io/sammyyyy/', fetchImpl)
    expect(calls[0]?.url).toBe('https://samadalam481470sa-cmd.github.io/sammyyyy/database/newport-crm.json')
    expect(calls[0]?.init?.cache).toBe('no-store')
    expect(fetched?.opportunities).toHaveLength(42)
  })
})
