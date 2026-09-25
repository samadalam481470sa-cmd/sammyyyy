import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Dashboard } from '@/pages/Dashboard'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="opportunities" element={<PlaceholderPage title="Opportunities" />} />
          <Route path="relationships" element={<PlaceholderPage title="Relationships" />} />
          <Route path="tasks" element={<PlaceholderPage title="Tasks & Follow-Ups" />} />
          <Route path="sources" element={<PlaceholderPage title="Sources / Bankers" />} />
          <Route path="carriers" element={<PlaceholderPage title="Carriers / Reinsurers" />} />
          <Route path="portfolio" element={<PlaceholderPage title="Portfolio Companies" />} />
          <Route path="documents" element={<PlaceholderPage title="Documents" />} />
          <Route path="reports" element={<PlaceholderPage title="Reports" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
