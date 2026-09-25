import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NAV_ITEMS, SETTINGS_NAV_ITEM, type NavItem, type PageId } from '../../config/navigation'

interface SidebarProps {
  activePage: PageId
  collapsed: boolean
  onNavigate: (page: PageId) => void
  onToggleCollapsed: () => void
}

export function Sidebar({ activePage, collapsed, onNavigate, onToggleCollapsed }: SidebarProps) {
  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col bg-navy-950 text-slate-300 transition-[width] duration-200 ${
        collapsed ? 'w-[68px]' : 'w-64'
      }`}
    >
      <div className="flex items-center gap-3 px-4 pt-5 pb-6">
        {/* Logo placeholder */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-800 text-sm font-bold text-accent-300 ring-1 ring-navy-700">
          N
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold tracking-wide text-white">NEWPORT</p>
            <p className="truncate text-[10px] font-medium tracking-[0.14em] text-slate-400">
              SPECIALTY PARTNERS
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <SidebarLink
            key={item.id}
            item={item}
            active={activePage === item.id}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-navy-800 px-2.5 py-3">
        <SidebarLink
          item={SETTINGS_NAV_ITEM}
          active={activePage === SETTINGS_NAV_ITEM.id}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-400 transition-colors hover:bg-navy-900 hover:text-white"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" />
          ) : (
            <PanelLeftClose className="h-[18px] w-[18px] shrink-0" />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}

interface SidebarLinkProps {
  item: NavItem
  active: boolean
  collapsed: boolean
  onNavigate: (page: PageId) => void
}

function SidebarLink({ item, active, collapsed, onNavigate }: SidebarLinkProps) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
        active
          ? 'bg-navy-800 text-white shadow-sm ring-1 ring-navy-700'
          : 'text-slate-400 hover:bg-navy-900 hover:text-white'
      }`}
    >
      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-accent-300' : ''}`} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  )
}
