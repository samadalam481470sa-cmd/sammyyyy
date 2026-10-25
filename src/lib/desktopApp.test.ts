import { describe, expect, it } from 'vitest'
import { desktopManifest, desktopServiceWorkerSource, macInstallerScript, windowsInstallerScript, DESKTOP_APP_URL } from './desktopApp'
import { appEnvironment } from './appEnv'
import { redactLogMessage } from './clientLog'

describe('desktop app packaging', () => {
  it('scopes the installed window to the GitHub Pages site', () => {
    const manifest = desktopManifest('/sammyyyy/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/sammyyyy/')
    expect(manifest.scope).toBe('/sammyyyy/')
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512', '512x512'])
    expect(manifest.id).toBe('/sammyyyy/')
  })

  it('publishes the same Windows and Mac downloaders people save', () => {
    expect(windowsInstallerScript()).toContain(DESKTOP_APP_URL)
    expect(windowsInstallerScript()).toContain('--app=%URL%')
    expect(windowsInstallerScript()).toContain('Desktop')
    expect(windowsInstallerScript()).not.toContain('client_secret')
    expect(macInstallerScript()).toContain(DESKTOP_APP_URL)
    expect(macInstallerScript().startsWith('#!/bin/bash')).toBe(true)
  })

  it('does not cache Microsoft login traffic', () => {
    const source = desktopServiceWorkerSource()
    expect(source).toContain("url.origin !== self.location.origin")
    expect(source).not.toContain('login.microsoftonline.com')
    expect(source).toContain('entra.json')
  })
})

describe('app environment', () => {
  it('accepts only the three release names', () => {
    expect(appEnvironment('production')).toBe('production')
    expect(appEnvironment('staging')).toBe('staging')
    expect(appEnvironment('development')).toBe('development')
    expect(appEnvironment('preview')).toBe('development')
  })
})

describe('client logs', () => {
  it('strips tokens and query strings before anything is stored', () => {
    expect(redactLogMessage('failed https://crm.example/api?code=secret Bearer abc.def')).toBe(
      'failed https://crm.example/api Bearer [redacted]',
    )
  })
})
