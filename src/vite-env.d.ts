/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATIC_DEMO?: string
  readonly VITE_MSAL_CLIENT_ID?: string
  readonly VITE_MSAL_TENANT?: string
  readonly VITE_APP_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
