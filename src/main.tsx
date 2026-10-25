import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensureMsal, loadEntraConfig } from '@/auth/msal'
import { AppErrorBoundary } from '@/components/shared/AppErrorBoundary'
import { installClientLogging } from '@/lib/clientLog'

installClientLogging()

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>,
  )
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL
    void navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base, updateViaCache: 'none' })
      .then((registration) => registration.update())
      .catch(() => undefined)
  })
}

render()
void loadEntraConfig()
  .then(() => ensureMsal())
  .catch(() => undefined)
