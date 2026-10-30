import { useEffect, useLayoutEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { EditorGuardProvider } from '@/components/shared/EditorGuardContext'
import { SpreadsheetColumnProvider, useSpreadsheetColumns } from '@/components/dashboard/SpreadsheetColumnContext'
import { useAuth } from '@/auth/AuthContext'
import { installOutlookSync } from '@/lib/outlookSync'
import { NewMailToast } from '@/components/email/NewMailToast'
import { sidebarOffset } from '@/lib/dashboardSpreadsheets'
import { calendarOwnerKey } from '@/lib/meetingCalendar'
import { reminderEventsFromCache } from '@/lib/calendarStore'
import { pushCalendarReminders } from '@/lib/calendarReminders'

export function AppShell() {
  return (
    <EditorGuardProvider>
      <SpreadsheetColumnProvider>
        <AppFrame />
      </SpreadsheetColumnProvider>
    </EditorGuardProvider>
  )
}

function AppFrame() {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches,
  )
  const [motionReady, setMotionReady] = useState(false)
  const { user } = useAuth()
  const { sheets } = useSpreadsheetColumns()
  const location = useLocation()
  const onDashboard = location.pathname === '/'

  // Every route change opens the target page at the top, not at the old scroll position.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
    document.scrollingElement?.scrollTo?.({ top: 0, left: 0 })
  }, [location.pathname, location.search])
  const offset = sidebarOffset(collapsed, sheets.length, onDashboard)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMotionReady(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const onChange = () => {
      if (media.matches) setCollapsed(true)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!user) return
    pushCalendarReminders(user, reminderEventsFromCache(calendarOwnerKey(user)))
  }, [user])

  useEffect(() => {
    if (!user?.email) return
    return installOutlookSync(user.email)
  }, [user?.email])

  return (
    <div className="flex min-h-full bg-canvas">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div
        className={`flex min-h-full min-w-0 flex-1 flex-col ${
          motionReady ? 'transition-[margin] duration-200' : ''
        }`}
        style={{ marginLeft: offset }}
      >
        <Outlet context={{ sidebarCollapsed: collapsed }} />
      </div>
      <NewMailToast />
    </div>
  )
}
