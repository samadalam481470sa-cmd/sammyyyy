import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db/index.ts'
import { requireAuth } from '../middleware/security.ts'

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
