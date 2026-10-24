import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensureMsal, loadEntraConfig } from '@/auth/msal'

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

render()
void loadEntraConfig()
  .then(() => ensureMsal())
  .catch(() => undefined)
