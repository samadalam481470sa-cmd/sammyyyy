import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { DataProvider } from '@/data/DataContext'
import { AppShell } from '@/components/layout/AppShell'
import { Dashboard } from '@/pages/Dashboard'
import { LoginPage } from '@/pages/LoginPage'
import { OpportunitiesPage } from '@/pages/OpportunitiesPage'
import { SecurityPage } from '@/pages/SecurityPage'
import { RelationshipsPage } from '@/pages/RelationshipsPage'
import { TasksPage } from '@/pages/TasksPage'
import { EmailPage } from '@/pages/EmailPage'
import { DocumentsPage } from '@/pages/DocumentsPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { MeetingsPage } from '@/pages/MeetingsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { OfflineNotice } from '@/components/shared/OfflineNotice'

// Hash routing keeps the static demo working from any CDN subpath
const Router = import.meta.env.VITE_STATIC_DEMO ? HashRouter : BrowserRouter

export default function App() {
  return (
    <AuthProvider>
      <OfflineNotice />
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
              <Route path="projects" element={<Navigate to="/opportunities" replace />} />
              <Route path="relationships" element={<RelationshipsPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="sources" element={<Navigate to="/relationships" replace />} />
              <Route path="carriers" element={<Navigate to="/relationships" replace />} />
              <Route path="email" element={<EmailPage />} />
              <Route path="portfolio" element={<Navigate to="/" replace />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="meetings" element={<MeetingsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="security" element={<SecurityPage />} />
              <Route path="security/keys" element={<Navigate to="/security" replace />} />
              <Route path="security/provision" element={<Navigate to="/security" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}
