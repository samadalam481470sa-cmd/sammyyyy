import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const COLLAPSE_BREAKPOINT_PX = 1180;

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < COLLAPSE_BREAKPOINT_PX,
  );
  const [userToggled, setUserToggled] = useState(false);

  useEffect(() => {
    if (userToggled) return;
    const handleResize = () => setCollapsed(window.innerWidth < COLLAPSE_BREAKPOINT_PX);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [userToggled]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => {
          setUserToggled(true);
          setCollapsed((c) => !c);
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
