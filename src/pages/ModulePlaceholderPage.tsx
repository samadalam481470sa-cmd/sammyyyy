import { ArrowLeft, Lock } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { ALL_NAV_ITEMS } from '../config/navigation';

/**
 * Stand-in for CRM modules that arrive in later sprints. The shell, routing
 * and navigation are already in place for them.
 */
export function ModulePlaceholderPage() {
  const { pathname } = useLocation();
  const item = ALL_NAV_ITEMS.find((navItem) => navItem.path === pathname);
  const Icon = item?.icon ?? Lock;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-navy-50 text-navy-700">
        <Icon className="size-5" />
      </span>

      <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        <Lock className="size-3" />
        Planned module
      </span>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-navy-900">
        {item?.label ?? 'Page not found'}
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        {item?.description ??
          'This route is not part of the current sprint. Use the navigation to return to the dashboard.'}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        This sprint delivers the Dashboard; the application shell is ready for the remaining
        modules.
      </p>

      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-navy-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-800"
      >
        <ArrowLeft className="size-4" />
        Back to Dashboard
      </Link>
    </div>
  );
}
