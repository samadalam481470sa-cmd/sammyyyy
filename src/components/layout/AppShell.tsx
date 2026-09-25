import { useState, type ReactNode } from 'react'
import type { PageId } from '../../config/navigation'
import type { CurrentUser } from '../../types'
import { Sidebar } from './Sidebar'
import { TopHeader } from './TopHeader'

interface AppShellProps {
  activePage: PageId
  onNavigate: (page: PageId) => void
  headerTitle: string
  headerSubtitle?: string
  user: CurrentUser
  searchValue: string
  onSearchChange: (value: string) => void
  onNewOpportunity: () => void
  children: ReactNode
}

export function AppShell({
  activePage,
  onNavigate,
  headerTitle,
  headerSubtitle,
  user,
  searchValue,
  onSearchChange,
  onNewOpportunity,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        activePage={activePage}
        collapsed={collapsed}
        onNavigate={onNavigate}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader
          title={headerTitle}
          subtitle={headerSubtitle}
          user={user}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          onNewOpportunity={onNewOpportunity}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
