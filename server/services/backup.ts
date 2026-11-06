/**
 * Daily copy of the whole database, kept beside it on the server and independent of any browser.
 * SQLite's online backup is safe while people are saving. Copies hold private meetings, so they are
 * never offered for download: recovery is an operator step, described in docs/SHARED_BACKEND.md.
 */
import fs from 'node:fs'
import path from 'node:path'
import { db } from '../db/index.ts'

const KEEP_DAYS = 14
const DAY_MS = 24 * 3600_000

export function backupDirectory(): string {
  return process.env.CRM_BACKUP_DIR || path.join(path.dirname(db.name), 'backups')
}

export interface BackupFile {
  name: string
  size: number
  createdAt: string
}

export function listBackups(): BackupFile[] {
  const dir = backupDirectory()
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => /^newport-crm-\d{4}-\d{2}-\d{2}\.db$/.test(name))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name))
      return { name, size: stat.size, createdAt: stat.mtime.toISOString() }
    })
    .sort((a, b) => b.name.localeCompare(a.name))
}

export async function runBackup(now = new Date()): Promise<BackupFile> {
  const dir = backupDirectory()
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const name = `newport-crm-${now.toISOString().slice(0, 10)}.db`
  const target = path.join(dir, name)
  const temp = `${target}.partial`
  await db.backup(temp)
  fs.renameSync(temp, target)
  for (const old of listBackups().slice(KEEP_DAYS)) fs.rmSync(path.join(dir, old.name), { force: true })
  const stat = fs.statSync(target)
  return { name, size: stat.size, createdAt: stat.mtime.toISOString() }
}

/** One copy a day. Restarts do not add copies: a copy already made today is left alone. */
export function startBackupSchedule(): void {
  const tick = () => {
    const today = `newport-crm-${new Date().toISOString().slice(0, 10)}.db`
    if (listBackups().some((row) => row.name === today)) return
    runBackup().catch((err) => console.error('Database backup failed:', err instanceof Error ? err.message : 'unknown error'))
  }
  setTimeout(tick, 60_000).unref()
  setInterval(tick, DAY_MS / 4).unref()
}
