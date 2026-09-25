import { useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { NavItemKey } from './components/layout/Sidebar'
import { Dashboard } from './components/Dashboard'
import { PlaceholderView } from './components/PlaceholderView'

export function App() {
  const [activeNav, setActiveNav] = useState<NavItemKey>('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const [isNewOpportunityOpen, setIsNewOpportunityOpen] = useState(false)

  const navDisplayNames: Record<NavItemKey, string> = {
    dashboard: 'Dashboard',
    opportunities: 'Opportunities Management',
    relationships: 'Relationships & Contacts',
    tasks: 'Tasks & Follow-Ups',
    sources: 'Sources & Investment Bankers',
    carriers: 'Carriers & Reinsurers',
    portfolio: 'Portfolio Companies',
    documents: 'Documents & Diligence Room',
    reports: 'Executive Reports & Analytics',
    settings: 'System & Workflow Settings',
  }

  return (
    <AppShell
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onNewOpportunity={() => setIsNewOpportunityOpen(true)}
      alertCount={3}
      activeNav={activeNav}
      onSelectNav={setActiveNav}
    >
      {activeNav === 'dashboard' ? (
        <Dashboard
          searchQuery={searchQuery}
          isNewOpportunityOpen={isNewOpportunityOpen}
          onCloseNewOpportunity={() => setIsNewOpportunityOpen(false)}
          onOpenNewOpportunity={() => setIsNewOpportunityOpen(true)}
        />
      ) : (
        <PlaceholderView
          moduleName={navDisplayNames[activeNav]}
          onBackToDashboard={() => setActiveNav('dashboard')}
        />
      )}
    </AppShell>
  )
}

export default App
