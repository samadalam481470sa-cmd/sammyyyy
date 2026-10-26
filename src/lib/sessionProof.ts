import type { AuthUser } from '@/types'
import { MANAGER_KEY_HASH, SLOT1_KEY_HASH, DEMO_FINGERPRINT } from '@/lib/credentialHashes'
import { randomHex, sha256Hex, timingSafeEqual } from '@/lib/sha256'
import { isLocalSlotRevoked, loadLocalIssuedKeys } from '@/lib/demoStore'
import { emailOwnerKey, normalizeEmail } from '@/lib/emailIdentity'
import { readDeviceSecret } from '@/lib/deviceSecret'

const PEPPER = 'nwp-session-proof-v3'
const PROOF_KEY = 'newport_crm_session_proof'
const TOKEN_KEY = 'newport_crm_session_token'
const USER_KEY = 'newport_crm_session_user'

const LOCAL_TOKEN = 'local-demo'
const MSAL_TOKEN = 'msal'
const SESSION_MS = 30 * 24 * 60 * 60 * 1000
const PROOF_VERSION = 3 as const

function storageGet(key: string): string | null {
  try {
    // Sign-in lives only in this tab. Old copies in localStorage are dropped.
    localStorage.removeItem(key)
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // private mode
  }
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // private mode
  }
}

function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function readSessionItem(key: string): string | null {
  return storageGet(key)
}

export function writeSessionItem(key: string, value: string): void {
  storageSet(key, value)
}

export function removeSessionItem(key: string): void {
  storageRemove(key)
}

export async function newSessionToken(): Promise<string> {
  return randomHex(32)
}

export interface SessionProof {
  v: 3
  token: string
  issuedAt: number
  expiresAt: number
  fingerprint: string
  ownerKey: string
  email: string
  isManager: boolean
  apiKeySlot: number | null
  authMethod: AuthUser['authMethod']
  sig: string
}

function claims(p: Omit<SessionProof, 'sig'>): string {
  return [
    p.v,
    p.token,
    p.issuedAt,
    p.expiresAt,
    p.fingerprint,
    p.ownerKey,
    p.email,
    p.isManager ? '1' : '0',
    p.apiKeySlot ?? '',
    p.authMethod ?? '',
  ].join('|')
}

async function sign(body: Omit<SessionProof, 'sig'>): Promise<string> {
  return sha256Hex(`${PEPPER}|${readDeviceSecret()}|${claims(body)}`)
}

export function ownerKeyFromProofFields(input: {
  isManager: boolean
  apiKeySlot: number | null
  authMethod?: AuthUser['authMethod']
  userId?: string | null
  email?: string | null
}): string {
  if (input.authMethod === 'microsoft') {
    if (input.email?.trim()) return emailOwnerKey(input.email)
    return input.userId ? `ms:${input.userId}` : 'anonymous'
  }
  if (input.isManager || input.authMethod === 'manager_key') return 'key:manager'
  if (input.apiKeySlot != null) return `key:slot-${input.apiKeySlot}`
  if (input.authMethod === 'demo') return 'key:demo'
  return 'anonymous'
}

export async function fingerprintForApiKey(apiKey: string): Promise<string> {
  return sha256Hex(apiKey.trim())
}

export async function createSessionProof(input: {
  token: string
  user: AuthUser
  fingerprint: string
}): Promise<SessionProof> {
  const isManager = Boolean(input.user.isManager || input.user.authMethod === 'manager_key')
  const apiKeySlot = isManager ? null : (input.user.apiKeySlot ?? null)
  const email = normalizeEmail(input.user.email || '')
  const body: Omit<SessionProof, 'sig'> = {
    v: PROOF_VERSION,
    token: input.token,
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_MS,
    fingerprint: input.fingerprint,
    ownerKey: ownerKeyFromProofFields({
      isManager,
      apiKeySlot,
      authMethod: input.user.authMethod,
      userId: input.user.id,
      email: input.user.email,
    }),
    email,
    isManager,
    apiKeySlot,
    authMethod: input.user.authMethod,
  }
  return { ...body, sig: await sign(body) }
}

export function readProofBlob(): SessionProof | null {
  try {
    const raw = storageGet(PROOF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionProof
    if (parsed?.v !== PROOF_VERSION || typeof parsed.sig !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

function privilegeMatches(user: AuthUser, proof: SessionProof): boolean {
  const isManager = Boolean(user.isManager || user.authMethod === 'manager_key')
  if (isManager !== proof.isManager) return false
  const slot = isManager ? null : (user.apiKeySlot ?? null)
  if (slot !== proof.apiKeySlot) return false
  if ((user.authMethod ?? '') !== (proof.authMethod ?? '')) return false
  if (normalizeEmail(user.email || '') !== proof.email) return false
  const expectedOwner = ownerKeyFromProofFields({
    isManager,
    apiKeySlot: slot,
    authMethod: user.authMethod,
    userId: user.id,
    email: user.email,
  })
  return expectedOwner === proof.ownerKey
}

export async function verifySessionProof(
  token: string,
  user: AuthUser,
  proof: SessionProof | null,
): Promise<boolean> {
  if (!proof) return false
  if (proof.v !== PROOF_VERSION) return false
  if (proof.token !== token) return false
  if (proof.expiresAt < Date.now()) return false
  if (!privilegeMatches(user, proof)) return false
  const expected = await sign({
    v: PROOF_VERSION,
    token: proof.token,
    issuedAt: proof.issuedAt,
    expiresAt: proof.expiresAt,
    fingerprint: proof.fingerprint,
    ownerKey: proof.ownerKey,
    email: proof.email,
    isManager: proof.isManager,
    apiKeySlot: proof.apiKeySlot,
    authMethod: proof.authMethod,
  })
  if (!timingSafeEqual(expected, proof.sig)) return false
  if (proof.isManager && proof.fingerprint !== MANAGER_KEY_HASH) return false
  if (proof.authMethod === 'demo' && proof.fingerprint !== DEMO_FINGERPRINT) return false
  if (proof.apiKeySlot != null && isLocalSlotRevoked(proof.apiKeySlot)) return false
  if (proof.apiKeySlot === 1) {
    const issued = loadLocalIssuedKeys().find((k) => k.slot === 1)
    const expectedHash = issued?.keyHash || SLOT1_KEY_HASH
    if (proof.fingerprint !== expectedHash && proof.fingerprint !== SLOT1_KEY_HASH) return false
  } else if (proof.apiKeySlot != null) {
    const issued = loadLocalIssuedKeys().find((k) => k.slot === proof.apiKeySlot)
    if (!issued?.keyHash || issued.keyHash !== proof.fingerprint) return false
  }
  return true
}

export function persistProof(proof: SessionProof): void {
  storageSet(PROOF_KEY, JSON.stringify(proof))
}

export function clearProof(): void {
  storageRemove(PROOF_KEY)
}

export function hasProofEnvelope(): boolean {
  return Boolean(storageGet(PROOF_KEY))
}

export { TOKEN_KEY, USER_KEY, LOCAL_TOKEN, MSAL_TOKEN, PROOF_KEY }
export { DEVICE_SECRET_KEY } from '@/lib/deviceSecret'
