import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import PlaceholderPage from './pages/PlaceholderPage';
import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from './data/navigation';

const PLACEHOLDER_ROUTES = [...PRIMARY_NAV_ITEMS, ...SECONDARY_NAV_ITEMS].filter((item) => item.isPlaceholder);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          {PLACEHOLDER_ROUTES.map((item) => (
            <Route key={item.id} path={item.path.slice(1)} element={<PlaceholderPage />} />
          ))}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
