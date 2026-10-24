import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

export function ProtectedRoute() {
  const { isAuthenticated, authReady, signingOut } = useAuth()
  const location = useLocation()

  if (!authReady) {
    return <div className="min-h-full bg-navy-950" aria-busy="true" />
  }

  if (!isAuthenticated) {
    if (location.pathname !== '/login' && !signingOut) {
      try {
        sessionStorage.setItem('newport_post_login_path', `${location.pathname}${location.search}`)
      } catch {
        // ignore
      }
    }
    if (signingOut) {
      try {
        sessionStorage.removeItem('newport_post_login_path')
      } catch {
        // ignore
      }
    }
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
