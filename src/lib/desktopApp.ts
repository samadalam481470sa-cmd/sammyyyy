export const DESKTOP_APP_NAME = 'Newport CRM'
export const DESKTOP_CACHE = 'newport-crm-shell-v1'
export const DESKTOP_APP_URL = 'https://samadalam481470sa-cmd.github.io/sammyyyy/'
export const WINDOWS_LAUNCHER_FILE = 'download/Install-Newport-CRM.cmd'
export const MAC_LAUNCHER_FILE = 'download/Install-Newport-CRM.command'

/** Live-site launcher href for dev (`/`) and GitHub Pages (`/sammyyyy/`). */
export function launcherHref(kind: 'windows' | 'mac', base: string): string {
  const file = kind === 'windows' ? WINDOWS_LAUNCHER_FILE : MAC_LAUNCHER_FILE
  const root = base.endsWith('/') ? base : `${base}/`
  return `${root}${file}`
}

export interface DesktopManifest {
  name: string
  short_name: string
  description: string
  start_url: string
  scope: string
  display: 'standalone'
  background_color: string
  theme_color: string
  icons: { src: string; sizes: string; type: string; purpose: string }[]
  id: string
}

/** Installable window metadata. Paths stay inside the deployed site root. */
export function desktopManifest(base: string): DesktopManifest {
  const root = base.endsWith('/') ? base : `${base}/`
  return {
    name: 'Newport Specialty Partners CRM',
    short_name: DESKTOP_APP_NAME,
    description: 'Acquisition dashboard for Newport Specialty Partners.',
    start_url: root,
    scope: root,
    display: 'standalone',
    background_color: '#040b16',
    theme_color: '#061525',
    icons: [
      { src: `${root}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${root}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${root}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    id: root,
  }
}

/** Network-first shell. Microsoft login and other origins are never cached. */
export function desktopServiceWorkerSource(): string {
  return `const CACHE = ${JSON.stringify(DESKTOP_CACHE)}
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['./', './index.html', './favicon.svg'])).then(() => self.skipWaiting()).catch(() => self.skipWaiting()),
  )
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  )
})
self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.searchParams.has('code') || url.searchParams.has('state') || url.searchParams.has('error')) return
  if (url.pathname.endsWith('/entra.json')) return
  if (url.pathname.endsWith('/google.json')) return
  if (url.pathname.endsWith('/database/newport-crm.json')) return
  if (url.pathname.endsWith('/download/Install-Newport-CRM.cmd')) return
  if (url.pathname.endsWith('/download/Install-Newport-CRM.command')) return
  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined)
      }
      return response
    }).catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
  )
})
`
}

/** Downloadable Windows launcher. Each person runs it once; later deploys load from the live site. */
export function windowsInstallerScript(): string {
  const url = DESKTOP_APP_URL
  return [
    '@echo off',
    'setlocal',
    `set "URL=${url}"`,
    'set "EDGE=%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe"',
    'if not exist "%EDGE%" set "EDGE=%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"',
    'if not exist "%EDGE%" set "EDGE=%LocalAppData%\\Microsoft\\Edge\\Application\\msedge.exe"',
    'if not exist "%EDGE%" (',
    '  echo Microsoft Edge is required to install Newport CRM.',
    '  exit /b 1',
    ')',
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath(\'Desktop\') + \'\\Newport CRM.lnk\'); $s.TargetPath=\'%EDGE%\'; $s.Arguments=\'--app=%URL%\'; $s.Description=\'Newport CRM\'; $s.Save()"',
    'start "" "%EDGE%" --app="%URL%"',
    '',
  ].join('\r\n')
}

/** Downloadable Mac launcher. Opens the same live app in its own window. */
export function macInstallerScript(): string {
  const url = DESKTOP_APP_URL
  return `#!/bin/bash
set -euo pipefail
URL="${url}"
if open -na "Microsoft Edge" --args --app="$URL"; then
  exit 0
fi
open -na "Google Chrome" --args --app="$URL"
`
}
