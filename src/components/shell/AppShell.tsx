import { useEffect, useRef, useState, type ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { MAIN_NAV, SETTINGS_NAV } from "../../data/navigation.ts"
import { useCrm } from "../../context/useCrm.ts"
import { ActionModals } from "../modals/ActionModals.tsx"
import { OpportunityDrawer } from "../dashboard/OpportunityDrawer.tsx"
import { Sidebar } from "./Sidebar.tsx"
import { TopHeader } from "./TopHeader.tsx"

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const userSet = useRef(false)
  const location = useLocation()
  const { modal, selectedOpportunity, closeModal, closeOpportunity } = useCrm()

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)")
    const apply = () => {
      if (!userSet.current) setCollapsed(media.matches)
    }
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    const match = [...MAIN_NAV, SETTINGS_NAV].find((item) => item.to === location.pathname)
    document.title = match ? `${match.label} · Newport Specialty Partners` : "Newport Specialty Partners"
  }, [location.pathname])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      if (modal) closeModal()
      else if (selectedOpportunity) closeOpportunity()
      else setMobileOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [modal, selectedOpportunity, closeModal, closeOpportunity])

  useEffect(() => {
    const locked = Boolean(modal || selectedOpportunity || mobileOpen)
    const previous = document.body.style.overflow
    document.body.style.overflow = locked ? "hidden" : previous
    return () => {
      document.body.style.overflow = previous
    }
  }, [modal, selectedOpportunity, mobileOpen])

  return (
    <div className="app-shell" data-sidebar={collapsed ? "collapsed" : "expanded"}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-navy-950/45 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => {
          userSet.current = true
          setCollapsed((value) => !value)
        }}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="app-main">
        <TopHeader onOpenMobileNav={() => setMobileOpen(true)} />
        <main id="main" className="px-4 py-5 sm:px-6 xl:px-8">
          <div className="mx-auto w-full max-w-[1680px]">{children}</div>
          <p className="mx-auto mt-8 max-w-[1680px] pb-2 text-center text-xs text-muted">
            Illustrative demo data for product development. These figures are not Newport Specialty Partners financial
            records.
          </p>
        </main>
      </div>
      <OpportunityDrawer />
      <ActionModals />
    </div>
  )
}
