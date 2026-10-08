import { Router } from 'express'
import { z } from 'zod'
import { sanitizeCalendarEvents } from '../../src/lib/meetingSecurity.ts'
import { db } from '../db/index.ts'
import { calendarWriteLimit, ownerKeyFromAuth, requireAuth } from '../middleware/security.ts'

export const preferencesRouter = Router()

preferencesRouter.use(requireAuth)

const navOrderSchema = z.object({
  order: z.array(z.string().min(1).max(64)).max(40),
})

/** Load this user's saved sidebar order. */
preferencesRouter.get('/nav-order', (req, res) => {
  const row = db
    .prepare(`SELECT nav_order FROM user_preferences WHERE user_id = ?`)
    .get(req.auth!.userId) as { nav_order: string } | undefined

  let order: string[] = []
  if (row?.nav_order) {
    try {
      const parsed = JSON.parse(row.nav_order) as unknown
      if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
        order = parsed
      }
    } catch {
      order = []
    }
  }

  res.json({ order, userId: req.auth!.userId })
})

/** Persist sidebar order for the signed-in user only. */
preferencesRouter.put('/nav-order', (req, res) => {
  const parsed = navOrderSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid nav order payload' })
  }

  const orderJson = JSON.stringify(parsed.data.order)
  db.prepare(
    `INSERT INTO user_preferences (user_id, nav_order, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       nav_order = excluded.nav_order,
       updated_at = datetime('now')`,
  ).run(req.auth!.userId, orderJson)

  res.json({ ok: true, order: parsed.data.order, userId: req.auth!.userId })
})

const calendarSchema = z.object({
  events: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z
          .string()
          .regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/)
          .optional()
          .default(''),
        title: z.string().max(200),
        notes: z.string().max(4000),
        remind: z.boolean().optional().default(true),
      }),
    )
    .max(400),
})

preferencesRouter.get('/calendar', (req, res) => {
  const ownerKey = ownerKeyFromAuth(req.auth)
  const row = db
    .prepare(`SELECT events_json FROM key_calendars WHERE owner_key = ?`)
    .get(ownerKey) as { events_json: string } | undefined
  let events: unknown[] = []
  if (row?.events_json) {
    try {
      const parsed = JSON.parse(row.events_json) as unknown
      events = sanitizeCalendarEvents(parsed)
    } catch {
      events = []
    }
  }
  res.json({ ownerKey, events })
})

preferencesRouter.put('/calendar', calendarWriteLimit, (req, res) => {
  const parsed = calendarSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid calendar payload' })
  }
  const events = sanitizeCalendarEvents(parsed.data.events)
  const ownerKey = ownerKeyFromAuth(req.auth)
  db.prepare(
    `INSERT INTO key_calendars (owner_key, events_json, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(owner_key) DO UPDATE SET
       events_json = excluded.events_json,
       updated_at = datetime('now')`,
  ).run(ownerKey, JSON.stringify(events))
  res.json({ ok: true, ownerKey, count: events.length })
})
