import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import bcrypt from 'bcryptjs'
import { mockOpportunities } from '@/data/mockOpportunities'
import {
  mockCarriers,
  mockContacts,
  mockDocuments,
  mockPortfolio,
  mockSources,
  mockTasksDb,
} from '@/data/mockModules'
import { mockMeetings } from '@/data/mockMeetings'
import { DEMO_SEED_OPPORTUNITY_IDS } from '@/lib/demoAliases'
import { DEMO_PASSWORD_HASH } from './constants.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const schemaSql = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8')
const seedSql = fs.readFileSync(path.join(here, 'seed.sql'), 'utf8')

describe('permanent GitHub database', () => {
  it('keeps schema.sql and seed.sql as the reconstructable database', () => {
    expect(schemaSql).toMatch(/CREATE TABLE IF NOT EXISTS opportunities/)
    expect(schemaSql).toMatch(/CREATE TABLE IF NOT EXISTS app_meta/)
    expect(seedSql).toMatch(/anon-letter-v1/)
    expect(seedSql).toMatch(/INSERT INTO/)
    for (const id of DEMO_SEED_OPPORTUNITY_IDS) {
      expect(seedSql).toContain(`'${id}'`)
    }
  })

  it('rebuilds SQLite from schema.sql + seed.sql with the mock dataset', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nwp-db-'))
    const dbPath = path.join(dir, 'newport-crm.db')
    const db = new Database(dbPath)
    try {
      db.exec(schemaSql)
      db.exec(seedSql)
      const count = (table: string) =>
        (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c

      expect(count('opportunities')).toBe(mockOpportunities.length)
      expect(count('contacts')).toBe(mockContacts.length)
      expect(count('tasks')).toBe(mockTasksDb.length)
      expect(count('sources')).toBe(mockSources.length)
      expect(count('carriers')).toBe(mockCarriers.length)
      expect(count('portfolio_companies')).toBe(mockPortfolio.length)
      expect(count('documents')).toBe(mockDocuments.length)
      expect(count('meetings')).toBe(mockMeetings.length)
      expect(count('users')).toBe(3)

      const version = db.prepare(`SELECT v FROM app_meta WHERE k = 'demo_dataset'`).get() as
        | { v: string }
        | undefined
      expect(version?.v).toBe('anon-letter-v1')

      const ids = db
        .prepare(`SELECT id FROM opportunities ORDER BY id`)
        .all()
        .map((row) => (row as { id: string }).id)
      expect(ids).toEqual([...DEMO_SEED_OPPORTUNITY_IDS].sort())

      const mary = db
        .prepare(`SELECT password_hash FROM users WHERE email = 'mary@newportspecialty.demo'`)
        .get() as { password_hash: string }
      expect(mary.password_hash).toBe(DEMO_PASSWORD_HASH)
      expect(bcrypt.compareSync('demo-only-not-for-production', mary.password_hash)).toBe(true)
    } finally {
      db.close()
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
