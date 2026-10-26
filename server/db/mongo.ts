import { MongoClient, type Db } from 'mongodb'

export type MongoConnectionStatus = 'not-configured' | 'connected' | 'error'

export type MongoStatus = {
  status: MongoConnectionStatus
  ok: boolean
  message?: string
}

const DEFAULT_DB_NAME = 'newport'
const SERVER_SELECTION_TIMEOUT_MS = 4000

let client: MongoClient | null = null
let activeUri: string | null = null
let dbName = DEFAULT_DB_NAME
let status: MongoStatus = { status: 'not-configured', ok: false }
let inflight: Promise<MongoStatus> | null = null
let inflightUri: string | null = null
let generation = 0

function snapshot(): MongoStatus {
  if (status.message) {
    return { status: status.status, ok: status.ok, message: status.message }
  }
  return { status: status.status, ok: status.ok }
}

function configuredUri(): string {
  return process.env.MONGODB_URI?.trim() ?? ''
}

function databaseNameFromUri(uri: string): string {
  try {
    const pathname = new URL(uri).pathname.replace(/^\/+/, '')
    const name = decodeURIComponent(pathname.split('/')[0] ?? '').trim()
    return name || DEFAULT_DB_NAME
  } catch {
    return DEFAULT_DB_NAME
  }
}

function sanitizeMongoError(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'connection failed'
  const redacted = raw
    .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[redacted]')
    .replace(/[^\s:/@]+:[^@\s/]+@/g, '[redacted]@')
  const compact = redacted.replace(/\s+/g, ' ').trim()
  return (compact || 'connection failed').slice(0, 160)
}

async function closeClient(current: MongoClient | null): Promise<void> {
  if (!current) return
  try {
    await current.close()
  } catch {
    // Best-effort shutdown. Do not surface errors that may contain a URI.
  }
}

async function open(uri: string, gen: number): Promise<MongoStatus> {
  let next: MongoClient | null = null
  try {
    next = new MongoClient(uri, { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS })
    await next.connect()
    await next.db('admin').command({ ping: 1 })
    if (gen !== generation) {
      await closeClient(next)
      return snapshot()
    }
    const previous = client
    client = next
    activeUri = uri
    dbName = databaseNameFromUri(uri)
    status = { status: 'connected', ok: true }
    if (previous && previous !== next) await closeClient(previous)
    return snapshot()
  } catch (err) {
    await closeClient(next)
    if (gen !== generation) return snapshot()
    const stale = client
    client = null
    activeUri = null
    if (stale && stale !== next) await closeClient(stale)
    status = { status: 'error', ok: false, message: sanitizeMongoError(err) }
    return snapshot()
  }
}

export function getMongoStatus(): MongoStatus {
  return snapshot()
}

export function getMongoHealth(): {
  status: MongoConnectionStatus
  ok: boolean
  message?: string
} {
  const current = getMongoStatus()
  if (current.status === 'error' && current.message) {
    return { status: current.status, ok: current.ok, message: current.message }
  }
  return { status: current.status, ok: current.ok }
}

export function getMongoDb(): Db | null {
  if (!client || status.status !== 'connected') return null
  return client.db(dbName)
}

export async function connectMongo(): Promise<MongoStatus> {
  const uri = configuredUri()
  if (!uri) {
    generation += 1
    inflight = null
    inflightUri = null
    const previous = client
    client = null
    activeUri = null
    status = { status: 'not-configured', ok: false }
    await closeClient(previous)
    return snapshot()
  }

  if (client && activeUri === uri && status.status === 'connected') {
    return snapshot()
  }

  if (inflight && inflightUri === uri) {
    return inflight
  }

  const gen = ++generation
  const pending = open(uri, gen)
  inflight = pending
  inflightUri = uri
  try {
    return await pending
  } finally {
    if (inflight === pending) {
      inflight = null
      inflightUri = null
    }
  }
}

export async function closeMongo(): Promise<void> {
  generation += 1
  inflight = null
  inflightUri = null
  const previous = client
  client = null
  activeUri = null
  status = { status: 'not-configured', ok: false }
  await closeClient(previous)
}
