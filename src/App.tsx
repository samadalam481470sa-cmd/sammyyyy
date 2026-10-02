import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { CrmActionModals } from './components/crm/CrmActionModals';
import { Dashboard } from './components/dashboard/Dashboard';
import { AppShell } from './components/layout/AppShell';
import { CarriersPage } from './pages/CarriersPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { OpportunitiesPage } from './pages/OpportunitiesPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { RelationshipsPage } from './pages/RelationshipsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SourcesPage } from './pages/SourcesPage';
import { TasksPage } from './pages/TasksPage';
import { DashboardDataProvider } from './state/DashboardDataProvider';
import { DashboardFiltersProvider } from './state/DashboardFiltersProvider';
import { ToastProvider } from './state/ToastProvider';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <DashboardDataProvider>
          <DashboardFiltersProvider>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<Dashboard />} />
                <Route path="opportunities" element={<OpportunitiesPage />} />
                <Route path="relationships" element={<RelationshipsPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="sources" element={<SourcesPage />} />
                <Route path="carriers" element={<CarriersPage />} />
                <Route path="portfolio" element={<PortfolioPage />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Dashboard />} />
              </Route>
            </Routes>
            <CrmActionModals />
          </DashboardFiltersProvider>
        </DashboardDataProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
