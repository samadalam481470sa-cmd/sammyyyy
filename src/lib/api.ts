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

export async function apiKeySignIn(apiKey: string) {
  const data = await apiFetch<{ token: string; user: AuthUser }>('/auth/api-key', {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  })
  storeSession(data.token, data.user)
  return data
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
