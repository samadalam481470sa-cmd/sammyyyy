import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './components/dashboard/Dashboard';
import { ALL_NAV_ITEMS } from './config/navigation';
import { ModulePlaceholderPage } from './pages/ModulePlaceholderPage';
import { DashboardDataProvider } from './state/DashboardDataProvider';
import { DashboardFiltersProvider } from './state/DashboardFiltersProvider';
import { ToastProvider } from './state/ToastProvider';

const PLACEHOLDER_ROUTES = ALL_NAV_ITEMS.filter((item) => !item.available);

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <DashboardDataProvider>
          <DashboardFiltersProvider>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<Dashboard />} />
                {PLACEHOLDER_ROUTES.map((item) => (
                  <Route key={item.id} path={item.path} element={<ModulePlaceholderPage />} />
                ))}
                <Route path="*" element={<ModulePlaceholderPage />} />
              </Route>
            </Routes>
          </DashboardFiltersProvider>
        </DashboardDataProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
