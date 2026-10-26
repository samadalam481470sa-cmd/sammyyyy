/** Normalize a work / Microsoft / personal email for login and data vault keys. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw)
  if (email.length < 3 || email.length > 254) return false
  if (email.includes('..')) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function parseLoginEmail(
  raw: string,
): { ok: true; email: string } | { ok: false; error: string } {
  const email = normalizeEmail(raw)
  if (!email) return { ok: false, error: 'Enter your work email to continue.' }
  if (!isValidEmail(email)) return { ok: false, error: 'Enter a valid email address.' }
  return { ok: true, email }
}

export function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'User'
  const named = local
    .replace(/[._+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!named) return email
  return named.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  const letters = `${parts[0]?.[0] ?? 'M'}${parts[1]?.[0] ?? ''}`
  return letters.toUpperCase().slice(0, 2)
}

export function emailOwnerKey(email: string): string {
  return `email:${normalizeEmail(email)}`
}

export type LoginProvider = 'microsoft' | 'outlook' | 'gmail' | 'other'

const OUTLOOK_DOMAINS = new Set([
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'outlook.co.uk',
])

export function loginProviderFromEmail(email: string): LoginProvider {
  const domain = normalizeEmail(email).split('@')[1] ?? ''
  if (domain === 'gmail.com' || domain === 'googlemail.com') return 'gmail'
  if (OUTLOOK_DOMAINS.has(domain)) return 'outlook'
  if (domain.endsWith('.onmicrosoft.com') || domain.endsWith('.microsoft.com')) return 'microsoft'
  return 'other'
}

export function loginProviderLabel(provider: LoginProvider): string {
  if (provider === 'gmail') return 'Gmail'
  if (provider === 'outlook') return 'Outlook'
  if (provider === 'microsoft') return 'Microsoft 365'
  return 'Work email'
}

export const LAST_EMAIL_KEY = 'newport_crm_last_email'
export const LAST_PROVIDER_KEY = 'newport_crm_last_login_provider'
