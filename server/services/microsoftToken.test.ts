import { describe, expect, it } from 'vitest'
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose'
import { MICROSOFT_CLIENT_ID, accessPolicy, isAllowed, verifyMicrosoftIdToken } from './microsoftToken'

const TENANT = '11111111-2222-3333-4444-555555555555'

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }
  const keys = createLocalJWKSet({ keys: [jwk] })
  const sign = (claims: Record<string, unknown>, opts: { aud?: string; iss?: string; exp?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setAudience(opts.aud ?? MICROSOFT_CLIENT_ID)
      .setIssuer(opts.iss ?? `https://login.microsoftonline.com/${TENANT}/v2.0`)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? '1h')
      .sign(privateKey)
  return { keys, sign }
}

describe('Microsoft ID token verification', () => {
  it('accepts a valid token and returns the identity', async () => {
    const { keys, sign } = await setup()
    const token = await sign({ tid: TENANT, oid: 'o1', preferred_username: 'Sam@Newport.com', name: 'Sam Alam' })
    await expect(verifyMicrosoftIdToken(token, keys)).resolves.toMatchObject({ email: 'sam@newport.com', tenantId: TENANT, name: 'Sam Alam' })
  })

  it('rejects wrong audience, expired, mismatched issuer, and forged signatures', async () => {
    const { keys, sign } = await setup()
    await expect(verifyMicrosoftIdToken(await sign({ tid: TENANT, preferred_username: 'a@b.com' }, { aud: 'other-app' }), keys)).rejects.toThrow()
    await expect(verifyMicrosoftIdToken(await sign({ tid: TENANT, preferred_username: 'a@b.com' }, { exp: '-10m' }), keys)).rejects.toThrow()
    await expect(
      verifyMicrosoftIdToken(await sign({ tid: '99999999-2222-3333-4444-555555555555', preferred_username: 'a@b.com' }), keys),
    ).rejects.toThrow(/issuer/)
    const other = await setup()
    await expect(verifyMicrosoftIdToken(await other.sign({ tid: TENANT, preferred_username: 'a@b.com' }), keys)).rejects.toThrow()
  })
})

describe('approved-user policy', () => {
  const id = { email: 'sam@newport.com', name: 'Sam', tenantId: TENANT, objectId: 'o' }
  it('refuses everyone when no allowlist is configured', () => {
    expect(isAllowed(id, accessPolicy({}))).toBe(false)
  })
  it('allows by email, domain, tenant, or admin list', () => {
    expect(isAllowed(id, accessPolicy({ ALLOWED_EMAILS: 'sam@newport.com' }))).toBe(true)
    expect(isAllowed(id, accessPolicy({ ALLOWED_EMAIL_DOMAINS: '@Newport.com' }))).toBe(true)
    expect(isAllowed(id, accessPolicy({ ALLOWED_TENANT_IDS: TENANT }))).toBe(true)
    expect(isAllowed(id, accessPolicy({ ADMIN_EMAILS: 'sam@newport.com' }))).toBe(true)
    expect(isAllowed(id, accessPolicy({ ALLOWED_EMAIL_DOMAINS: 'other.com' }))).toBe(false)
  })
})
