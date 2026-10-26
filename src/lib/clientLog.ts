const KEY = 'newport_crm_client_log_v1'
const LIMIT = 40

export interface ClientLogEntry {
  at: string
  message: string
}

export function redactLogMessage(message: string): string {
  return message
    .replace(/https?:\/\/[^\s]+/gi, (url) => url.split('?')[0] ?? url)
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
    .slice(0, 500)
}

export function rememberClientLog(message: string): void {
  const entry: ClientLogEntry = { at: new Date().toISOString(), message: redactLogMessage(message) }
  try {
    const current = JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as ClientLogEntry[]
    const next = Array.isArray(current) ? [...current, entry].slice(-LIMIT) : [entry]
    sessionStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private mode can refuse storage. The error still reaches the console.
  }
}

export function installClientLogging(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (event) => {
    rememberClientLog(event.message || 'window error')
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? 'unhandled rejection')
    rememberClientLog(reason)
  })
}
