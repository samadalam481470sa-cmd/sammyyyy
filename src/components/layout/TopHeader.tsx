import { Bell, ChevronDown, Menu, Plus, Search, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CURRENT_USER } from '../../config/app';
import { useDashboard } from '../../hooks/useDashboard';
import { useDashboardFilters } from '../../hooks/useDashboardFilters';
import { useToast } from '../../hooks/useToast';
import { greetingForTime } from '../../lib/greeting';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

const DASHBOARD_PATH = '/';

export function TopHeader({ onOpenNav }: { onOpenNav: () => void }) {
  const { filters, setSearch, setAttentionOnly } = useDashboardFilters();
  const { opportunities } = useDashboard();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const attentionCount = opportunities.filter((opportunity) => opportunity.needsAttention).length;

  function goToDashboard() {
    if (location.pathname !== DASHBOARD_PATH) navigate(DASHBOARD_PATH);
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (value.trim()) goToDashboard();
  }

  function onNotificationsClick() {
    setAttentionOnly(true);
    goToDashboard();
    notify(
      'Filtered to opportunities needing attention',
      attentionCount === 1
        ? '1 opportunity has an open flag.'
        : `${attentionCount} opportunities have open flags.`,
    );
  }

  const searchField = (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        name="global-search"
        value={filters.search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search projects, companies, contacts..."
        aria-label="Search projects, companies, contacts"
        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/80 pl-9 pr-8 text-sm text-navy-900 placeholder:text-slate-400 transition-colors focus:border-accent-400 focus:bg-white focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
      {filters.search ? (
        <button
          type="button"
          onClick={() => setSearch('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-600"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
      <div className="flex items-center gap-4 px-4 py-3 lg:px-8 lg:py-3.5">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-navy-900 lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight text-navy-900 lg:text-xl">
            {greetingForTime()}, {CURRENT_USER.firstName}
          </h1>
          <p className="truncate text-xs text-slate-500 lg:text-[13px]">
            Here&rsquo;s what&rsquo;s happening across Newport&rsquo;s acquisition pipeline.
          </p>
        </div>

        <div className="hidden w-48 md:block lg:w-56 2xl:w-80">{searchField}</div>

        <div className="flex items-center gap-1.5 lg:gap-2">
          <button
            type="button"
            onClick={onNotificationsClick}
            aria-label={`Notifications: ${attentionCount} opportunities need attention`}
            className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-navy-900"
          >
            <Bell className="size-[18px]" />
            {attentionCount > 0 ? (
              <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-semibold text-white ring-2 ring-white">
                {attentionCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() =>
              notify('Profile & preferences', 'User settings arrive with the Settings module.')
            }
            className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-slate-100 lg:pr-2"
          >
            <Avatar name={`${CURRENT_USER.firstName} ${CURRENT_USER.lastName}`} size="md" />
            <span className="hidden text-left leading-tight 2xl:block">
              <span className="block text-[13px] font-medium text-navy-900">
                {CURRENT_USER.firstName} {CURRENT_USER.lastName}
              </span>
              <span className="block text-[11px] text-slate-500">{CURRENT_USER.title}</span>
            </span>
            <ChevronDown className="hidden size-4 text-slate-400 2xl:block" />
          </button>

          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() =>
              notify(
                'New Opportunity',
                'Opportunity intake is wired up with the Opportunities module next sprint.',
              )
            }
            className="ml-1 hidden sm:inline-flex"
          >
            <span className="hidden xl:inline">New Opportunity</span>
            <span className="xl:hidden">New</span>
          </Button>
        </div>
      </div>

      <div className="border-t border-slate-200/70 px-4 py-2 md:hidden">{searchField}</div>
    </header>
  );
}
