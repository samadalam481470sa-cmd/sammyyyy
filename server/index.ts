import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { apiRateLimit } from './middleware/security.ts'
import { authRouter } from './routes/auth.ts'
import { opportunitiesRouter } from './routes/opportunities.ts'
import { securityRouter } from './routes/security.ts'
import { exportRouter } from './routes/export.ts'
import { resourcesRouter } from './routes/resources.ts'
import { aiRouter } from './routes/ai.ts'
import { preferencesRouter } from './routes/preferences.ts'
import './db/index.ts'

const app = express()
const PORT = Number(process.env.API_PORT || 3001)

app.set('trust proxy', 1)

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
  }),
)
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://samadalam481470sa-cmd.github.io',
])
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (allowedOrigins.has(origin)) return cb(null, true)
      try {
        const url = new URL(origin)
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return cb(null, true)
      } catch {
        return cb(new Error('Not allowed by CORS'))
      }
      return cb(new Error('Not allowed by CORS'))
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With', 'X-Request-Id'],
  }),
)
app.use(express.json({ limit: '256kb' }))
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.removeHeader('X-Powered-By')
  next()
})
app.use(apiRateLimit)

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'newport-acquisition-crm',
    database: 'sqlite',
    apiKeySlots: 5,
  })
})

app.use('/api/auth', authRouter)
app.use('/api/opportunities', opportunitiesRouter)
app.use('/api/security', securityRouter)
app.use('/api/export', exportRouter)
app.use('/api/resources', resourcesRouter)
app.use('/api/ai', aiRouter)
app.use('/api/preferences', preferencesRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  },
)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Newport CRM API listening on http://localhost:${PORT}`)
})
