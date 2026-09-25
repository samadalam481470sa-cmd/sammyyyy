import clsx from 'clsx';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ToastViewport } from '../ui/ToastViewport';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div
        className={clsx(
          'flex min-h-screen flex-col transition-[padding] duration-200 ease-out',
          collapsed ? 'lg:pl-[76px]' : 'lg:pl-[264px]',
        )}
      >
        <TopHeader onOpenNav={() => setMobileNavOpen(true)} />
        <main className="relative flex-1">
          <Outlet />
        </main>
      </div>

      <ToastViewport />
    </div>
  );
}
