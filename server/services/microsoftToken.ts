import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose'

/** Same public SPA client id the browser uses. The server checks tokens were issued for it. */
export const MICROSOFT_CLIENT_ID = (process.env.MSAL_CLIENT_ID || '2e296364-cbf0-4742-ba8f-3e0615a4e777').trim()

const JWKS = createRemoteJWKSet(new URL('https://login.microsoftonline.com/common/discovery/v2.0/keys'), {
  cooldownDuration: 60_000,
  cacheMaxAge: 6 * 60 * 60 * 1000,
})

export interface MicrosoftIdentity {
  email: string
  name: string
  tenantId: string
  objectId: string
}

const ISSUER = /^https:\/\/login\.microsoftonline\.com\/([0-9a-f-]{36})\/v2\.0$/

/**
 * Verify a Microsoft ID token: signature (Microsoft's published keys), audience (this app),
 * issuer matching the token's tenant, and expiry. Returns the verified identity.
 */
export async function verifyMicrosoftIdToken(idToken: string, keys: JWTVerifyGetKey = JWKS): Promise<MicrosoftIdentity> {
  const { payload } = await jwtVerify(idToken, keys, {
    audience: MICROSOFT_CLIENT_ID,
    algorithms: ['RS256'],
    clockTolerance: 120,
  })
  const claims = payload as JWTPayload & { tid?: string; oid?: string; preferred_username?: string; email?: string; name?: string }
  const match = ISSUER.exec(String(claims.iss ?? ''))
  if (!match || !claims.tid || match[1] !== claims.tid) throw new Error('Token issuer does not match its tenant.')
  const email = String(claims.email || claims.preferred_username || '').trim().toLowerCase()
  if (!email.includes('@')) throw new Error('Microsoft did not return an email address.')
  return { email, name: String(claims.name || email), tenantId: claims.tid, objectId: String(claims.oid || claims.sub || '') }
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((row) => row.trim().toLowerCase())
    .filter(Boolean)
}

export interface AccessPolicy {
  emails: string[]
  domains: string[]
  tenants: string[]
  admins: string[]
}

export function accessPolicy(env: NodeJS.ProcessEnv = process.env): AccessPolicy {
  return {
    emails: list(env.ALLOWED_EMAILS),
    domains: list(env.ALLOWED_EMAIL_DOMAINS).map((d) => d.replace(/^@/, '')),
    tenants: list(env.ALLOWED_TENANT_IDS),
    admins: list(env.ADMIN_EMAILS),
  }
}

/**
 * Only approved people may sign in to shared company data. With no allowlist configured the
 * server refuses everyone (secure by default) rather than admitting any Microsoft account.
 */
export function isAllowed(identity: MicrosoftIdentity, policy: AccessPolicy): boolean {
  if (!policy.emails.length && !policy.domains.length && !policy.tenants.length && !policy.admins.length) return false
  const domain = identity.email.split('@')[1] ?? ''
  return (
    policy.emails.includes(identity.email) ||
    policy.admins.includes(identity.email) ||
    policy.domains.includes(domain) ||
    policy.tenants.includes(identity.tenantId.toLowerCase())
  )
}
