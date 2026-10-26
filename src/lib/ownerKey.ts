import { emailOwnerKey } from '@/lib/emailIdentity'

export interface OwnerAuth {
  userId?: string
  id?: string
  email?: string | null
  authMethod?: string | null
  apiKeySlot?: number | null
  apiKeyId?: string | null
  isManager?: boolean
}

/** Stable owner for a session — the same email always reopens the same saved CRM vault. */
export function ownerKeyFromAuth(auth: OwnerAuth | null | undefined): string {
  if (!auth) return 'anonymous'
  if (auth.authMethod === 'microsoft') {
    if (auth.email?.trim()) return emailOwnerKey(auth.email)
    const id = auth.userId ?? auth.id
    return id ? `ms:${id}` : 'anonymous'
  }
  if (auth.isManager || auth.authMethod === 'manager_key') return 'key:manager'
  if (auth.apiKeySlot != null) return `key:slot-${auth.apiKeySlot}`
  if (auth.apiKeyId) return `key:${auth.apiKeyId}`
  if (auth.authMethod === 'demo') return 'key:demo'
  return auth.userId ? `user:${auth.userId}` : 'anonymous'
}

/** Owner key from the signed-in CRM user (slot / manager / demo). */
export function sessionOwnerKey(user: OwnerAuth | null | undefined): string {
  if (!user) return 'anonymous'
  return ownerKeyFromAuth({
    userId: user.userId ?? user.id,
    email: user.email,
    authMethod: user.authMethod,
    apiKeySlot: user.apiKeySlot,
    apiKeyId: user.apiKeyId,
    isManager: user.isManager,
  })
}
