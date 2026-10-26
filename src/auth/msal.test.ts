import { describe, expect, it } from 'vitest'
import {
  buildGraphTokenRequest,
  buildMicrosoftLoginRequest,
  entraReturnErrorFromLocation,
  hasEntraRedirectReturn,
  isAuthResponseString,
  signInErrorDetail,
  isMicrosoftAuthCancelled,
  isMicrosoftAuthFallback,
  isMicrosoftCredentialDenied,
  clientIdFromEntraDocument,
  ENTRA_SPA_CLIENT_ID,
  LOGIN_SCOPES,
  msalAuthority,
  msalClientId,
  microsoftAuthErrorCode,
  microsoftBlockReason,
  registeredBrowserUrl,
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

  it('lets a future entra.json replace the client ID and keeps the default when the file is empty', () => {
    expect(clientIdFromEntraDocument({ clientId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' })).toBe(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    )
    expect(clientIdFromEntraDocument({ clientId: '  ' })).toBe(ENTRA_SPA_CLIENT_ID)
    expect(clientIdFromEntraDocument(null)).toBe(ENTRA_SPA_CLIENT_ID)
  })

  it('requests mailbox tokens without prompt=consent or prompt=login', () => {
    const request = buildGraphTokenRequest(['Mail.Read', 'Mail.Send'], { homeAccountId: 'account' })
    expect(request).toEqual({ scopes: ['Mail.Read', 'Mail.Send'], account: { homeAccountId: 'account' } })
    expect(request).not.toHaveProperty('prompt')
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
    expect(isMicrosoftCredentialDenied({ errorCode: 'access_denied' })).toBe(true)
    expect(isMicrosoftCredentialDenied({ errorCode: 'interaction_in_progress' })).toBe(false)
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

describe('Microsoft sign-in in Cursor / preview windows', () => {
  const base = { href: 'http://localhost:5173/login', framed: false, hasCrypto: true }

  it('runs normally in a real localhost tab', () => {
    expect(microsoftBlockReason(base)).toBeNull()
    expect(
      microsoftBlockReason({ ...base, href: 'https://samadalam481470sa-cmd.github.io/sammyyyy/' }),
    ).toBeNull()
  })

  it('hands off when the app is inside an editor preview iframe', () => {
    expect(microsoftBlockReason({ ...base, framed: true })).toBe('embedded')
  })

  it('moves 127.0.0.1 and 0.0.0.0 to the registered localhost redirect', () => {
    expect(microsoftBlockReason({ ...base, href: 'http://127.0.0.1:5173/' })).toBe('loopback-alias')
    expect(registeredBrowserUrl('http://127.0.0.1:5173/login')).toBe('http://localhost:5173/login')
    expect(registeredBrowserUrl('http://0.0.0.0:5173/')).toBe('http://localhost:5173/')
  })

  it('flags plain-http LAN pages that have no WebCrypto', () => {
    expect(
      microsoftBlockReason({ href: 'http://192.168.1.20:5173/', framed: false, hasCrypto: false }),
    ).toBe('insecure')
  })
})

describe('Microsoft fragment sign-in return', () => {
  it('detects a fragment response that hash routing would otherwise erase', () => {
    expect(
      hasEntraRedirectReturn('https://samadalam481470sa-cmd.github.io/sammyyyy/#code=abc&client_info=x&state=s1'),
    ).toBe(true)
    expect(hasEntraRedirectReturn('https://samadalam481470sa-cmd.github.io/sammyyyy/#error=access_denied&state=s1')).toBe(true)
    expect(isAuthResponseString('#/email')).toBe(false)
    expect(isAuthResponseString('#/login?code=1')).toBe(false)
    expect(isAuthResponseString('#code=abc')).toBe(false)
  })

  it('explains Microsoft account-type and admin-consent errors in plain words', () => {
    expect(signInErrorDetail(new Error('AADSTS50020: User account from identity provider does not exist'))).toMatch(
      /any organization and personal/i,
    )
    expect(signInErrorDetail(new Error('AADSTS65001: The user or administrator has not consented'))).toMatch(/IT admin/i)
    expect(signInErrorDetail(null, null)).toBeNull()
  })
})

