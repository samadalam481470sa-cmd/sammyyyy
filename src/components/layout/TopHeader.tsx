import { Bell, Plus, Search } from 'lucide-react'
import type { CurrentUser } from '../../types'

interface TopHeaderProps {
  title: string
  subtitle?: string
  user: CurrentUser
  searchValue: string
  onSearchChange: (value: string) => void
  onNewOpportunity: () => void
}

export function TopHeader({
  title,
  subtitle,
  user,
  searchValue,
  onSearchChange,
  onNewOpportunity,
}: TopHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4 lg:px-8">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-navy-900">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-[13px] text-slate-500">{subtitle}</p>}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <label className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search projects, companies, contacts..."
              className="h-9 w-72 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-navy-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-100 xl:w-80"
            />
          </label>

          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-navy-800"
            title="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent-500" />
          </button>

          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-800 text-xs font-semibold text-white"
            title={`${user.firstName} ${user.lastName}`}
          >
            {user.initials}
          </div>

          <button
            type="button"
            onClick={onNewOpportunity}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-navy-900 px-3.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-navy-800"
          >
            <Plus className="h-4 w-4" />
            New Opportunity
          </button>
        </div>
      </div>

      {/* Mobile search */}
      <div className="border-t border-slate-100 px-6 py-2 md:hidden">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search projects, companies, contacts..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] placeholder:text-slate-400 focus:border-navy-400 focus:bg-white focus:outline-none"
          />
        </label>
      </div>
    </header>
  )
}
