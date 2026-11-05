import 'dotenv/config'
import dns from 'node:dns'
// Azure App Service on Linux has no IPv6 egress; prefer IPv4 so outbound calls (Gemini) do not stall.
dns.setDefaultResultOrder('ipv4first')
import { createApp } from './app.ts'
import { connectMongo, getMongoHealth } from './db/mongo.ts'

const app = createApp()
const PORT = Number(process.env.PORT || process.env.API_PORT || 3001)
const mongoStartup = connectMongo().catch(() => getMongoHealth())

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Newport CRM API listening on http://localhost:${PORT}`)
  void mongoStartup.then((mongo) => {
    console.log(`MongoDB status: ${mongo.status}`)
  })
})

// Slow-connection attacks: a client that dribbles its request out is cut off. Uploads may take up to five minutes.
server.headersTimeout = 20_000
server.requestTimeout = 300_000
// Longer than Azure's load balancer keeps idle connections, so it never reuses a closed one.
server.keepAliveTimeout = 240_000
server.maxConnections = 2000
