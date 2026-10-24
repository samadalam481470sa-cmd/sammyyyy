import { describe, expect, it } from 'vitest'
import {
  displayNameFromEmail,
  emailOwnerKey,
  isValidEmail,
  loginProviderFromEmail,
  loginProviderLabel,
  normalizeEmail,
  parseLoginEmail,
} from './emailIdentity'

describe('email identity', () => {
  it('accepts any well-formed work or personal email', () => {
    expect(isValidEmail('mary@outlook.com')).toBe(true)
    expect(isValidEmail('Mary.Sbaschnig@NewportSpecialty.com')).toBe(true)
    expect(isValidEmail('anyone@gmail.com')).toBe(true)
    expect(isValidEmail('not-an-email')).toBe(false)
    expect(isValidEmail('')).toBe(false)
    expect(parseLoginEmail('  Sam@Outlook.com ')).toEqual({
      ok: true,
      email: 'sam@outlook.com',
    })
    expect(parseLoginEmail('nope').ok).toBe(false)
  })

  it('keys the CRM vault by normalized email so logout/login restores the same edits', () => {
    expect(normalizeEmail('Mary@Outlook.com')).toBe('mary@outlook.com')
    expect(emailOwnerKey('Mary@Outlook.com')).toBe('email:mary@outlook.com')
    expect(emailOwnerKey('mary@outlook.com')).toBe(emailOwnerKey('  MARY@OUTLOOK.COM '))
    expect(displayNameFromEmail('mary.sbaschnig@outlook.com')).toBe('Mary Sbaschnig')
  })

  it('labels Microsoft, Outlook, Gmail, and other work email', () => {
    expect(loginProviderFromEmail('anyone@gmail.com')).toBe('gmail')
    expect(loginProviderFromEmail('sam@outlook.com')).toBe('outlook')
    expect(loginProviderFromEmail('ops@newport.onmicrosoft.com')).toBe('microsoft')
    expect(loginProviderFromEmail('analyst@newportspecialty.com')).toBe('other')
    expect(loginProviderLabel('microsoft')).toBe('Microsoft 365')
  })
})
