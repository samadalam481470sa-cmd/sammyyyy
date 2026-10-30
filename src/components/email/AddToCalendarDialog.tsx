import { useEffect, useState } from 'react'
import { CalendarPlus, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { calendarOwnerKey } from '@/lib/meetingCalendar'
import { outlookToken } from '@/lib/outlookGraph'
import { createCalendarEvent } from '@/lib/graphCalendar'
import { addConfirmedEvent } from '@/lib/calendarStore'
import type { MailMeetingDraft } from '@/lib/mailMeeting'

interface AddToCalendarDialogProps {
  draft: MailMeetingDraft
  /** Outlook is connected for this user, so the Outlook copy can be offered as checked. */
  outlookConnected: boolean
  onClose: () => void
  onSaved: (message: string) => void
}

const field =
  'h-9 w-full rounded-md border border-[#e0e0e0] px-3 text-sm outline-none focus:border-[#0f6cbd] focus:ring-1 focus:ring-[#0f6cbd]'

/**
 * Review a meeting found in an email, then add it to the signed-in user's Outlook calendar.
 * Email Calendar and Meetings both read that calendar. If Outlook refuses or is not connected,
 * nothing is added anywhere and the reason is shown.
 */
export function AddToCalendarDialog({ draft, outlookConnected, onClose, onSaved }: AddToCalendarDialogProps) {
  const { user } = useAuth()
  const [title, setTitle] = useState(draft.title)
  const [date, setDate] = useState(draft.date)
  const [time, setTime] = useState(draft.time)
  const [notes, setNotes] = useState(draft.notes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const save = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Pick a date for this meeting.')
      return
    }
    setSaving(true)
    setError(null)
    const cleanTitle = title.trim() || 'Meeting'
    try {
      const token = await outlookToken(false, user?.email ?? '').catch(() => null)
      if (!token) throw new Error('Outlook is not connected. Choose Connect Outlook first. Nothing was added.')
      const [h, m] = (time || '09:00').split(':').map(Number)
      const endTime = `${String(Math.min(23, h + (m + 30 >= 60 ? 1 : 0))).padStart(2, '0')}:${String((m + 30) % 60).padStart(2, '0')}`
      const created = await createCalendarEvent(token, {
        subject: cleanTitle,
        date,
        startTime: time || '09:00',
        endTime,
        allDay: !time,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago',
        location: '',
        attendees: [],
        teams: false,
        description: notes,
      })
      addConfirmedEvent(calendarOwnerKey(user), created)
      setSaving(false)
      onSaved('Added to your Outlook calendar. It also shows in Email > Calendar and Meetings.')
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : 'Outlook did not add the event. Nothing was added.')
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" data-testid="add-to-calendar-dialog">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-navy-950/40 backdrop-blur-[2px]"
        onClick={() => !saving && onClose()}
      />
      <div role="dialog" aria-modal="true" aria-labelledby="add-to-calendar-title" className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 id="add-to-calendar-title" className="flex items-center gap-2 text-base font-semibold text-[#242424]">
            <CalendarPlus className="h-5 w-5 text-[#0f6cbd]" />
            Add to calendar
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} disabled={saving} className="rounded p-1 text-[#616161] hover:bg-[#f0f0f0]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-[#616161]">
          {draft.found ? 'Date found in this email. Check it, then save.' : 'No date was found in this email. Pick one, then save.'}
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-[#424242]">
            Title
            <input data-testid="calendar-title" className={`${field} mt-1 font-normal`} value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-[#424242]">
              Date
              <input data-testid="calendar-date" type="date" className={`${field} mt-1 font-normal`} value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-[#424242]">
              Time (optional)
              <input data-testid="calendar-time" type="time" className={`${field} mt-1 font-normal`} value={time} onChange={(event) => setTime(event.target.value)} />
            </label>
          </div>
          <label className="block text-xs font-semibold text-[#424242]">
            Notes
            <textarea className={`${field} mt-1 h-24 py-2 font-normal`} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          {!outlookConnected && (
            <p className="text-xs text-[#7a5b00]">Outlook is not connected. Connect Outlook first; this adds the event to your Outlook calendar.</p>
          )}
          {error && <p className="text-sm text-[#c50f1f]">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="h-9 rounded-md px-3 text-sm text-[#616161] hover:bg-[#f5f5f5]">
            Cancel
          </button>
          <button
            type="button"
            data-testid="calendar-save"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#0f6cbd] px-4 text-sm font-semibold text-white hover:bg-[#115ea3] disabled:opacity-60"
          >
            <CalendarPlus className="h-4 w-4" />
            {saving ? 'Adding to Outlook…' : 'Add to Outlook calendar'}
          </button>
        </div>
      </div>
    </div>
  )
}
