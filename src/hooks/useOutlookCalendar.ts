import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { calendarOwnerKey } from '@/lib/meetingCalendar'
import { outlookToken, graphTokenError } from '@/lib/outlookGraph'
import { CalendarError, createCalendarEvent, listCalendarRange, type NewCalendarEvent, type OutlookEvent } from '@/lib/graphCalendar'
import { CALENDAR_UPDATED, addConfirmedEvent, eventsInRange, readCalendarCache, replaceCalendarRange } from '@/lib/calendarStore'

export type CalendarStatus = 'idle' | 'loading' | 'ready' | 'not_connected' | 'error'

export interface OutlookCalendarState {
  events: OutlookEvent[]
  status: CalendarStatus
  error: string | null
  errorKind: CalendarError['kind'] | null
  fetchedAt: string | null
  owner: string
  account: string
  refresh: () => Promise<void>
  connect: () => Promise<void>
  create: (input: NewCalendarEvent) => Promise<OutlookEvent>
}

/**
 * Outlook events for [from, to) using the same Microsoft sign-in as Mail.
 * Never invents events: when Graph cannot be reached the state says so, and cached
 * events are shown only as previously confirmed by Graph.
 */
export function useOutlookCalendar(from: Date, to: Date): OutlookCalendarState {
  const { user } = useAuth()
  const owner = calendarOwnerKey(user)
  const account = user?.email ?? ''
  const fromMs = from.getTime()
  const toMs = to.getTime()
  const [cached, setCached] = useState(() => readCalendarCache(owner))
  const [status, setStatus] = useState<CalendarStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<CalendarError['kind'] | null>(null)

  useEffect(() => {
    const sync = () => setCached(readCalendarCache(owner))
    sync()
    window.addEventListener(CALENDAR_UPDATED, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CALENDAR_UPDATED, sync)
      window.removeEventListener('storage', sync)
    }
  }, [owner])

  const refresh = useCallback(async () => {
    setStatus('loading')
    setError(null)
    setErrorKind(null)
    const token = await outlookToken(false, account).catch(() => null)
    if (!token) {
      setStatus('not_connected')
      setError(graphTokenError() ?? 'Outlook is not connected for this sign-in.')
      setErrorKind('not_connected')
      return
    }
    try {
      const fresh = await listCalendarRange(token, new Date(fromMs), new Date(toMs))
      replaceCalendarRange(owner, new Date(fromMs), new Date(toMs), fresh)
      setStatus('ready')
    } catch (err) {
      const e = err instanceof CalendarError ? err : new CalendarError('other', 'The calendar could not be loaded.')
      setStatus('error')
      setError(e.message)
      setErrorKind(e.kind)
    }
  }, [account, owner, fromMs, toMs])

  // Load from Outlook after render; refresh() updates loading state, so it is not run synchronously here.
  useEffect(() => {
    const id = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(id)
  }, [refresh])

  const connect = useCallback(async () => {
    // Full-page Microsoft sign-in, the same flow as Connect Outlook in Mail.
    await outlookToken(true, account).catch(() => null)
  }, [account])

  const create = useCallback(
    async (input: NewCalendarEvent) => {
      const token = await outlookToken(false, account).catch(() => null)
      if (!token) throw new CalendarError('not_connected', 'Connect Outlook first. The event was not created.')
      const created = await createCalendarEvent(token, input)
      addConfirmedEvent(owner, created)
      return created
    },
    [account, owner],
  )

  return {
    events: eventsInRange(cached.events, new Date(fromMs), new Date(toMs)),
    status,
    error,
    errorKind,
    fetchedAt: cached.fetchedAt,
    owner,
    account,
    refresh,
    connect,
    create,
  }
}
