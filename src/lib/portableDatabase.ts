/**
 * App-owned portable CRM database.
 * When no external database is configured, each device keeps this document in
 * local storage. A downloaded copy is pretty-printed JSON so Windows, Mac,
 * Linux, phones, and tablets can open and edit the same file.
 */
import type { ActivityItem, Opportunity } from '@/types'
import { mockOpportunities } from '@/data/mockOpportunities'
import {
  mockContacts,
  mockDocuments,
  mockTasksDb,
  type ContactRecord,
  type DocumentRecord,
  type TaskRecord,
} from '@/data/mockModules'
import { coverOpportunities, mergeMissingById, sprintExtraTasks } from '@/data/sprintSeed'
import { loadOwnedCollection, saveOwnedCollection } from '@/lib/demoStore'

/** 1 = device records with no portable marker. 2 = current portable document. */
export const SCHEMA_VERSION = 2

/** Matches package.json version. The seed file and downloads stamp this build. */
export const APP_VERSION = '0.0.0'

export const DATABASE_DOWNLOAD_FILENAME = 'Newport-CRM-Database.json'
export const SEED_SNAPSHOT_FILE = 'database/newport-crm.json'
export const DATABASE_FILE_ERROR = 'This file is not a Newport CRM database.'
export const DATABASE_VERSION_ERROR = 'This database is from a newer version of the app.'

const SCHEMA_KEY_PREFIX = 'newport_crm_portable_schema__'

export interface PortableCollections {
  opportunities: Opportunity[]
  tasks: TaskRecord[]
  contacts: ContactRecord[]
  documents: DocumentRecord[]
  activity: ActivityItem[]
}

export interface PortableDatabase extends PortableCollections {
  schemaVersion: number
  appVersion: string
  exportedAt: string
}

export interface SeedSnapshot extends PortableCollections {
  schemaVersion: number
  appVersion: string
}

export type PortableImportResult =
  | { ok: true; database: PortableDatabase }
  | { ok: false; error: string }

function schemaKey(owner: string): string {
  return `${SCHEMA_KEY_PREFIX}${owner}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readSchemaVersion(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return null
  return value
}

function readRows<T extends { id: string }>(value: unknown): T[] | null {
  if (!Array.isArray(value)) return null
  const rows: T[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id.trim() === '') return null
    rows.push(item as T)
  }
  return rows
}

function stableJson(rows: readonly object[]): string {
  const normalized = rows.map((row) => {
    const record = row as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(record).sort()) sorted[key] = record[key]
    return sorted
  })
  return JSON.stringify(normalized)
}

function collectionsDiffer(before: PortableCollections, after: PortableCollections): boolean {
  return (
    stableJson(before.opportunities) !== stableJson(after.opportunities) ||
    stableJson(before.tasks) !== stableJson(after.tasks) ||
    stableJson(before.contacts) !== stableJson(after.contacts) ||
    stableJson(before.documents) !== stableJson(after.documents) ||
    stableJson(before.activity) !== stableJson(after.activity)
  )
}

/** Fill fields the screens expect. Existing values, including an edited project name, stay. */
function normalizeOpportunity(row: Opportunity): Opportunity {
  const record = row as Opportunity & {
    outstandingItems?: unknown
    diligenceNotes?: unknown
    dealLead?: unknown
    attentionReasons?: unknown
  }
  return {
    ...row,
    projectName: typeof row.projectName === 'string' ? row.projectName : '',
    entityName: typeof row.entityName === 'string' ? row.entityName : '',
    type: row.type ?? 'Platform Acquisition',
    status: row.status ?? 'Pending',
    stage: row.stage ?? 'Target Identified',
    dealLead: typeof record.dealLead === 'string' ? record.dealLead : '',
    sourceType: row.sourceType ?? 'Other',
    sourceName: typeof row.sourceName === 'string' ? row.sourceName : '',
    specialty: typeof row.specialty === 'string' ? row.specialty : '',
    geography: typeof row.geography === 'string' ? row.geography : '',
    nwp: typeof row.nwp === 'number' ? row.nwp : 0,
    netRevenue: typeof row.netRevenue === 'number' ? row.netRevenue : 0,
    pfEbitda: typeof row.pfEbitda === 'number' ? row.pfEbitda : 0,
    nextAction: row.nextAction ?? null,
    nextActionDate: row.nextActionDate ?? null,
    priority: row.priority ?? 'B',
    lastActivityDate: typeof row.lastActivityDate === 'string' ? row.lastActivityDate : '',
    needsAttention: row.needsAttention === true,
    attentionReasons: Array.isArray(record.attentionReasons) ? record.attentionReasons : [],
    outstandingItems: Array.isArray(record.outstandingItems) ? record.outstandingItems : [],
    diligenceNotes: typeof record.diligenceNotes === 'string' ? record.diligenceNotes : '',
  }
}

export function sameRecordIds(left: readonly { id: string }[], right: readonly { id: string }[]): boolean {
  if (left.length !== right.length) return false
  const counts = new Map<string, number>()
  for (const row of left) counts.set(row.id, (counts.get(row.id) ?? 0) + 1)
  for (const row of right) {
    const next = (counts.get(row.id) ?? 0) - 1
    if (next < 0) return false
    counts.set(row.id, next)
  }
  return true
}

export function applySchemaMigrations(doc: PortableDatabase): PortableDatabase {
  return {
    ...doc,
    schemaVersion: SCHEMA_VERSION,
    appVersion: doc.appVersion || APP_VERSION,
    opportunities: doc.opportunities.map((row) => normalizeOpportunity(row)),
  }
}

export function mergeSeedRecords(doc: PortableDatabase, seeds: SeedSnapshot): PortableDatabase {
  return {
    ...doc,
    schemaVersion: SCHEMA_VERSION,
    appVersion: doc.appVersion || seeds.appVersion || APP_VERSION,
    opportunities: mergeMissingById(doc.opportunities, seeds.opportunities),
    tasks: mergeMissingById(doc.tasks, seeds.tasks),
    contacts: mergeMissingById(doc.contacts, seeds.contacts),
    documents: mergeMissingById(doc.documents, seeds.documents),
    activity: mergeMissingById(doc.activity, seeds.activity),
  }
}

export function migrateStoredCrm(
  stored: PortableCollections & { schemaVersion: number | null },
  seeds: SeedSnapshot,
): { database: PortableDatabase; contentChanged: boolean } {
  const migrated = applySchemaMigrations({
    schemaVersion: stored.schemaVersion ?? 1,
    appVersion: APP_VERSION,
    exportedAt: '',
    opportunities: stored.opportunities,
    tasks: stored.tasks,
    contacts: stored.contacts,
    documents: stored.documents,
    activity: stored.activity,
  })
  const database = mergeSeedRecords(migrated, seeds)
  return { database, contentChanged: collectionsDiffer(stored, database) }
}

export function buildPortableDatabase(collections: PortableCollections, exportedAt: string): PortableDatabase {
  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt,
    opportunities: collections.opportunities,
    tasks: collections.tasks,
    contacts: collections.contacts,
    documents: collections.documents,
    activity: collections.activity,
  }
}

export function serializePortableDatabase(doc: PortableDatabase): string {
  return `${JSON.stringify(doc, null, 2)}\n`
}

export function portableDatabaseDownload(doc: PortableDatabase): { filename: string; body: string; type: string } {
  return {
    filename: DATABASE_DOWNLOAD_FILENAME,
    body: serializePortableDatabase(doc),
    type: 'application/json',
  }
}

export function downloadPortableDatabase(doc: PortableDatabase): void {
  const payload = portableDatabaseDownload(doc)
  const blob = new Blob([payload.body], { type: payload.type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = payload.filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function parsePortableDatabase(raw: string): PortableImportResult {
  let value: unknown
  try {
    value = JSON.parse(raw) as unknown
  } catch {
    return { ok: false, error: DATABASE_FILE_ERROR }
  }
  if (!isRecord(value)) return { ok: false, error: DATABASE_FILE_ERROR }
  const schemaVersion = readSchemaVersion(value.schemaVersion)
  if (schemaVersion == null) return { ok: false, error: DATABASE_FILE_ERROR }
  if (schemaVersion > SCHEMA_VERSION) return { ok: false, error: DATABASE_VERSION_ERROR }
  const opportunities = readRows<Opportunity>(value.opportunities)
  const tasks = readRows<TaskRecord>(value.tasks)
  const contacts = readRows<ContactRecord>(value.contacts)
  const documents = readRows<DocumentRecord>(value.documents)
  const activity = readRows<ActivityItem>(value.activity)
  if (!opportunities || !tasks || !contacts || !documents || !activity) {
    return { ok: false, error: DATABASE_FILE_ERROR }
  }
  const exportedAt = typeof value.exportedAt === 'string' && value.exportedAt ? value.exportedAt : ''
  const appVersion = typeof value.appVersion === 'string' && value.appVersion ? value.appVersion : APP_VERSION
  return {
    ok: true,
    database: {
      schemaVersion,
      appVersion,
      exportedAt,
      opportunities,
      tasks,
      contacts,
      documents,
      activity,
    },
  }
}

export function importPortableText(raw: string, seeds: SeedSnapshot): PortableImportResult {
  const parsed = parsePortableDatabase(raw)
  if (!parsed.ok) return parsed
  return { ok: true, database: mergeSeedRecords(applySchemaMigrations(parsed.database), seeds) }
}

export function parseSeedSnapshot(value: unknown): SeedSnapshot | null {
  if (!isRecord(value)) return null
  const schemaVersion = readSchemaVersion(value.schemaVersion)
  if (schemaVersion == null) return null
  const opportunities = readRows<Opportunity>(value.opportunities)
  const tasks = readRows<TaskRecord>(value.tasks)
  const contacts = readRows<ContactRecord>(value.contacts)
  const documents = readRows<DocumentRecord>(value.documents)
  const activity = readRows<ActivityItem>(value.activity)
  if (!opportunities || !tasks || !contacts || !documents || !activity) return null
  const appVersion = typeof value.appVersion === 'string' && value.appVersion ? value.appVersion : APP_VERSION
  return { schemaVersion, appVersion, opportunities, tasks, contacts, documents, activity }
}

export function seedSnapshotUrl(baseHref: string): string {
  const base = baseHref.endsWith('/') ? baseHref : `${baseHref}/`
  return new URL(SEED_SNAPSHOT_FILE, base).href
}

export async function fetchSeedSnapshot(
  baseHref: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<SeedSnapshot | null> {
  try {
    const response = await fetchImpl(seedSnapshotUrl(baseHref), { cache: 'no-store' })
    if (!response.ok) return null
    return parseSeedSnapshot(await response.json())
  } catch {
    return null
  }
}

let cachedSeeds: SeedSnapshot | null = null

/** Seed rows shipped with this build. Devices merge these by id on load. */
export function bundledSeedSnapshot(): SeedSnapshot {
  if (cachedSeeds) return cachedSeeds
  const opportunities = mockOpportunities
  cachedSeeds = {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    opportunities,
    tasks: mergeMissingById(mockTasksDb, sprintExtraTasks()),
    contacts: coverOpportunities(mockContacts, opportunities),
    documents: mockDocuments,
    activity: [],
  }
  return cachedSeeds
}

export function readStoredSchemaVersion(owner: string): number | null {
  try {
    return readSchemaVersion(Number(localStorage.getItem(schemaKey(owner))))
  } catch {
    return null
  }
}

export function writeStoredSchemaVersion(owner: string, version: number): void {
  try {
    localStorage.setItem(schemaKey(owner), String(version))
  } catch {
    // private mode / quota
  }
}

export function readDeviceCollections(owner: string): PortableCollections {
  return {
    opportunities: loadOwnedCollection<Opportunity>('opportunities', owner, []),
    tasks: loadOwnedCollection<TaskRecord>('tasks', owner, []),
    contacts: loadOwnedCollection<ContactRecord>('contacts', owner, []),
    documents: loadOwnedCollection<DocumentRecord>('documents', owner, []),
    activity: loadOwnedCollection<ActivityItem>('activity', owner, []),
  }
}

export function writeDeviceCollections(owner: string, collections: PortableCollections): void {
  saveOwnedCollection('opportunities', owner, collections.opportunities)
  saveOwnedCollection('tasks', owner, collections.tasks)
  saveOwnedCollection('contacts', owner, collections.contacts)
  saveOwnedCollection('documents', owner, collections.documents)
  saveOwnedCollection('activity', owner, collections.activity)
}

export function persistMigratedDatabase(
  owner: string,
  loaded: PortableCollections,
  seeds: SeedSnapshot = bundledSeedSnapshot(),
): PortableDatabase {
  const version = readStoredSchemaVersion(owner)
  const { database, contentChanged } = migrateStoredCrm({ ...loaded, schemaVersion: version }, seeds)
  if (contentChanged) writeDeviceCollections(owner, database)
  if (version !== SCHEMA_VERSION) writeStoredSchemaVersion(owner, SCHEMA_VERSION)
  return database
}

export function importDeviceDatabase(
  owner: string,
  raw: string,
  seeds: SeedSnapshot = bundledSeedSnapshot(),
): PortableImportResult {
  const result = importPortableText(raw, seeds)
  if (!result.ok) return result
  writeDeviceCollections(owner, result.database)
  writeStoredSchemaVersion(owner, SCHEMA_VERSION)
  return result
}

export function exportDeviceDatabase(owner: string, exportedAt: string): PortableDatabase {
  return buildPortableDatabase(readDeviceCollections(owner), exportedAt)
}
