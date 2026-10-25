import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensureMsal, loadEntraConfig, microsoftLoginInProgress } from '@/auth/msal'
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

void Promise.race([
  loadEntraConfig().then(() => ensureMsal()),
  new Promise((resolve) => window.setTimeout(resolve, 8000)),
])
  .catch(() => undefined)
  .finally(() => {
    render()
    registerServiceWorker()
  })
