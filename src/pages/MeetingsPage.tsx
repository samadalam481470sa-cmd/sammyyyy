import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  CalendarDays,
  ExternalLink,
  Phone,
  Plus,
  Save,
  Video,
} from 'lucide-react'
import { NotificationsPanel } from '@/components/layout/NotificationsPanel'
import { loadKeyCalendarNotifications } from '@/lib/calendarReminders'
import { useAuth } from '@/auth/AuthContext'
import { useData } from '@/data/DataContext'
import { mockMeetings } from '@/data/mockMeetings'
import { mockContacts, type ContactRecord } from '@/data/mockModules'
import { useResource } from '@/hooks/useResource'
import { SoftPhone } from '@/components/meetings/SoftPhone'
import { CallStage } from '@/components/meetings/CallStage'
import { TranscriptPanel } from '@/components/meetings/TranscriptPanel'
import { MeetingCalendar } from '@/components/meetings/MeetingCalendar'
import { buildJoinUrl, channelLabel, formatDuration, normalizePhoneDisplay } from '@/lib/meetingLinks'
import { LiveTranscriber, speechSupported, summarizeTranscript } from '@/lib/speechTranscription'
import type {
  CustomerCapture,
  MeetingChannel,
  MeetingRecord,
  TranscriptLine,
} from '@/types/meetings'

const PLATFORMS: { id: MeetingChannel; label: string; hint: string }[] = [
  { id: 'teams', label: 'Teams', hint: 'Microsoft Teams meeting' },
  { id: 'zoom', label: 'Zoom', hint: 'Zoom meeting ID or URL' },
  { id: 'skype', label: 'Skype', hint: 'Skype ID or join link' },
  { id: 'meet', label: 'Meet', hint: 'Google Meet code' },
  { id: 'webex', label: 'Webex', hint: 'Webex personal room' },
  { id: 'facecall', label: 'Face call', hint: 'In-CRM camera room + captions' },
]

const emptyCustomer = (): CustomerCapture => ({
  name: '',
  company: '',
  title: '',
  email: '',
  phone: '',
  projectName: '',
  notes: '',
})

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function MeetingsPage() {
  const { user } = useAuth()
  const { opportunities } = useData()
  const meetingsApi = useResource<MeetingRecord>('meetings', mockMeetings)
  const contactsApi = useResource<ContactRecord>('contacts', mockContacts)

  const [channel, setChannel] = useState<MeetingChannel>('facecall')
  const [title, setTitle] = useState('Newport customer meeting')
  const [joinId, setJoinId] = useState('')
  const [dialNumber, setDialNumber] = useState('')
  const [customer, setCustomer] = useState<CustomerCapture>(emptyCustomer)
  const [projectName, setProjectName] = useState('')
  const [opportunityId, setOpportunityId] = useState<string>('')

  const [live, setLive] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [camOn, setCamOn] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const [interim, setInterim] = useState('')
  const [transcriptStatus, setTranscriptStatus] = useState(
    speechSupported() ? 'Ready for live captions' : 'Use Chrome/Edge for live captions',
  )
  const [summary, setSummary] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const reminderDot = loadKeyCalendarNotifications(user).some((n) => !n.read)

  const startedAtRef = useRef<string | null>(null)
  const transcriberRef = useRef<LiveTranscriber | null>(null)
  const timerRef = useRef<number | null>(null)

  const hostName = user?.name || 'Newport user'

  const sortedMeetings = useMemo(
    () =>
      [...meetingsApi.items].sort((a, b) => {
        const aT = a.startedAt || a.createdAt || ''
        const bT = b.startedAt || b.createdAt || ''
        return bT.localeCompare(aT)
      }),
    [meetingsApi.items],
  )

  const selected = sortedMeetings.find((m) => m.id === selectedId) ?? null

  const stopMedia = useCallback(() => {
    setStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop())
      return null
    })
  }, [])

  const stopTranscription = useCallback(() => {
    transcriberRef.current?.stop()
    transcriberRef.current = null
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearTimer()
      stopTranscription()
      stopMedia()
    }
  }, [clearTimer, stopMedia, stopTranscription])

  const fullTranscript = useMemo(
    () => lines.map((l) => `${l.speaker}: ${l.text}`).join('\n'),
    [lines],
  )

  const startTranscription = useCallback(() => {
    stopTranscription()
    const t = new LiveTranscriber({
      speaker: hostName.split(' ')[0] || 'You',
      onStatus: setTranscriptStatus,
      onLine: ({ text, isFinal, speaker }) => {
        if (!isFinal) {
          setInterim(text)
          return
        }
        setInterim('')
        setLines((prev) => [
          ...prev,
          {
            id: newId('line'),
            speaker,
            text,
            at: new Date().toISOString(),
          },
        ])
      },
    })
    transcriberRef.current = t
    t.start()
  }, [hostName, stopTranscription])

  const beginSession = useCallback(
    async (opts: {
      channel: MeetingChannel
      title: string
      dialedNumber?: string
      joinUrl?: string
      withCamera?: boolean
    }) => {
      setError(null)
      setMessage(null)
      setLines([])
      setInterim('')
      setSummary('')
      setElapsed(0)
      startedAtRef.current = new Date().toISOString()

      let media: MediaStream | null = null
      if (opts.withCamera) {
        try {
          media = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          })
          setStream(media)
          setCamOn(true)
          setMicOn(true)
        } catch {
          try {
            media = await navigator.mediaDevices.getUserMedia({ audio: true })
            setStream(media)
            setCamOn(false)
            setMicOn(true)
            setMessage('Camera unavailable — continuing with microphone for captions.')
          } catch {
            setMessage('Microphone permission denied — you can still type notes and save to CRM.')
            setCamOn(false)
            setMicOn(false)
          }
        }
      } else {
        // Phone / landline — still request mic for live transcription of the handset conversation
        try {
          media = await navigator.mediaDevices.getUserMedia({ audio: true })
          setStream(media)
          setCamOn(false)
          setMicOn(true)
        } catch {
          setMessage('Allow microphone access to transcribe the phone conversation into the CRM.')
        }
      }

      const draft: Partial<MeetingRecord> = {
        title: opts.title,
        channel: opts.channel,
        status: 'live',
        direction:
          opts.channel === 'phone' || opts.channel === 'landline' ? 'outbound' : 'conference',
        startedAt: startedAtRef.current,
        endedAt: null,
        durationSeconds: 0,
        hostName,
        participantName: customer.name,
        participantCompany: customer.company,
        participantEmail: customer.email,
        participantPhone: customer.phone || opts.dialedNumber || '',
        joinUrl: opts.joinUrl || '',
        dialedNumber: opts.dialedNumber || '',
        opportunityId: opportunityId || null,
        projectName: projectName || customer.projectName || '',
        transcript: '',
        transcriptLinesJson: '[]',
        summary: '',
        customerNotes: customer.notes,
        tags: opts.channel,
        recordingEnabled: true,
      }

      try {
        const created = await meetingsApi.create(draft)
        setActiveMeetingId(created.id)
        setSelectedId(created.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not open meeting record')
      }

      setLive(true)
      clearTimer()
      timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000)
      startTranscription()
    },
    [
      clearTimer,
      customer,
      hostName,
      meetingsApi,
      opportunityId,
      projectName,
      startTranscription,
    ],
  )

  const endSession = useCallback(async () => {
    clearTimer()
    stopTranscription()
    stopMedia()
    setLive(false)
    setInterim('')

    const endedAt = new Date().toISOString()
    const summaryText = summarizeTranscript(fullTranscript) || summary
    setSummary(summaryText)

    if (activeMeetingId) {
      try {
        await meetingsApi.save(activeMeetingId, {
          status: 'completed',
          endedAt,
          durationSeconds: elapsed,
          transcript: fullTranscript,
          transcriptLinesJson: JSON.stringify(lines),
          summary: summaryText,
          participantName: customer.name,
          participantCompany: customer.company,
          participantEmail: customer.email,
          participantPhone: customer.phone || dialNumber,
          customerNotes: customer.notes,
          projectName: projectName || customer.projectName,
          opportunityId: opportunityId || null,
        })
        setMessage('Meeting saved to CRM with transcript and customer details.')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save meeting')
      }
    }
    setActiveMeetingId(null)
  }, [
    activeMeetingId,
    clearTimer,
    customer,
    dialNumber,
    elapsed,
    fullTranscript,
    lines,
    meetingsApi,
    opportunityId,
    projectName,
    stopMedia,
    stopTranscription,
    summary,
  ])

  const onSoftCall = async () => {
    setChannel('phone')
    const phone = normalizePhoneDisplay(dialNumber)
    setCustomer((c) => ({ ...c, phone: c.phone || phone }))
    await beginSession({
      channel: 'phone',
      title: title || `Phone call ${phone}`,
      dialedNumber: dialNumber.replace(/\D/g, ''),
      joinUrl: buildJoinUrl('phone', { phone: dialNumber }),
      withCamera: false,
    })
  }

  const onLandline = () => {
    const href = buildJoinUrl('landline', { phone: dialNumber })
    window.open(href, '_self')
    setChannel('landline')
    void beginSession({
      channel: 'landline',
      title: title || `Landline ${normalizePhoneDisplay(dialNumber)}`,
      dialedNumber: dialNumber.replace(/\D/g, ''),
      joinUrl: href,
      withCamera: false,
    })
  }

  const onPlatformJoin = async (platform: MeetingChannel) => {
    setChannel(platform)
    if (platform === 'facecall') {
      await beginSession({
        channel: 'facecall',
        title: title || 'Face call',
        joinUrl: '#facecall',
        withCamera: true,
      })
      return
    }
    const url = buildJoinUrl(platform, { meetingId: joinId, title })
    window.open(url, '_blank', 'noopener,noreferrer')
    await beginSession({
      channel: platform,
      title: title || `${channelLabel(platform)} meeting`,
      joinUrl: url,
      withCamera: false,
    })
    setMessage(`Opened ${channelLabel(platform)}. Captions are running in Newport — keep this tab open.`)
  }

  const saveCustomerToCrm = async () => {
    setError(null)
    if (!customer.name.trim()) {
      setError('Customer name is required to save into Relationships.')
      return
    }
    try {
      await contactsApi.create({
        name: customer.name.trim(),
        title: customer.title || 'Contact',
        company: customer.company || '',
        category: 'Meeting Capture',
        email: customer.email || '',
        phone: customer.phone || normalizePhoneDisplay(dialNumber),
        opportunityId: opportunityId || null,
        projectName: projectName || customer.projectName || '',
        status: 'Active',
        lastContactDate: new Date().toISOString().slice(0, 10),
        notes: [
          customer.notes,
          summary && `Call summary: ${summary}`,
          fullTranscript && `Transcript excerpt: ${fullTranscript.slice(0, 500)}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      })
      if (activeMeetingId) {
        await meetingsApi.save(activeMeetingId, {
          participantName: customer.name,
          participantCompany: customer.company,
          participantEmail: customer.email,
          participantPhone: customer.phone || dialNumber,
          customerNotes: customer.notes,
          summary: summary || summarizeTranscript(fullTranscript),
          transcript: fullTranscript,
          transcriptLinesJson: JSON.stringify(lines),
          projectName: projectName || customer.projectName,
          opportunityId: opportunityId || null,
        })
      }
      setMessage('Customer details + transcript linked into Relationships / Meetings.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save customer')
    }
  }

  const loadMeeting = (m: MeetingRecord) => {
    if (live) return
    setSelectedId(m.id)
    setTitle(m.title)
    setChannel(m.channel)
    setJoinId(m.joinUrl)
    setDialNumber(m.dialedNumber ? normalizePhoneDisplay(m.dialedNumber) : m.participantPhone)
    setCustomer({
      name: m.participantName,
      company: m.participantCompany,
      title: '',
      email: m.participantEmail,
      phone: m.participantPhone,
      projectName: m.projectName,
      notes: m.customerNotes,
    })
    setProjectName(m.projectName)
    setOpportunityId(m.opportunityId || '')
    setSummary(m.summary)
    try {
      const parsed = JSON.parse(m.transcriptLinesJson || '[]') as TranscriptLine[]
      if (Array.isArray(parsed) && parsed.length) setLines(parsed)
      else if (m.transcript) {
        setLines(
          m.transcript.split('\n').filter(Boolean).map((row, i) => {
            const [speaker, ...rest] = row.split(':')
            return {
              id: `hist_${i}`,
              speaker: rest.length ? speaker : 'Speaker',
              text: rest.length ? rest.join(':').trim() : row,
              at: m.startedAt || new Date().toISOString(),
            }
          }),
        )
      } else setLines([])
    } catch {
      setLines([])
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface px-6 py-5 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
              Communications hub
            </p>
            <h1 className="mt-1 font-brand text-2xl font-semibold tracking-tight text-navy-900">
              Meetings
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-ink-muted">
              Connect via Teams, Zoom, Skype, Meet, Webex, face call, mobile, or landline. Live captions
              and dialer details write straight into the CRM — customer cards, project links, and searchable
              transcripts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNotifyOpen(true)}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-ink-muted hover:bg-canvas hover:text-ink"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" strokeWidth={1.75} />
            {reminderDot && (
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-accent" />
            )}
          </button>
        </div>
      </header>
      <NotificationsPanel open={notifyOpen} onClose={() => setNotifyOpen(false)} />

      <div className="mx-auto grid w-full max-w-[1400px] flex-1 gap-4 px-4 py-4 lg:grid-cols-[320px_minmax(0,1fr)_300px] lg:px-6">
        <div className="flex min-h-0 flex-col gap-4">
        <MeetingCalendar />
        {/* History rail */}
        <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-surface shadow-(--shadow-card)">
          <div className="flex items-center justify-between border-b border-border px-3 py-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-navy-900">History</h2>
            </div>
            <button
              type="button"
              disabled={live}
              onClick={() => {
                setSelectedId(null)
                setCustomer(emptyCustomer())
                setLines([])
                setSummary('')
                setTitle('Newport customer meeting')
                setJoinId('')
                setDialNumber('')
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-ink-muted hover:bg-canvas disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>
          <ul className="custom-scroll min-h-0 flex-1 overflow-y-auto p-2">
            {meetingsApi.loading && (
              <li className="px-2 py-4 text-sm text-ink-muted">Loading…</li>
            )}
            {!meetingsApi.loading && sortedMeetings.length === 0 && (
              <li className="px-2 py-4 text-sm text-ink-muted">No meetings yet.</li>
            )}
            {sortedMeetings.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => loadMeeting(m)}
                  className={`mb-1 w-full rounded-lg px-2.5 py-2 text-left transition-colors ${
                    selectedId === m.id ? 'bg-accent-soft' : 'hover:bg-canvas'
                  }`}
                >
                  <p className="truncate text-sm font-semibold text-ink">{m.title}</p>
                  <p className="truncate text-[11px] text-ink-subtle">
                    {channelLabel(m.channel)} · {m.status}
                    {m.durationSeconds ? ` · ${formatDuration(m.durationSeconds)}` : ''}
                  </p>
                  <p className="truncate text-[11px] text-ink-muted">
                    {m.participantName || m.participantPhone || 'No participant yet'}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        </div>

        {/* Main stage */}
        <section className="flex min-w-0 flex-col gap-4">
          {(message || error) && (
            <p
              className={`rounded-lg border px-3 py-2 text-sm ${
                error
                  ? 'border-attention-border bg-attention-bg text-attention'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900'
              }`}
            >
              {error ?? message}
            </p>
          )}

          <div className="rounded-xl border border-border bg-surface p-4 shadow-(--shadow-card)">
            <label className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
              Meeting title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={live}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-canvas px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
            />

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
                  Link opportunity
                </label>
                <select
                  value={opportunityId}
                  onChange={(e) => {
                    setOpportunityId(e.target.value)
                    const opp = opportunities.find((o) => o.id === e.target.value)
                    if (opp) setProjectName(opp.projectName)
                  }}
                  disabled={live}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-canvas px-3 text-sm outline-none focus:border-accent disabled:opacity-60"
                >
                  <option value="">No linked deal</option>
                  {opportunities.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.projectName} — {o.entityName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
                  Project name
                </label>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={live}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-canvas px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
                />
              </div>
            </div>

            <p className="mt-4 text-[11px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">
              Connect a platform
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={live}
                  onClick={() => setChannel(p.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                    channel === p.id
                      ? 'border-navy-800 bg-navy-900 text-white'
                      : 'border-border bg-canvas text-ink hover:bg-accent-soft'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {channel !== 'facecall' && channel !== 'phone' && channel !== 'landline' && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  disabled={live}
                  placeholder={PLATFORMS.find((p) => p.id === channel)?.hint}
                  className="h-10 flex-1 rounded-lg border border-border bg-canvas px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
                />
                <button
                  type="button"
                  disabled={live}
                  onClick={() => void onPlatformJoin(channel)}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
                >
                  <ExternalLink className="h-4 w-4" />
                  Join {channelLabel(channel)}
                </button>
              </div>
            )}

            {channel === 'facecall' && (
              <button
                type="button"
                disabled={live}
                onClick={() => void onPlatformJoin('facecall')}
                className="mt-3 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-40"
              >
                <Video className="h-4 w-4" />
                Start face call + captions
              </button>
            )}
          </div>

          <CallStage
            live={live}
            channel={channel}
            title={title}
            participantName={customer.name}
            elapsed={elapsed}
            camOn={camOn}
            micOn={micOn}
            stream={stream}
            onToggleCam={() => {
              const track = stream?.getVideoTracks()[0]
              if (track) {
                track.enabled = !track.enabled
                setCamOn(track.enabled)
              } else setCamOn((v) => !v)
            }}
            onToggleMic={() => {
              const track = stream?.getAudioTracks()[0]
              if (track) {
                track.enabled = !track.enabled
                setMicOn(track.enabled)
              } else setMicOn((v) => !v)
            }}
            onHangup={() => void endSession()}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <SoftPhone
              number={dialNumber}
              onNumberChange={setDialNumber}
              onCall={() => void onSoftCall()}
              onHangup={() => void endSession()}
              onLandline={onLandline}
              live={live && (channel === 'phone' || channel === 'landline')}
              disabled={live && channel !== 'phone' && channel !== 'landline'}
            />

            <div className="rounded-xl border border-border bg-surface p-4 shadow-(--shadow-card)">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-accent" />
                <h3 className="font-brand text-lg font-semibold text-navy-900">
                  Capture customer details
                </h3>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Auto-fills from dialer when possible. Saves into Relationships with transcript notes.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ['name', 'Full name'],
                    ['company', 'Company'],
                    ['title', 'Title'],
                    ['email', 'Email'],
                    ['phone', 'Phone'],
                    ['projectName', 'Project'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-[11px] font-semibold text-ink-muted">
                    {label}
                    <input
                      value={customer[key]}
                      onChange={(e) => setCustomer((c) => ({ ...c, [key]: e.target.value }))}
                      className="mt-1 h-9 w-full rounded-lg border border-border bg-canvas px-2.5 text-sm font-normal text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                ))}
              </div>
              <label className="mt-2 block text-[11px] font-semibold text-ink-muted">
                Notes
                <textarea
                  value={customer.notes}
                  onChange={(e) => setCustomer((c) => ({ ...c, notes: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border bg-canvas px-2.5 py-2 text-sm font-normal text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>
              <button
                type="button"
                onClick={() => void saveCustomerToCrm()}
                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-navy-900 text-sm font-semibold text-white hover:bg-navy-800"
              >
                <Save className="h-4 w-4" />
                Save customer + transcript to CRM
              </button>
            </div>
          </div>
        </section>

        {/* Transcript */}
        <div className="min-h-[420px] lg:min-h-0">
          <TranscriptPanel
            lines={lines}
            interim={interim}
            live={live}
            status={transcriptStatus}
            summary={summary}
            onSummarize={() => setSummary(summarizeTranscript(fullTranscript))}
            onCopy={() => {
              void navigator.clipboard.writeText(fullTranscript || summary)
              setMessage('Transcript copied.')
            }}
          />
          {selected && !live && (
            <p className="mt-2 px-1 text-[11px] text-ink-subtle">
              Viewing saved session · {channelLabel(selected.channel)} ·{' '}
              {selected.startedAt
                ? new Date(selected.startedAt).toLocaleString()
                : 'unknown time'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
