import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NAV_ITEMS, SETTINGS_NAV_ITEM, type NavItem, type PageId } from '../../config/navigation'

interface SidebarProps {
  activePage: PageId
  collapsed: boolean
  onNavigate: (page: PageId) => void
  onToggleCollapsed: () => void
}

/** HubSpot-style dark navigation: charcoal rail, orange marker on the active item. */
export function Sidebar({ activePage, collapsed, onNavigate, onToggleCollapsed }: SidebarProps) {
  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col bg-nav text-[#cbd6e2] transition-[width] duration-200 ${
        collapsed ? 'w-[60px]' : 'w-[220px]'
      }`}
    >
      <div className="flex items-center gap-2.5 px-3.5 pt-4 pb-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-hub-500 text-sm font-bold text-white">
          N
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold text-white">Newport</p>
            <p className="truncate text-[10px] font-medium tracking-wide text-[#99acc2]">
              Specialty Partners
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2" aria-label="Primary">
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

      <div className="space-y-0.5 border-t border-white/10 px-2 py-3">
        <SidebarLink
          item={SETTINGS_NAV_ITEM}
          active={activePage === SETTINGS_NAV_ITEM.id}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex w-full items-center gap-3 rounded-[4px] px-3 py-2 text-[13px] font-medium text-[#99acc2] transition-colors hover:bg-white/10 hover:text-white"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" />
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
      className={`flex w-full items-center gap-3 rounded-[4px] border-l-[3px] px-2.5 py-2 text-left text-[13px] font-medium transition-colors ${
        active
          ? 'border-hub-500 bg-nav-deep text-white'
          : 'border-transparent text-[#cbd6e2] hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  )
}
