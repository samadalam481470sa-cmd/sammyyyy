import { describe, expect, it } from 'vitest'
import {
  buildMicrosoftLoginRequest,
  entraReturnErrorFromLocation,
  hasEntraRedirectReturn,
  isMicrosoftAuthCancelled,
  isMicrosoftAuthFallback,
  ENTRA_SPA_CLIENT_ID,
  LOGIN_SCOPES,
  msalAuthority,
  msalClientId,
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

  it('uses the common Microsoft cloud authority so work and personal accounts both work', () => {
    expect(msalAuthority()).toBe('https://login.microsoftonline.com/common')
  })

  it('ships the registered Entra SPA client ID so Microsoft cloud sign-in is connected', () => {
    expect(ENTRA_SPA_CLIENT_ID).toBe('2e296364-cbf0-4742-ba8f-3e0615a4e777')
    expect(msalClientId()).toBe(ENTRA_SPA_CLIENT_ID)
  })

  it('forces the hosted Microsoft password page and prefills the typed email', () => {
    expect(buildMicrosoftLoginRequest('ada@outlook.com')).toEqual({
      scopes: LOGIN_SCOPES,
      prompt: 'login',
      loginHint: 'ada@outlook.com',
    })
    expect(buildMicrosoftLoginRequest('  ')).toMatchObject({ prompt: 'login' })
  })

  it('turns Microsoft cloud return errors into a login message', () => {
    expect(
      entraReturnErrorFromLocation(
        'https://example.com/?error=access_denied&error_description=the+user+cancelled',
      ),
    ).toMatch(/cancelled/i)
    expect(
      entraReturnErrorFromLocation(
        'https://example.com/?error=invalid_request&error_description=AADSTS900144:+missing+code',
      ),
    ).toMatch(/AADSTS900144/)
    expect(entraReturnErrorFromLocation('https://example.com/')).toBeNull()
  })

  it('detects the official Microsoft cloud return so the CRM can finish SSO', () => {
    expect(
      hasEntraRedirectReturn(
        'https://samadalam481470sa-cmd.github.io/sammyyyy/?code=abc&state=1',
      ),
    ).toBe(true)
    expect(hasEntraRedirectReturn('https://samadalam481470sa-cmd.github.io/sammyyyy/#/login')).toBe(
      false,
    )
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

  it('classifies Microsoft cloud errors without treating cancel as a hard fault', () => {
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
