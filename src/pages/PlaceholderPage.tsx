import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from '../data/navigation';

const ALL_NAV_ITEMS = [...PRIMARY_NAV_ITEMS, ...SECONDARY_NAV_ITEMS];

/** Simple placeholder rendered for every module not yet built. */
export default function PlaceholderPage() {
  const { pathname } = useLocation();
  const navItem = ALL_NAV_ITEMS.find((item) => item.path === pathname);
  const Icon = navItem?.icon ?? Construction;

  return (
    <div className="flex h-full min-h-[calc(100vh-2rem)] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-50 text-navy-700">
          <Icon size={26} strokeWidth={1.75} />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-navy-900">{navItem?.label ?? 'Module'}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          This module is part of Newport&apos;s acquisition CRM roadmap and will be built out in a future sprint.
          For now, all deal activity is available on the Dashboard.
        </p>
      </div>
    </div>
  );
}
