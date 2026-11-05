import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { apiRateLimit, ipFloodLimit } from './middleware/security.ts'
import { STRIKES, addStrikes, blockGuard, jsonSafetyGuard, logDefenseEvent, normalizeClientIp, probeGuard } from './middleware/defense.ts'
import { authRouter } from './routes/auth.ts'
import { opportunitiesRouter } from './routes/opportunities.ts'
import { securityRouter } from './routes/security.ts'
import { exportRouter } from './routes/export.ts'
import { resourcesRouter } from './routes/resources.ts'
import { aiRouter } from './routes/ai.ts'
import { preferencesRouter } from './routes/preferences.ts'
import { microsoftAuthRouter, workspaceRouter } from './routes/workspace.ts'
import './db/index.ts'

const ORIGIN_DENIED = 'Not allowed by CORS'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(normalizeClientIp)

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  )
  const allowedOrigins = new Set([
    ...(process.env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean),
    'https://samadalam481470sa-cmd.github.io',
  ])
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.has(origin)) return cb(null, true)
        try {
          const url = new URL(origin)
          if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return cb(null, true)
        } catch {
          return cb(new Error(ORIGIN_DENIED))
        }
        return cb(new Error(ORIGIN_DENIED))
      },
      // Sign-in uses bearer tokens, never cookies, so no credentials are needed and cross-site request forgery has nothing to ride on.
      credentials: false,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With', 'X-Request-Id', 'X-File-Name'],
    }),
  )
  // Blocked addresses and probes are refused before any body is read.
  app.use(blockGuard)
  app.use(probeGuard)
  app.use(ipFloodLimit)
  app.use(express.json({ limit: '4mb' }))
  app.use(jsonSafetyGuard)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    next()
  })
  app.use(apiRateLimit)

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'newport-acquisition-crm' })
  })

  app.use('/api/auth', microsoftAuthRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/workspace', workspaceRouter)
  app.use('/api/opportunities', opportunitiesRouter)
  app.use('/api/security', securityRouter)
  app.use('/api/export', exportRouter)
  app.use('/api/resources', resourcesRouter)
  app.use('/api/ai', aiRouter)
  app.use('/api/preferences', preferencesRouter)

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  // Callers get a plain message. Details stay in the server log.
  app.use((err: Error & { type?: string; status?: number }, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.message === ORIGIN_DENIED) {
      logDefenseEvent('denied_origin', req, req.get('origin') ?? '')
      addStrikes(req, STRIKES.deniedOrigin, 'denied_origin')
      return res.status(403).json({ error: 'This site may not call the Newport API.' })
    }
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large.' })
    if (err.type === 'entity.parse.failed') {
      addStrikes(req, STRIKES.badJson, 'bad_json')
      return res.status(400).json({ error: 'The request body is not valid JSON.' })
    }
    if (err.status && err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: 'Bad request' })
    console.error(err)
    return res.status(500).json({ error: 'Internal server error' })
  })

  return app
}
