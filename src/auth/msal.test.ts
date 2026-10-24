import { describe, expect, it } from 'vitest'
import {
  isMicrosoftAuthCancelled,
  isMicrosoftAuthFallback,
  microsoftAuthErrorCode,
  MicrosoftAuthUnavailableError,
  spaRedirectUriFromLocation,
  stripAuthRedirectQuery,
  userFromMicrosoftAccount,
} from './msal'

describe('Microsoft 365 SPA URLs', () => {
  it('uses the site root, not the hash login route', () => {
    expect(spaRedirectUriFromLocation('http://localhost:5173/login')).toBe('http://localhost:5173/')
    expect(spaRedirectUriFromLocation('http://localhost:5173/opportunities')).toBe(
      'http://localhost:5173/',
    )
    expect(spaRedirectUriFromLocation('http://localhost:5173/')).toBe('http://localhost:5173/')
    expect(
      spaRedirectUriFromLocation(
        'https://samadalam481470sa-cmd.github.io/sammyyyy/#/login',
      ),
    ).toBe('https://samadalam481470sa-cmd.github.io/sammyyyy/')
    expect(
      spaRedirectUriFromLocation(
        'https://samadalam481470sa-cmd.github.io/sammyyyy/index.html',
      ),
    ).toBe('https://samadalam481470sa-cmd.github.io/sammyyyy/')
  })

  it('keeps Entra return URLs on the static origin so login never bounces through a CRM route', () => {
    expect(
      stripAuthRedirectQuery(
        'https://samadalam481470sa-cmd.github.io/sammyyyy/?code=abc&state=1&client_info=x',
      ),
    ).toBe('/sammyyyy/')
    expect(stripAuthRedirectQuery('http://localhost:5173/#/login')).toBe('/#/login')
  })
})

describe('Microsoft 365 errors', () => {
  it('treats a closed popup as a cancelled sign-in, not a hard failure', () => {
    expect(microsoftAuthErrorCode({ errorCode: 'user_cancelled' })).toBe('user_cancelled')
    expect(isMicrosoftAuthCancelled({ errorCode: 'user_cancelled' })).toBe(true)
    expect(isMicrosoftAuthCancelled({ errorCode: 'user_canceled' })).toBe(true)
    expect(isMicrosoftAuthCancelled({ errorCode: 'popup_window_error' })).toBe(false)
    expect(isMicrosoftAuthCancelled({ errorCode: 'invalid_grant' })).toBe(false)
  })

  it('falls back to the typed Microsoft email when Entra popup cannot finish', () => {
    expect(isMicrosoftAuthFallback(new MicrosoftAuthUnavailableError())).toBe(true)
    expect(isMicrosoftAuthFallback({ errorCode: 'popup_window_error' })).toBe(true)
    expect(isMicrosoftAuthFallback({ errorCode: 'monitor_window_timeout' })).toBe(true)
    expect(isMicrosoftAuthFallback({ errorCode: 'interaction_in_progress' })).toBe(true)
    expect(isMicrosoftAuthFallback({ errorCode: 'user_cancelled' })).toBe(false)
  })

  it('rejects an Entra account that has no email so logout/login stay keyed to an inbox', () => {
    expect(() =>
      userFromMicrosoftAccount({
        homeAccountId: 'x',
        localAccountId: 'x',
        environment: 'login.windows.net',
        tenantId: 'common',
        username: '',
      }),
    ).toThrow(/email/i)
    expect(
      userFromMicrosoftAccount({
        homeAccountId: 'x',
        localAccountId: 'x',
        environment: 'login.windows.net',
        tenantId: 'common',
        username: 'sam@outlook.com',
        name: 'Sam',
      }).email,
    ).toBe('sam@outlook.com')
  })
})
