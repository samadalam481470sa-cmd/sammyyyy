import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { DataProvider } from '@/data/DataContext'
import { AppShell } from '@/components/layout/AppShell'
import { Dashboard } from '@/pages/Dashboard'
import { LoginPage } from '@/pages/LoginPage'
import { OpportunitiesPage } from '@/pages/OpportunitiesPage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { SecurityPage } from '@/pages/SecurityPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

// Hash routing keeps the static demo working from any CDN subpath
const Router = import.meta.env.VITE_STATIC_DEMO ? HashRouter : BrowserRouter

export default function App() {
  return (
    <AuthProvider>
      <Router basename={import.meta.env.VITE_STATIC_DEMO ? undefined : import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route
              element={
                <DataProvider>
                  <AppShell />
                </DataProvider>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="opportunities" element={<OpportunitiesPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="security" element={<SecurityPage />} />
              <Route path="relationships" element={<PlaceholderPage title="Relationships" />} />
              <Route path="tasks" element={<PlaceholderPage title="Tasks & Follow-Ups" />} />
              <Route path="sources" element={<PlaceholderPage title="Sources / Bankers" />} />
              <Route path="carriers" element={<PlaceholderPage title="Carriers / Reinsurers" />} />
              <Route path="portfolio" element={<PlaceholderPage title="Portfolio Companies" />} />
              <Route path="documents" element={<PlaceholderPage title="Documents" />} />
              <Route path="reports" element={<PlaceholderPage title="Reports" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}
