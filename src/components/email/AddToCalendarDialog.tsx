import { useEffect, useState } from 'react'
import { CalendarPlus, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { syncCalendarToOutlook } from '@/lib/azureMeetings'
import { calendarOwnerKey, loadCalendarEvents, saveCalendarEvents, type CalendarEvent } from '@/lib/meetingCalendar'
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

/** Review a meeting found in an email, then save it to the CRM calendar and, if chosen, Outlook. */
export function AddToCalendarDialog({ draft, outlookConnected, onClose, onSaved }: AddToCalendarDialogProps) {
  const { user } = useAuth()
  const [title, setTitle] = useState(draft.title)
  const [date, setDate] = useState(draft.date)
  const [time, setTime] = useState(draft.time)
  const [notes, setNotes] = useState(draft.notes)
  const [remind, setRemind] = useState(true)
  const [alsoOutlook, setAlsoOutlook] = useState(outlookConnected)
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
    const owner = calendarOwnerKey(user)
    const cleanTitle = title.trim() || 'Meeting'
    const existing = loadCalendarEvents(owner)
    const duplicate = existing.some(
      (event) => event.date === date && event.time === time && event.title.trim().toLowerCase() === cleanTitle.toLowerCase(),
    )
    if (!duplicate) {
      const event: CalendarEvent = { id: `mail-${Date.now()}`, date, time, title: cleanTitle, notes, remind }
      saveCalendarEvents(owner, [...existing, event])
      window.dispatchEvent(new Event('newport-calendar-updated'))
    }
    let message = duplicate ? 'This meeting is already on your calendar.' : 'Added to your Newport calendar.'
    if (alsoOutlook) {
      const result = await syncCalendarToOutlook({ title: cleanTitle, date, time, notes })
      message = result.synced
        ? `${duplicate ? 'Already on your Newport calendar. ' : 'Added to your Newport calendar. '}Also added to your Outlook calendar.`
        : `${message} Outlook calendar was not updated: connect Outlook on this page first.`
    }
    setSaving(false)
    onSaved(message)
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
          <label className="flex items-center gap-2 text-sm text-[#242424]">
            <input type="checkbox" checked={remind} onChange={(event) => setRemind(event.target.checked)} />
            Remind me in Notifications
          </label>
          <label className="flex items-center gap-2 text-sm text-[#242424]">
            <input data-testid="calendar-outlook" type="checkbox" checked={alsoOutlook} onChange={(event) => setAlsoOutlook(event.target.checked)} />
            Also add to my Outlook calendar
          </label>
          {!outlookConnected && alsoOutlook && (
            <p className="text-xs text-[#7a5b00]">Outlook is not connected. Click Connect Outlook first, or the Outlook copy will be skipped.</p>
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
            {saving ? 'Saving…' : 'Save to calendar'}
          </button>
        </div>
      </div>
    </div>
  )
}
