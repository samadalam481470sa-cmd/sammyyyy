export interface OwnerAuth {
  userId?: string
  authMethod?: string | null
  apiKeySlot?: number | null
  apiKeyId?: string | null
  isManager?: boolean
}

/** Stable owner for a session key — slot 1, slot 2, manager never share meetings or calendars. */
export function ownerKeyFromAuth(auth: OwnerAuth | null | undefined): string {
  if (!auth) return 'anonymous'
  if (auth.isManager || auth.authMethod === 'manager_key') return 'key:manager'
  if (auth.apiKeySlot != null) return `key:slot-${auth.apiKeySlot}`
  if (auth.apiKeyId) return `key:${auth.apiKeyId}`
  if (auth.authMethod === 'demo') return 'key:demo'
  return auth.userId ? `user:${auth.userId}` : 'anonymous'
}
