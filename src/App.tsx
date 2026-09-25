import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Dashboard } from "./components/dashboard/Dashboard.tsx"
import { AppShell } from "./components/shell/AppShell.tsx"
import { PlaceholderPage } from "./components/shell/PlaceholderPage.tsx"
import { CrmProvider } from "./context/CrmProvider.tsx"
import { MAIN_NAV, SETTINGS_NAV } from "./data/navigation.ts"

const PLACEHOLDERS = [...MAIN_NAV.filter((item) => !item.implemented), SETTINGS_NAV]

export default function App() {
  return (
    <BrowserRouter>
      <CrmProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            {PLACEHOLDERS.map((item) => (
              <Route
                key={item.to}
                path={item.to}
                element={<PlaceholderPage title={item.label} description={item.description} />}
              />
            ))}
            <Route
              path="*"
              element={
                <PlaceholderPage
                  title="Page not found"
                  description="That page is not part of the acquisition workspace."
                />
              }
            />
          </Routes>
        </AppShell>
      </CrmProvider>
    </BrowserRouter>
  )
}
