/**
 * Shared company workspace client. When public/api.json names a server, every approved user
 * reads and writes the same records through it; otherwise the CRM keeps working on this
 * device only. The server verifies each person's Microsoft sign-in and approval.
 */
import { getMicrosoftIdToken } from '@/auth/msal'

export const WORKSPACE_SESSION_KEY = 'newport_crm_workspace_session'
export const WORKSPACE_STATE_EVENT = 'newport-workspace-state'

export type WorkspaceCollection = 'opportunities' | 'tasks' | 'documents' | 'contacts' | 'activity' | 'documentTypes'

export interface WorkspaceRecord {
  collection: WorkspaceCollection
  id: string
  deleted: boolean
  updatedAt: string
  updatedBy: string
  data: Record<string, unknown> | null
}

export interface WorkspacePull {
  serverTime: string
  empty: boolean
  records: WorkspaceRecord[]
}

export type WorkspaceState = 'off' | 'connecting' | 'connected' | 'error'

let configPromise: Promise<string> | null = null
let state: WorkspaceState = 'off'
let lastError: string | null = null

/** Server address from public/api.json (empty when no shared server is set up). */
export function workspaceApiBase(): Promise<string> {
  if (!configPromise) {
    configPromise = (async () => {
      if (typeof fetch === 'undefined' || typeof document === 'undefined') return ''
      try {
        const res = await fetch(new URL('api.json', document.baseURI).href, { cache: 'no-store' })
        if (!res.ok) return ''
        const json = (await res.json()) as { apiBase?: string }
        const base = String(json.apiBase ?? '').trim().replace(/\/+$/, '')
        if (!base) return ''
        const url = new URL(base)
        return url.protocol === 'https:' || url.hostname === 'localhost' ? base : ''
      } catch {
        return ''
      }
    })()
  }
  return configPromise
}

export function workspaceState(): { state: WorkspaceState; error: string | null } {
  return { state, error: lastError }
}

/** True once records are shared through the server for this session. */
export function isWorkspaceShared(): boolean {
  return state === 'connected'
}

function setState(next: WorkspaceState, error: string | null = null): void {
  state = next
  lastError = error
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(WORKSPACE_STATE_EVENT, { detail: { state, error } }))
}

interface StoredSession {
  token: string
  expiresAt: string
  email: string
}

function readSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(WORKSPACE_SESSION_KEY)
    if (!raw) return null
    const row = JSON.parse(raw) as StoredSession
    return row.token && Date.parse(row.expiresAt) > Date.now() + 60_000 ? row : null
  } catch {
    return null
  }
}

export function clearWorkspaceSession(): void {
  try {
    sessionStorage.removeItem(WORKSPACE_SESSION_KEY)
  } catch {
    // ignore
  }
  setState('off')
}

export class WorkspaceAccessError extends Error {
  /** True when the server refused the person (not approved / not verified), not a network problem. */
  readonly denied: boolean
  constructor(message: string, denied: boolean) {
    super(message)
    this.name = 'WorkspaceAccessError'
    this.denied = denied
  }
}

/**
 * Exchange the Microsoft sign-in for a workspace session. The server checks the token
 * signature, audience, tenant, expiry, and the approved-user list.
 */
export async function connectWorkspace(email: string, force = false): Promise<boolean> {
  const base = await workspaceApiBase()
  if (!base) {
    setState('off')
    return false
  }
  const existing = readSession()
  if (!force && existing && existing.email === email.toLowerCase()) {
    setState('connected')
    return true
  }
  setState('connecting')
  const idToken = await getMicrosoftIdToken()
  if (!idToken) {
    setState('error', 'Microsoft sign-in is needed to open the shared workspace.')
    throw new WorkspaceAccessError('Microsoft sign-in is needed to open the shared workspace. Sign in again.', true)
  }
  let res: Response
  try {
    res = await fetch(`${base}/api/auth/microsoft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) })
  } catch {
    setState('error', 'The Newport server could not be reached.')
    throw new WorkspaceAccessError('The Newport server could not be reached. Check the connection and try again.', false)
  }
  const body = (await res.json().catch(() => ({}))) as { token?: string; expiresAt?: string; error?: string; user?: { email?: string } }
  if (!res.ok || !body.token || !body.expiresAt) {
    const message = body.error || `The Newport server refused sign-in (${res.status}).`
    setState('error', message)
    throw new WorkspaceAccessError(message, res.status === 401 || res.status === 403)
  }
  const verified = String(body.user?.email ?? '').toLowerCase()
  if (verified && verified !== email.toLowerCase()) {
    setState('error', 'The server verified a different Microsoft account.')
    throw new WorkspaceAccessError(`The server verified ${verified}, not ${email}. Sign out and sign in again.`, true)
  }
  try {
    sessionStorage.setItem(WORKSPACE_SESSION_KEY, JSON.stringify({ token: body.token, expiresAt: body.expiresAt, email: email.toLowerCase() }))
  } catch {
    // storage blocked: the session works for this page only
  }
  setState('connected')
  return true
}

async function request(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const base = await workspaceApiBase()
  const session = readSession()
  if (!base || !session) throw new Error('The shared workspace is not connected.')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${session.token}`)
  const res = await fetch(`${base}/api/workspace${path}`, { ...init, headers })
  if (res.status === 401 && !retried) {
    await connectWorkspace(session.email, true)
    return request(path, init, true)
  }
  if (res.ok) {
    if (state !== 'connected') setState('connected')
    return res
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  throw new Error(body.error || `The Newport server returned ${res.status}.`)
}

export async function pullWorkspace(since?: string | null): Promise<WorkspacePull> {
  const res = await request(since ? `?since=${encodeURIComponent(since)}` : '')
  return (await res.json()) as WorkspacePull
}

export async function pushWorkspaceChanges(changes: { collection: WorkspaceCollection; id: string; data: unknown | null }[]): Promise<string> {
  let serverTime = ''
  for (let i = 0; i < changes.length; i += 400) {
    const res = await request('/changes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: changes.slice(i, i + 400) }) })
    serverTime = ((await res.json()) as { serverTime?: string }).serverTime ?? serverTime
  }
  return serverTime
}

export async function uploadWorkspaceFile(docId: string, file: Blob, name: string): Promise<void> {
  await request(`/files/${encodeURIComponent(docId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(name) },
    body: file,
  })
}

export async function downloadWorkspaceFile(docId: string): Promise<Blob | null> {
  try {
    const res = await request(`/files/${encodeURIComponent(docId)}`)
    return await res.blob()
  } catch {
    return null
  }
}

export async function deleteWorkspaceFile(docId: string): Promise<void> {
  await request(`/files/${encodeURIComponent(docId)}`, { method: 'DELETE' }).catch(() => undefined)
}
