import { NavLink } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight, Shield } from 'lucide-react';
import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS, type NavItem } from '../../data/navigation';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

function NavRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        [
          'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          collapsed ? 'justify-center px-2' : '',
          isActive
            ? 'bg-white/10 text-white'
            : 'text-slate-300 hover:bg-white/5 hover:text-white',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r bg-accent-400" style={{ width: 3 }} />
          )}
          <Icon size={18} strokeWidth={1.75} className="shrink-0" />
          {!collapsed && (
            <span className="truncate">{item.label}</span>
          )}
          {!collapsed && item.isPlaceholder && (
            <span className="ml-auto rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Soon
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  return (
    <aside
      className={[
        'relative flex h-screen shrink-0 flex-col bg-navy-950 transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-[76px]' : 'w-[260px]',
      ].join(' ')}
    >
      <div className={['flex items-center gap-2.5 px-4 pt-5 pb-4', collapsed ? 'justify-center px-2' : ''].join(' ')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 text-navy-950 shadow-sm">
          <Shield size={18} strokeWidth={2.25} />
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-bold tracking-wide text-white">NEWPORT</p>
            <p className="truncate text-[10.5px] font-medium uppercase tracking-widest text-slate-400">
              Specialty Partners
            </p>
          </div>
        )}
      </div>

      <div className="mx-4 mb-2 h-px bg-white/10" />

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {PRIMARY_NAV_ITEMS.map((item) => (
          <NavRow key={item.id} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="mx-4 mb-2 h-px bg-white/10" />

      <div className="space-y-1 px-3 pb-3">
        {SECONDARY_NAV_ITEMS.map((item) => (
          <NavRow key={item.id} item={item} collapsed={collapsed} />
        ))}
      </div>

      <button
        type="button"
        onClick={onToggleCollapsed}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="mx-3 mb-4 flex items-center justify-center gap-2 rounded-lg border border-white/10 py-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
      >
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        {!collapsed && <span className="text-xs font-medium">Collapse</span>}
      </button>
    </aside>
  );
}
