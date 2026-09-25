import { useMemo, useState } from 'react'
import { NAV_ITEMS, SETTINGS_NAV_ITEM, type PageId } from './config/navigation'
import type { EnrichedOpportunity } from './types'
import {
  getCurrentUser,
  getOpportunities,
  getPriorityTasks,
  getRecentActivity,
} from './data/api'
import { DEFAULT_FILTERS, type DashboardFilters } from './lib/filters'
import { greetingForNow } from './lib/format'
import { AppShell } from './components/layout/AppShell'
import { PlaceholderPage } from './components/layout/PlaceholderPage'
import { Dashboard } from './components/dashboard/Dashboard'
import { OpportunityDrawer } from './components/dashboard/OpportunityDrawer'
import { ComingSoonModal } from './components/common/ComingSoonModal'

const ALL_NAV_ITEMS = [...NAV_ITEMS, SETTINGS_NAV_ITEM]

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('dashboard')
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)
  const [selectedOpportunity, setSelectedOpportunity] = useState<EnrichedOpportunity | null>(null)
  const [comingSoonFeature, setComingSoonFeature] = useState<string | null>(null)

  // Data flows through the data-access layer so a real API can replace it later.
  const user = useMemo(() => getCurrentUser(), [])
  const opportunities = useMemo(() => getOpportunities(), [])
  const tasks = useMemo(() => getPriorityTasks(), [])
  const activity = useMemo(() => getRecentActivity(), [])

  const isDashboard = activePage === 'dashboard'
  const activeNavItem = ALL_NAV_ITEMS.find((item) => item.id === activePage)

  return (
    <>
      <AppShell
        activePage={activePage}
        onNavigate={setActivePage}
        headerTitle={
          isDashboard ? `${greetingForNow()}, ${user.firstName}` : activeNavItem?.label ?? ''
        }
        headerSubtitle={
          isDashboard
            ? "Here's what's happening across Newport's acquisition pipeline."
            : undefined
        }
        user={user}
        searchValue={filters.search}
        onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
        onNewOpportunity={() => setComingSoonFeature('New Opportunity')}
      >
        {isDashboard ? (
          <Dashboard
            opportunities={opportunities}
            tasks={tasks}
            activity={activity}
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={() => setFilters(DEFAULT_FILTERS)}
            onSelectOpportunity={setSelectedOpportunity}
            onQuickAction={setComingSoonFeature}
          />
        ) : (
          <PlaceholderPage moduleName={activeNavItem?.label ?? 'Module'} />
        )}
      </AppShell>

      {selectedOpportunity && (
        <OpportunityDrawer
          opportunity={selectedOpportunity}
          onClose={() => setSelectedOpportunity(null)}
        />
      )}

      {comingSoonFeature && (
        <ComingSoonModal
          featureName={comingSoonFeature}
          onClose={() => setComingSoonFeature(null)}
        />
      )}
    </>
  )
}
