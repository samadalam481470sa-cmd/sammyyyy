import type { AuthUser, Opportunity, OpportunityUpdate } from '@/types'

const TOKEN_KEY = 'newport_crm_session_token'
const USER_KEY = 'newport_crm_session_user'

const API_BASE = '/api'

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem(TOKEN_KEY)
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('X-Requested-With', 'XMLHttpRequest')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export function getStoredSession(): { token: string; user: AuthUser } | null {
  const token = sessionStorage.getItem(TOKEN_KEY)
  const raw = sessionStorage.getItem(USER_KEY)
  if (!token || !raw) return null
  try {
    return { token, user: JSON.parse(raw) as AuthUser }
  } catch {
    return null
  }
}

export function storeSession(token: string, user: AuthUser) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}

export async function demoSignIn() {
  const data = await apiFetch<{ token: string; user: AuthUser; notice: string }>('/auth/demo', {
    method: 'POST',
    body: '{}',
  })
  storeSession(data.token, data.user)
  return data
}

/** Managerial master key issued to Samad (demo / local). */
export const MANAGER_MASTER_KEY = 'nwp_mgr_samad_newport_master_only'
export const DEMO_SLOT1_KEY = 'nwp_demo_key_slot1_replace_me_by_security_team'

export async function apiKeySignIn(apiKey: string) {
  try {
    const data = await apiFetch<{ token: string; user: AuthUser }>('/auth/api-key', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    })
    storeSession(data.token, data.user)
    return data
  } catch (err) {
    // Static demo fallbacks
    if (apiKey === MANAGER_MASTER_KEY) {
      const user: AuthUser = {
        id: 'user-manager',
        email: 'samad@newportspecialty.demo',
        name: 'Samad Alam',
        role: 'admin',
        initials: 'SA',
        authMethod: 'manager_key',
        isManager: true,
        apiKeyId: 'mgr-master-1',
        apiKeySlot: null,
        apiKeyLabel: 'Managerial master key',
      }
      storeSession('local-demo', user)
      return { token: 'local-demo', user }
    }
    if (apiKey === DEMO_SLOT1_KEY) {
      const user: AuthUser = {
        id: 'user-dennis',
        email: 'dennis@newportspecialty.demo',
        name: 'Dennis DiCapua',
        role: 'partner',
        initials: 'DD',
        authMethod: 'api_key',
        isManager: false,
        apiKeyId: 'key-slot-1',
        apiKeySlot: 1,
        apiKeyLabel: 'Primary integration (demo)',
      }
      storeSession('local-demo', user)
      return { token: 'local-demo', user }
    }
    throw err
  }
}

export async function signOut() {
  try {
    await apiFetch('/auth/signout', { method: 'POST', body: '{}' })
  } catch {
    // ignore network errors on sign-out
  }
  clearSession()
}

export async function fetchOpportunities() {
  return apiFetch<Opportunity[]>('/opportunities')
}

export async function updateOpportunity(id: string, patch: OpportunityUpdate) {
  return apiFetch<Opportunity>(`/opportunities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function createOpportunity(payload: Partial<Opportunity>) {
  return apiFetch<Opportunity>('/opportunities', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function askNewportAi(question: string) {
  return apiFetch<{
    answer: string
    sources: Array<{ type: string; id: string; label: string }>
    mode: 'retrieval' | 'llm'
  }>('/ai/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
  })
}

export async function fetchApiKeySlots() {
  return apiFetch<{
    slots: Array<{
      id: string
      slot: number
      label: string
      key_prefix: string
      status: string
      last_used_at: string | null
    }>
    capacity: number
    note: string
  }>('/security/api-keys')
}

/**
 * Download helpers — database is accessible anywhere (via link) and
 * downloadable everywhere (CSV for Excel, JSON for integrations, full .db file).
 */
async function downloadFile(path: string) {
  const token = sessionStorage.getItem(TOKEN_KEY)
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `Download failed (${res.status})`)
  }
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = /filename="?([^";]+)"?/.exec(disposition)
  const filename = match?.[1] ?? 'newport-export'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadOpportunitiesCsv() {
  return downloadFile('/export/opportunities.csv')
}

export function downloadOpportunitiesJson() {
  return downloadFile('/export/opportunities.json')
}

export function downloadDatabaseFile() {
  return downloadFile('/export/database')
}

export async function fetchAuditLogs(limit = 40) {
  return apiFetch<
    Array<{
      id: string
      actor_name: string | null
      action: string
      resource_type: string
      resource_id: string | null
      detail: string
      created_at: string
    }>
  >(`/security/audit-logs?limit=${limit}`)
}

export interface ChangeHistoryEntry {
  id: string
  actorName: string | null
  apiKeySlot: number | null
  authMethod: string
  resourceType: string
  resourceId: string
  changeType: 'create' | 'update' | 'delete' | string
  changedFields: string[]
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  createdAt: string
}

export async function fetchChangeHistory(opts: {
  limit?: number
  slot?: number | null
  resourceType?: string | null
} = {}) {
  const params = new URLSearchParams()
  params.set('limit', String(opts.limit ?? 100))
  if (opts.slot) params.set('slot', String(opts.slot))
  if (opts.resourceType) params.set('resourceType', opts.resourceType)
  return apiFetch<{ count: number; changes: ChangeHistoryEntry[] }>(
    `/security/change-history?${params.toString()}`,
  )
}

export interface NotificationItem {
  id: string
  direction: 'inbound' | 'outbound' | string
  from: string
  to: string
  subject: string
  body: string
  read: boolean
  relatedProject: string
  createdAt: string
  mailto?: string
}

export async function fetchNotifications(limit = 40) {
  return apiFetch<{ notifications: NotificationItem[] }>(
    `/security/notifications?limit=${limit}`,
  )
}

export async function sendNotification(payload: {
  to: string
  subject: string
  body: string
  relatedProject?: string
}) {
  return apiFetch<NotificationItem>('/security/notifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function markNotificationRead(id: string) {
  return apiFetch<{ ok: boolean }>(`/security/notifications/${id}/read`, {
    method: 'POST',
    body: '{}',
  })
}

export async function fetchSessions() {
  return apiFetch<{
    sessions: Array<{
      id: string
      auth_method: string
      api_key_id: string | null
      api_key_slot: number | null
      api_key_label: string | null
      user_name: string
      user_email: string
      ip_address: string | null
      expires_at: string
      created_at: string
    }>
  }>('/security/sessions')
}

export async function kickSession(id: string) {
  return apiFetch<{ ok: boolean }>(`/security/sessions/${id}`, { method: 'DELETE' })
}

export async function revokeApiKeySlot(slot: number) {
  return apiFetch<{ ok: boolean; slot: number; status: string }>(
    `/security/api-keys/${slot}/revoke`,
    { method: 'POST', body: '{}' },
  )
}

export async function provisionApiKeySlot(slot: number, label?: string) {
  return apiFetch<{
    slot: number
    label: string
    keyPrefix: string
    status: string
    plaintext: string
    notice: string
  }>(`/security/api-keys/${slot}/provision`, {
    method: 'POST',
    body: JSON.stringify({ label }),
  })
}
