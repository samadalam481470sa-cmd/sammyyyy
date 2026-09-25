import clsx from 'clsx';
import { Lock, PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { APP_CONFIG } from '../../config/app';
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from '../../config/navigation';
import { Logo } from './Logo';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 cursor-default bg-navy-950/40 lg:hidden"
        />
      ) : null}

      <nav
        aria-label="Primary"
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-navy-900 text-navy-100 shadow-rail transition-[width,transform] duration-200 ease-out',
          collapsed ? 'w-[76px]' : 'w-[264px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div
          className={clsx(
            'flex items-center gap-3 border-b border-white/10 px-4 py-5',
            collapsed && 'justify-center px-0',
          )}
        >
          <Logo />
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold uppercase leading-tight tracking-[0.16em] text-white">
                Newport
              </p>
              <p className="truncate text-[10px] uppercase leading-tight tracking-[0.22em] text-navy-300">
                Specialty Partners
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-slim px-3 py-4">
          {!collapsed ? (
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-400">
              Workspace
            </p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {PRIMARY_NAV.map((item) => (
              <li key={item.id}>
                <SidebarLink item={item} collapsed={collapsed} onNavigate={onCloseMobile} />
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-white/10 px-3 py-3">
          <ul className="flex flex-col gap-0.5">
            {SECONDARY_NAV.map((item) => (
              <li key={item.id}>
                <SidebarLink item={item} collapsed={collapsed} onNavigate={onCloseMobile} />
              </li>
            ))}
          </ul>

          {!collapsed ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2 text-[11px] leading-snug text-navy-300">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-navy-400" />
              {APP_CONFIG.confidentialityNotice}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onToggleCollapse}
            className={clsx(
              'mt-3 hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-navy-300 transition-colors hover:bg-white/5 hover:text-white lg:flex',
              collapsed && 'justify-center px-0',
            )}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <>
                <PanelLeftClose className="size-4" />
                Collapse
              </>
            )}
          </button>
        </div>
      </nav>
    </>
  );
}

interface SidebarLinkProps {
  item: NavItem;
  collapsed: boolean;
  onNavigate: () => void;
}

function SidebarLink({ item, collapsed, onNavigate }: SidebarLinkProps) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        clsx(
          'group relative flex items-center rounded-lg text-sm transition-colors duration-150',
          collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
          isActive
            ? 'bg-white/10 font-medium text-white'
            : 'text-navy-200 hover:bg-white/5 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-accent-400" />
          ) : null}
          <Icon className={clsx('size-[18px] shrink-0', isActive ? 'text-accent-300' : 'text-navy-300')} />
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {!item.available ? (
                <Lock className="size-3 shrink-0 text-navy-400" aria-label="Available in a future sprint" />
              ) : null}
            </>
          ) : null}
        </>
      )}
    </NavLink>
  );
}
