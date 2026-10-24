import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { EditorGuardProvider } from '@/components/shared/EditorGuardContext'
import { SpreadsheetColumnProvider, useSpreadsheetColumns } from '@/components/dashboard/SpreadsheetColumnContext'
import { useAuth } from '@/auth/AuthContext'
import { sidebarOffset } from '@/lib/dashboardSpreadsheets'
import { calendarOwnerKey, loadCalendarEvents } from '@/lib/meetingCalendar'
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
  const [collapsed, setCollapsed] = useState(false)
  const [motionReady, setMotionReady] = useState(false)
  const { user } = useAuth()
  const { sheets } = useSpreadsheetColumns()
  const onDashboard = useLocation().pathname === '/'
  const offset = sidebarOffset(collapsed, sheets.length, onDashboard)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMotionReady(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (!user) return
    pushCalendarReminders(user, loadCalendarEvents(calendarOwnerKey(user)))
  }, [user])

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
    </div>
  )
}
