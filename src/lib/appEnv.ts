export type AppEnvironment = 'development' | 'staging' | 'production'

export function appEnvironment(raw = String(import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE ?? 'development')): AppEnvironment {
  if (raw === 'production' || raw === 'staging' || raw === 'development') return raw
  return 'development'
}
