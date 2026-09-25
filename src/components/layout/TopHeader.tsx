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

/**
 * Salesforce Lightning global header: white utility bar with a centered search
 * pill, then a page header underneath. The create button uses HubSpot orange.
 */
export function TopHeader({
  title,
  subtitle,
  user,
  searchValue,
  onSearchChange,
  onNewOpportunity,
}: TopHeaderProps) {
  return (
    <header className="sticky top-0 z-20">
      <div className="flex h-12 items-center gap-3 border-b border-line bg-white px-3">
        <div className="flex shrink-0 items-center gap-2 pl-1">
          <span className="grid grid-cols-3 gap-[3px] p-1.5" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} className="h-[3px] w-[3px] rounded-full bg-brand-700" />
            ))}
          </span>
          <span className="text-sm font-bold text-ink">Newport CRM</span>
        </div>

        <label className="relative mx-auto hidden w-full max-w-xl md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search projects, companies, contacts..."
            className="h-8 w-full rounded-full border border-transparent bg-canvas pl-9 pr-3 text-[13px] text-ink placeholder:text-muted focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="relative flex h-8 w-8 items-center justify-center rounded-full text-brand-700 transition-colors hover:bg-canvas"
            title="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-hub-500 ring-2 ring-white" />
          </button>

          <div
            className="relative flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-[11px] font-semibold text-white"
            title={`${user.firstName} ${user.lastName}`}
          >
            {user.initials}
            <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-[#2e844a] ring-2 ring-white" />
          </div>

          <button
            type="button"
            onClick={onNewOpportunity}
            className="flex h-8 items-center gap-1 rounded-[4px] bg-hub-500 px-3 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-hub-600"
          >
            <Plus className="h-4 w-4" />
            New Opportunity
          </button>
        </div>
      </div>

      <div className="border-b border-line bg-white px-5 py-3.5">
        <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Home</p>
        <h1 className="truncate text-[22px] leading-tight font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-[13px] text-muted">{subtitle}</p>}
      </div>

      <div className="border-b border-line bg-white px-4 py-2 md:hidden">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search projects, companies, contacts..."
            className="h-8 w-full rounded-full border border-line bg-canvas pl-9 pr-3 text-[13px] placeholder:text-muted focus:border-brand-500 focus:bg-white focus:outline-none"
          />
        </label>
      </div>
    </header>
  )
}
