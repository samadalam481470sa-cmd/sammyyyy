import type { Request, Response, NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { db, hashToken } from '../db/index.ts'

export interface AuthContext {
  userId: string
  userName: string
  role: string
  authMethod: 'demo' | 'api_key' | 'password'
  apiKeyId?: string
  sessionId: string
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again later.' },
})

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded.' },
})

function getBearerOrApiKey(req: Request): string | null {
  const auth = req.header('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim()
  const apiKey = req.header('x-api-key')
  if (apiKey) return apiKey.trim()
  return null
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getBearerOrApiKey(req)
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  // Session token path
  if (token.startsWith('nwp_sess_')) {
    const session = db
      .prepare(
        `SELECT s.id AS session_id, s.auth_method, s.api_key_id, s.expires_at,
                u.id AS user_id, u.name AS user_name, u.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?`,
      )
      .get(hashToken(token)) as
      | {
          session_id: string
          auth_method: AuthContext['authMethod']
          api_key_id: string | null
          expires_at: string
          user_id: string
          user_name: string
          role: string
        }
      | undefined

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }
    if (new Date(session.expires_at).getTime() < Date.now()) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(session.session_id)
      return res.status(401).json({ error: 'Session expired' })
    }

    req.auth = {
      userId: session.user_id,
      userName: session.user_name,
      role: session.role,
      authMethod: session.auth_method,
      apiKeyId: session.api_key_id ?? undefined,
      sessionId: session.session_id,
    }
    return next()
  }

  // Direct API key access (for programmatic clients — 5 reserved slots)
  const key = db
    .prepare(
      `SELECT id, slot, status, key_hash FROM api_keys WHERE key_hash = ? AND status = 'active'`,
    )
    .get(hashToken(token)) as
    | { id: string; slot: number; status: string; key_hash: string }
    | undefined

  if (!key) {
    writeAudit(null, 'anonymous', 'auth.failed', 'api_key', null, 'Invalid API key', req)
    return res.status(401).json({ error: 'Invalid API key' })
  }

  db.prepare(`UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?`).run(key.id)

  // API-key-only access maps to a service principal (Dennis one-stop view scope)
  req.auth = {
    userId: 'user-dennis',
    userName: 'API Key Access',
    role: 'partner',
    authMethod: 'api_key',
    apiKeyId: key.id,
    sessionId: `api-${key.id}`,
  }
  return next()
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: 'Authentication required' })
    if (!roles.includes(req.auth.role) && req.auth.role !== 'admin') {
      writeAudit(
        req.auth.userId,
        req.auth.userName,
        'auth.forbidden',
        'route',
        req.path,
        `Role ${req.auth.role} denied`,
        req,
      )
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    return next()
  }
}

export function writeAudit(
  actorId: string | null,
  actorName: string | null,
  action: string,
  resourceType: string,
  resourceId: string | null,
  detail: string,
  req?: Request,
) {
  db.prepare(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, resource_type, resource_id, detail, ip_address)
     VALUES (@id, @actor_id, @actor_name, @action, @resource_type, @resource_id, @detail, @ip_address)`,
  ).run({
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    actor_id: actorId,
    actor_name: actorName,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    detail,
    ip_address: req?.ip ?? null,
  })
}
