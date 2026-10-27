/**
 * Composer support for the Email page (guide p65-p71): autosave, signatures, recipient checks,
 * and attachment limits. Everything is kept per CRM user and erased at logout with the rest
 * of the personal mail data (keys start with newport_outlook_).
 */
import type { MailProvider, OutgoingAttachment } from '@/lib/outlookMailbox'

function key(kind: string, owner: string): string {
  return `newport_outlook_${kind}:${owner.trim().toLowerCase()}`
}

export interface SavedCompose<T> {
  draft: T
  savedAt: string
}

/** The unsent message being written, saved on this device so a refresh or crash cannot lose it. */
export function saveComposeLocally<T>(owner: string, draft: T | null): void {
  try {
    if (draft == null) localStorage.removeItem(key('compose', owner))
    else localStorage.setItem(key('compose', owner), JSON.stringify({ draft, savedAt: new Date().toISOString() }))
  } catch {
    // storage full or blocked; the composer keeps working
  }
}

export function loadComposeLocally<T>(owner: string): SavedCompose<T> | null {
  try {
    const raw = localStorage.getItem(key('compose', owner))
    return raw ? (JSON.parse(raw) as SavedCompose<T>) : null
  } catch {
    return null
  }
}

/** Platform signature for this CRM user (not synced to Outlook or Gmail settings). */
export function loadSignature(owner: string): string {
  try {
    return localStorage.getItem(key('signature', owner)) ?? ''
  } catch {
    return ''
  }
}

export function saveSignature(owner: string, signature: string): void {
  try {
    if (signature.trim()) localStorage.setItem(key('signature', owner), signature.slice(0, 2000))
    else localStorage.removeItem(key('signature', owner))
  } catch {
    // ignore
  }
}

export const SIGNATURE_MARK = '\n\n-- \n'

/** Add the signature once. Reopening a draft that already has it does not add it again. */
export function withSignature(body: string, signature: string): string {
  const sig = signature.trim()
  if (!sig || body.includes(`${SIGNATURE_MARK}${sig}`)) return body
  return `${SIGNATURE_MARK}${sig}${body}`
}

const ADDRESS = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}$/

/** Addresses that are not valid email addresses. Empty list means all are valid. */
export function invalidAddresses(raw: string): string[] {
  if (/[\r\n]/.test(raw)) return [raw.replace(/[\r\n]+/g, ' ').trim()]
  return raw
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => /<([^>]+)>/.exec(part)?.[1]?.trim() ?? part)
    .filter((address) => !ADDRESS.test(address))
}

/** Size limits for attachments sent through each provider's API. */
export const ATTACHMENT_LIMITS: Record<MailProvider, { perFile: number; total: number; label: string }> = {
  outlook: { perFile: 3 * 1024 * 1024, total: 20 * 1024 * 1024, label: 'Outlook accepts files up to 3 MB each here.' },
  gmail: { perFile: 4 * 1024 * 1024, total: 4 * 1024 * 1024, label: 'Gmail accepts up to 4 MB of attachments in total here.' },
}

export function attachmentProblem(files: OutgoingAttachment[], provider: MailProvider): string | null {
  const limit = ATTACHMENT_LIMITS[provider]
  const big = files.find((file) => file.size > limit.perFile)
  if (big) return `${big.name} is too large. ${limit.label}`
  const total = files.reduce((sum, file) => sum + file.size, 0)
  if (total > limit.total) return `These attachments are too large together. ${limit.label}`
  return null
}

const BLOCKED_EXTENSIONS = /\.(exe|bat|cmd|com|scr|msi|vbs|js|jar|ps1|sh)$/i

export function readAttachment(file: File): Promise<OutgoingAttachment> {
  return new Promise((resolve, reject) => {
    if (BLOCKED_EXTENSIONS.test(file.name)) {
      reject(new Error(`${file.name} cannot be attached. Program files are blocked by mail providers.`))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve({
        name: file.name.replace(/[\\/]/g, '_').slice(0, 200),
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        base64: result.slice(result.indexOf(',') + 1),
      })
    }
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`))
    reader.readAsDataURL(file)
  })
}

/** Undo send: the message waits this long before it is handed to the provider (guide p69). */
export const UNDO_SEND_MS = 10_000
