import React from 'react'
import {
  LayoutDashboard,
  Building2,
  Users2,
  CheckSquare,
  Landmark,
  ShieldCheck,
  Briefcase,
  FolderClosed,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield
} from 'lucide-react'

export type NavItemKey =
  | 'dashboard'
  | 'opportunities'
  | 'relationships'
  | 'tasks'
  | 'sources'
  | 'carriers'
  | 'portfolio'
  | 'documents'
  | 'reports'
  | 'settings'

interface SidebarProps {
  activeItem: NavItemKey
  onSelectNav: (key: NavItemKey) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

interface NavItemDef {
  key: NavItemKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  isPrimary?: boolean
}

const PRIMARY_NAV_ITEMS: NavItemDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, isPrimary: true },
  { key: 'opportunities', label: 'Opportunities', icon: Building2, badge: '14' },
  { key: 'relationships', label: 'Relationships', icon: Users2 },
  { key: 'tasks', label: 'Tasks & Follow-Ups', icon: CheckSquare, badge: '5' },
  { key: 'sources', label: 'Sources / Bankers', icon: Landmark },
  { key: 'carriers', label: 'Carriers / Reinsurers', icon: ShieldCheck },
  { key: 'portfolio', label: 'Portfolio Companies', icon: Briefcase },
  { key: 'documents', label: 'Documents', icon: FolderClosed },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
]

export const Sidebar: React.FC<SidebarProps> = ({
  activeItem,
  onSelectNav,
  isCollapsed,
  onToggleCollapse,
}) => {
  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col bg-slate-900 border-r border-slate-800/80 transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/90 bg-slate-950/60">
        {!isCollapsed ? (
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold tracking-wider text-slate-100 uppercase truncate">
                Newport Specialty
              </span>
              <span className="text-[10px] text-blue-400 font-medium tracking-tight truncate">
                Acquisition CRM
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Shield className="w-4 h-4 text-white" />
            </div>
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Main Navigation Items */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <div className="px-2 mb-2">
          {!isCollapsed && (
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
              M&A Platform
            </span>
          )}
        </div>

        {PRIMARY_NAV_ITEMS.map((item) => {
          const isActive = activeItem === item.key
          const Icon = item.icon
          const isEnabled = item.key === 'dashboard'

          return (
            <button
              key={item.key}
              onClick={() => onSelectNav(item.key)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-0' : 'justify-between px-3'
              } py-2.5 rounded-lg text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : isEnabled
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 opacity-80'
              }`}
            >
              <div className="flex items-center space-x-3 truncate">
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </div>

              {!isCollapsed && item.badge && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Footer / Settings */}
      <div className="p-3 border-t border-slate-800/90 bg-slate-950/40">
        <button
          onClick={() => onSelectNav('settings')}
          title={isCollapsed ? 'Settings' : undefined}
          className={`w-full flex items-center ${
            isCollapsed ? 'justify-center px-0' : 'px-3'
          } py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 transition-colors ${
            activeItem === 'settings' ? 'bg-slate-800 text-white' : ''
          }`}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="ml-3 truncate">Settings</span>}
        </button>
      </div>
    </aside>
  )
}
