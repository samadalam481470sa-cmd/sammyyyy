import { Router } from 'express'
import { db } from '../db/index.ts'
import { requireAuth, requireRole } from '../middleware/security.ts'

export const securityRouter = Router()

securityRouter.use(requireAuth)

/** Returns the five API key slots — never returns key hashes or secrets. */
securityRouter.get('/api-keys', requireRole('admin', 'partner'), (_req, res) => {
  const keys = db
    .prepare(
      `SELECT id, slot, label, key_prefix, status, last_used_at, expires_at, created_at
       FROM api_keys ORDER BY slot ASC`,
    )
    .all()
  res.json({
    slots: keys,
    capacity: 5,
    note: 'API keys are provisioned by the security team. This CRM stores only hashed values.',
  })
})

securityRouter.get('/audit-logs', requireRole('admin', 'partner'), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const logs = db
    .prepare(
      `SELECT id, actor_name, action, resource_type, resource_id, detail, created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit)
  res.json(logs)
})

securityRouter.get('/me', (req, res) => {
  res.json({
    userId: req.auth!.userId,
    userName: req.auth!.userName,
    role: req.auth!.role,
    authMethod: req.auth!.authMethod,
    apiKeyId: req.auth!.apiKeyId ?? null,
  })
})
