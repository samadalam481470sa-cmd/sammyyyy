import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { NavLink } from "react-router-dom"
import { COMPANY_NAME, PRODUCT_LINE } from "../../data/constants.ts"
import { MAIN_NAV, SETTINGS_NAV } from "../../data/navigation.ts"
import { cn } from "../../lib/cn.ts"
import { NewportMark } from "./Logo.tsx"

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
}: {
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapse: () => void
  onCloseMobile: () => void
}) {
  const showLabels = mobileOpen || !collapsed

  return (
    <aside
      className={cn(
        "app-sidebar fixed inset-y-0 left-0 z-50 flex flex-col bg-navy-900 text-white",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
      aria-label="Primary"
    >
      <div className={cn("flex items-center gap-3 px-4 pt-5 pb-4", showLabels ? "" : "justify-center px-3")}>
        <NewportMark className="size-9 shrink-0" />
        {showLabels ? (
          <div className="min-w-0">
            <p className="font-serif text-[15px] leading-none font-semibold tracking-[0.16em] text-white">NEWPORT</p>
            <p className="mt-1 text-[10px] leading-none font-semibold tracking-[0.14em] text-accent-300">
              SPECIALTY PARTNERS
            </p>
            <p className="mt-1.5 text-[11px] leading-snug text-white/55">{PRODUCT_LINE}</p>
          </div>
        ) : (
          <span className="sr-only">{COMPANY_NAME}</span>
        )}
      </div>

      <nav className="scroll-thin flex-1 space-y-0.5 overflow-y-auto px-3">
        {MAIN_NAV.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end
              title={showLabels ? undefined : item.label}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                  showLabels ? "" : "justify-center px-0",
                  isActive
                    ? "bg-white/10 text-white shadow-[inset_2px_0_0_#9fc0d8]"
                    : "text-white/75 hover:bg-white/10 hover:text-white",
                )
              }
            >
              <Icon className="size-[18px] shrink-0" aria-hidden="true" />
              <span className={showLabels ? "truncate" : "sr-only"}>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="mt-auto px-3 pt-3 pb-4">
        {showLabels ? (
          <p className="px-3 pb-3 text-[10px] font-semibold tracking-[0.16em] text-white/40 uppercase">Confidential</p>
        ) : null}
        <NavLink
          to={SETTINGS_NAV.to}
          end
          title={showLabels ? undefined : SETTINGS_NAV.label}
          onClick={onCloseMobile}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
              showLabels ? "" : "justify-center px-0",
              isActive ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
            )
          }
        >
          <SETTINGS_NAV.icon className="size-[18px] shrink-0" aria-hidden="true" />
          <span className={showLabels ? "" : "sr-only"}>{SETTINGS_NAV.label}</span>
        </NavLink>
        <button
          type="button"
          onClick={onToggleCollapse}
          className={cn(
            "mt-1 hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white lg:flex",
            showLabels ? "" : "justify-center px-0",
          )}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          <span className={showLabels ? "" : "sr-only"}>{collapsed ? "Expand" : "Collapse"}</span>
        </button>
      </div>
    </aside>
  )
}
