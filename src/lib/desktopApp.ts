export const DESKTOP_APP_NAME = 'Newport CRM'
export const DESKTOP_CACHE = 'newport-crm-shell-v1'

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
      { src: `${root}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
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
  if (url.pathname.endsWith('/entra.json')) return
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
