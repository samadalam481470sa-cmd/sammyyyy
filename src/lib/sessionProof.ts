import type { AuthUser } from '@/types'
import { MANAGER_KEY_HASH, SLOT1_KEY_HASH, DEMO_FINGERPRINT } from '@/lib/credentialHashes'
import { sha256Hex } from '@/lib/sha256'
import { isLocalSlotRevoked, loadLocalIssuedKeys } from '@/lib/demoStore'

const PEPPER = 'nwp-session-proof-v2'
const PROOF_KEY = 'newport_crm_session_proof'
const TOKEN_KEY = 'newport_crm_session_token'
const USER_KEY = 'newport_crm_session_user'

const LOCAL_TOKEN = 'local-demo'
const SESSION_MS = 8 * 60 * 60 * 1000

export interface SessionProof {
  v: 2
  token: string
  issuedAt: number
  expiresAt: number
  fingerprint: string
  ownerKey: string
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
    p.isManager ? '1' : '0',
    p.apiKeySlot ?? '',
    p.authMethod ?? '',
  ].join('|')
}

async function sign(body: Omit<SessionProof, 'sig'>): Promise<string> {
  return sha256Hex(`${PEPPER}|${claims(body)}`)
}

export function ownerKeyFromProofFields(input: {
  isManager: boolean
  apiKeySlot: number | null
  authMethod?: AuthUser['authMethod']
}): string {
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
  const body: Omit<SessionProof, 'sig'> = {
    v: 2,
    token: input.token,
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_MS,
    fingerprint: input.fingerprint,
    ownerKey: ownerKeyFromProofFields({
      isManager,
      apiKeySlot,
      authMethod: input.user.authMethod,
    }),
    isManager,
    apiKeySlot,
    authMethod: input.user.authMethod,
  }
  return { ...body, sig: await sign(body) }
}

export function readProofBlob(): SessionProof | null {
  try {
    const raw = sessionStorage.getItem(PROOF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionProof
    if (parsed?.v !== 2 || typeof parsed.sig !== 'string') return null
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
  return true
}

export async function verifySessionProof(
  token: string,
  user: AuthUser,
  proof: SessionProof | null,
): Promise<boolean> {
  if (!proof) return false
  if (proof.token !== token) return false
  if (proof.expiresAt < Date.now()) return false
  if (!privilegeMatches(user, proof)) return false
  const expected = await sign({
    v: 2,
    token: proof.token,
    issuedAt: proof.issuedAt,
    expiresAt: proof.expiresAt,
    fingerprint: proof.fingerprint,
    ownerKey: proof.ownerKey,
    isManager: proof.isManager,
    apiKeySlot: proof.apiKeySlot,
    authMethod: proof.authMethod,
  })
  if (expected !== proof.sig) return false
  if (proof.isManager && proof.fingerprint !== MANAGER_KEY_HASH) return false
  if (proof.authMethod === 'demo' && proof.fingerprint !== DEMO_FINGERPRINT) return false
  if (proof.apiKeySlot != null && isLocalSlotRevoked(proof.apiKeySlot)) return false
  if (proof.apiKeySlot === 1) {
    const issued = loadLocalIssuedKeys().find((k) => k.slot === 1)
    const expected = issued?.keyHash || SLOT1_KEY_HASH
    if (proof.fingerprint !== expected && proof.fingerprint !== SLOT1_KEY_HASH) return false
  } else if (proof.apiKeySlot != null) {
    const issued = loadLocalIssuedKeys().find((k) => k.slot === proof.apiKeySlot)
    if (!issued?.keyHash || issued.keyHash !== proof.fingerprint) return false
  }
  return true
}

export function persistProof(proof: SessionProof): void {
  sessionStorage.setItem(PROOF_KEY, JSON.stringify(proof))
}

export function clearProof(): void {
  sessionStorage.removeItem(PROOF_KEY)
}

export function hasProofEnvelope(): boolean {
  return Boolean(sessionStorage.getItem(PROOF_KEY))
}

export { TOKEN_KEY, USER_KEY, LOCAL_TOKEN, PROOF_KEY }
