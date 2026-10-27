import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {
  ensureMsal,
  hasEntraRedirectReturn,
  isMsalChildWindow,
  loadEntraConfig,
  microsoftLoginInProgress,
} from '@/auth/msal'
import { AppErrorBoundary } from '@/components/shared/AppErrorBoundary'
import { installClientLogging } from '@/lib/clientLog'

installClientLogging()

let rendered = false
function render() {
  if (rendered) return
  rendered = true
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>,
  )
}

function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || microsoftLoginInProgress()) return
    refreshing = true
    window.location.reload()
  })
  const base = import.meta.env.BASE_URL
  void navigator.serviceWorker
    .register(`${base}sw.js`, { scope: base, updateViaCache: 'none' })
    .then((registration) => registration.update())
    .catch(() => undefined)
}

function boot(): void {
  // Only hold the first paint while Microsoft is handing back a sign-in, so the
  // router cannot strip the response before MSAL reads it. Normal loads render at once.
  const waitForMicrosoft = hasEntraRedirectReturn()

  // Returning from Microsoft: finish sign-in right away with the built-in app ID
  // instead of waiting for the settings download first.
  const msalWarmup = (waitForMicrosoft ? ensureMsal() : loadEntraConfig().then(() => ensureMsal())).catch(
    () => null,
  )
  if (waitForMicrosoft) void loadEntraConfig()

  void (waitForMicrosoft
    ? Promise.race([msalWarmup, new Promise((resolve) => window.setTimeout(resolve, 8000))])
    : Promise.resolve()
  )
    .catch(() => undefined)
    .finally(() => {
      render()
      registerServiceWorker()
    })
}

if (isMsalChildWindow()) {
  // Microsoft's Connect Outlook popup (or a token iframe) landed back here. The main
  // window reads the result from this address and closes the popup, so do not start
  // the CRM or change the address.
  const root = document.getElementById('root')
  if (root) {
    root.setAttribute('style', 'color:#e6eef8;font:14px system-ui;padding:24px')
    root.textContent = 'Finishing Microsoft sign-in…'
  }
} else {
  boot()
}
