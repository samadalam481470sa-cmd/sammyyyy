import React, { useState } from 'react'
import { Sidebar, NavItemKey } from './Sidebar'
import { TopHeader } from './TopHeader'

interface AppShellProps {
  children: React.ReactNode
  searchQuery: string
  onSearchChange: (query: string) => void
  onNewOpportunity: () => void
  alertCount?: number
  onToggleAlerts?: () => void
  activeNav: NavItemKey
  onSelectNav: (key: NavItemKey) => void
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  searchQuery,
  onSearchChange,
  onNewOpportunity,
  alertCount,
  onToggleAlerts,
  activeNav,
  onSelectNav,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Sidebar navigation */}
      <Sidebar
        activeItem={activeNav}
        onSelectNav={onSelectNav}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        {/* Top Header */}
        <TopHeader
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onNewOpportunity={onNewOpportunity}
          alertCount={alertCount}
          onToggleAlerts={onToggleAlerts}
        />

        {/* Page Content Container */}
        <main className="flex-1 p-6 md:p-8 max-w-[1920px] w-full mx-auto">
          {children}
        </main>

        {/* Subtle executive footer */}
        <footer className="px-8 py-4 border-t border-slate-200/80 bg-white/50 text-[11px] text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div>
            <span className="font-semibold text-slate-600">Newport Specialty Partners</span> — Confidential M&A / Acquisition Deal Management System
          </div>
          <div className="flex items-center space-x-4 text-slate-400">
            <span>Sprint 1 • Dashboard Release</span>
            <span>•</span>
            <span className="font-mono text-[10px]">v1.0.0-PE</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
