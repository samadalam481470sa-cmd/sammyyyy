import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { closeMongo, connectMongo, getMongoDb, getMongoHealth, getMongoStatus } from './mongo.ts'

const savedUri = process.env.MONGODB_URI

async function restoreEnv() {
  await closeMongo()
  if (savedUri === undefined) delete process.env.MONGODB_URI
  else process.env.MONGODB_URI = savedUri
}

describe('MongoDB when MONGODB_URI is absent or unreachable', () => {
  afterEach(async () => {
    await restoreEnv()
  })

  it('returns not-configured and does not throw when MONGODB_URI is unset', async () => {
    delete process.env.MONGODB_URI
    const status = await connectMongo()
    expect(status).toEqual({ status: 'not-configured', ok: false })
    expect(getMongoStatus()).toEqual({ status: 'not-configured', ok: false })
    expect(getMongoHealth()).toEqual({ status: 'not-configured', ok: false })
    expect(getMongoDb()).toBeNull()
    await expect(connectMongo()).resolves.toEqual({ status: 'not-configured', ok: false })
  })

  it('returns error without the URI or password when the server cannot be reached', async () => {
    process.env.MONGODB_URI = 'mongodb://user:supersecret@127.0.0.1:1/newport?authSource=admin'
    const status = await connectMongo()
    expect(status.status).toBe('error')
    expect(status.ok).toBe(false)
    expect(status.message && status.message.length > 0).toBe(true)
    const serialized = JSON.stringify(getMongoHealth())
    expect(serialized).not.toContain('supersecret')
    expect(serialized).not.toMatch(/mongodb(?:\+srv)?:\/\//i)
    expect(serialized).not.toContain('authSource')
    expect(getMongoDb()).toBeNull()
  }, 20_000)
})

describe('MongoDB memory server', () => {
  let memory: MongoMemoryServer | undefined

  beforeAll(async () => {
    memory = await MongoMemoryServer.create()
  }, 180_000)

  afterEach(async () => {
    await restoreEnv()
  })

  afterAll(async () => {
    await closeMongo()
    if (memory) await memory.stop()
  })

  it('pings, writes, and reuses one client', async () => {
    if (!memory) throw new Error('in-memory MongoDB did not start')
    process.env.MONGODB_URI = memory.getUri()
    const connected = await connectMongo()
    expect(connected).toEqual({ status: 'connected', ok: true })
    expect(getMongoHealth()).toEqual({ status: 'connected', ok: true })

    const db = getMongoDb()
    expect(db).not.toBeNull()
    expect(db!.databaseName).toBe('newport')

    const adminPing = await db!.client.db('admin').command({ ping: 1 })
    expect(adminPing.ok).toBe(1)

    const meta = db!.collection<{ _id: string; ok: boolean }>('app_meta')
    await meta.deleteOne({ _id: 'ping' })
    await meta.insertOne({ _id: 'ping', ok: true })
    const found = await meta.findOne({ _id: 'ping' })
    expect(found?.ok).toBe(true)
    await meta.deleteOne({ _id: 'ping' })
    expect(await meta.findOne({ _id: 'ping' })).toBeNull()

    const again = await connectMongo()
    expect(again.status).toBe('connected')
    expect(getMongoDb()?.client).toBe(db!.client)

    await closeMongo()
    process.env.MONGODB_URI = memory.getUri('crm_side')
    const renamed = await connectMongo()
    expect(renamed.status).toBe('connected')
    expect(getMongoDb()?.databaseName).toBe('crm_side')
    expect(getMongoDb()?.client).not.toBe(db!.client)
    const sidePing = await getMongoDb()!.client.db('admin').command({ ping: 1 })
    expect(sidePing.ok).toBe(1)
  }, 60_000)
})
