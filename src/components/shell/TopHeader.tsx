import { Bell, Menu, Plus, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { CURRENT_USER, DASHBOARD_GREETING, DASHBOARD_SUBTITLE, SEARCH_PLACEHOLDER } from "../../data/constants.ts"
import { MAIN_NAV, SETTINGS_NAV } from "../../data/navigation.ts"
import { useCrm } from "../../context/useCrm.ts"
import { cn } from "../../lib/cn.ts"

export function TopHeader({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { snapshot, filters, setSearch, openModal, openOpportunity } = useCrm()
  const [menu, setMenu] = useState<null | "notifications" | "profile">(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const isDashboard = location.pathname === "/"
  const current = [...MAIN_NAV, SETTINGS_NAV].find((item) => item.to === location.pathname)
  const attention = snapshot.opportunities.filter((opportunity) => opportunity.needsAttention)

  useEffect(() => {
    if (!menu) return
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null)
    }
    document.addEventListener("mousedown", onPointer)
    return () => document.removeEventListener("mousedown", onPointer)
  }, [menu])

  function onSearch(value: string) {
    setSearch(value)
    if (value.trim() && location.pathname !== "/") navigate("/")
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6 xl:px-8">
        <button
          type="button"
          className="rounded-lg p-2 text-navy-800 hover:bg-canvas lg:hidden"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-ink sm:text-[22px]">
            {isDashboard ? DASHBOARD_GREETING : (current?.label ?? "Newport Specialty Partners")}
          </h1>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted">
            {isDashboard ? DASHBOARD_SUBTITLE : current?.description}
          </p>
        </div>

        <div className="order-3 flex w-full items-center gap-2 md:order-none md:w-auto">
          <label className="relative min-w-0 flex-1 md:w-[320px] md:flex-none">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              id="search"
              value={filters.search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={SEARCH_PLACEHOLDER}
              className="field h-10 pr-3 pl-9"
            />
          </label>
        </div>

        <div ref={menuRef} className="ml-auto flex items-center gap-2 md:ml-0">
          <div className="relative">
            <button
              type="button"
              className="relative rounded-lg p-2 text-navy-800 hover:bg-canvas"
              aria-label={`Notifications, ${attention.length} need attention`}
              aria-expanded={menu === "notifications"}
              onClick={() => setMenu((currentMenu) => (currentMenu === "notifications" ? null : "notifications"))}
            >
              <Bell className="size-5" />
              {attention.length > 0 ? (
                <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-navy-800 px-1 text-[10px] font-semibold text-white">
                  {attention.length}
                </span>
              ) : null}
            </button>
            {menu === "notifications" ? (
              <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-line bg-white p-2 shadow-[0_16px_40px_rgb(15_35_55_/_0.12)]">
                <p className="px-2 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
                  Needs attention
                </p>
                {attention.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted">Nothing needs attention right now.</p>
                ) : (
                  attention.map((opportunity) => (
                    <button
                      key={opportunity.id}
                      type="button"
                      className="block w-full rounded-lg px-2 py-2 text-left hover:bg-canvas"
                      onClick={() => {
                        setMenu(null)
                        if (location.pathname !== "/") navigate("/")
                        openOpportunity(opportunity.id)
                      }}
                    >
                      <span className="block text-sm font-semibold text-ink">{opportunity.projectName}</span>
                      <span className="block text-xs text-muted">{opportunity.attentionReason}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => openModal("opportunity")}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy-900 px-3 text-sm font-semibold text-white hover:bg-navy-800"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">New Opportunity</span>
          </button>

          <div className="relative">
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white"
              aria-label={`${CURRENT_USER.name}, ${CURRENT_USER.role}`}
              aria-expanded={menu === "profile"}
              onClick={() => setMenu((currentMenu) => (currentMenu === "profile" ? null : "profile"))}
            >
              {CURRENT_USER.initials}
            </button>
            {menu === "profile" ? (
              <div className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-line bg-white p-3 shadow-[0_16px_40px_rgb(15_35_55_/_0.12)]">
                <p className="text-sm font-semibold text-ink">{CURRENT_USER.name}</p>
                <p className="mt-0.5 text-xs text-muted">{CURRENT_USER.role}</p>
                <p className={cn("mt-3 text-xs leading-5 text-muted")}>Signed in to the Newport acquisition workspace.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
