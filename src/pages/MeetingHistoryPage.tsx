import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Download, ExternalLink, MoreHorizontal, Pencil, Search, Trash2, Upload } from 'lucide-react'
import { useCrmMeetings } from '@/hooks/useCrmMeetings'
import { useData } from '@/data/DataContext'
import { useResource } from '@/hooks/useResource'
import { mockContacts, type ContactRecord } from '@/data/mockModules'
import { MeetingWorkspace } from '@/components/meetings/MeetingWorkspace'
import { Pagination } from '@/components/shared/Pagination'
import { FilterChips, type ActiveFilterChip } from '@/components/shared/FilterChips'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { usePageFor } from '@/hooks/usePageFor'
import { useFitRows } from '@/hooks/useFitRows'
import { paginate } from '@/lib/paginate'
import { inPeriod, resolvePeriod, type PeriodFilter } from '@/lib/reports'
import { readTranscriptSource } from '@/lib/crmMeetings'
import { TRANSCRIPT_ACCEPT } from '@/lib/transcript'
import { meetingTitle, type CrmMeeting } from '@/types/crmMeeting'

/** All saved CRM meetings shared with the approved Newport team, searchable and paginated. */
export function MeetingHistoryPage() {
  const navigate = useNavigate()
  const api = useCrmMeetings()
  const { opportunities } = useData()
  const contactsApi = useResource<ContactRecord>('contacts', mockContacts)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<PeriodFilter>({ kind: 'all' })
  const [oppFilter, setOppFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [uploadFor, setUploadFor] = useState<CrmMeeting | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [page, setPage] = usePageFor(JSON.stringify([search, period, oppFilter]))
  const tableRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pageSize = useFitRows(tableRef, { rowHeight: 53 })

  const projectName = (id: string | null) => opportunities.find((o) => o.id === id)?.projectName ?? '—'
  const contactNames = (m: CrmMeeting) =>
    m.contactIds
      .map((id) => contactsApi.items.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(', ') || '—'

  const resolved = useMemo(() => resolvePeriod(period), [period])
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return api.meetings
      .filter((m) => m.opportunityId)
      .filter((m) => inPeriod(m.start, resolved))
      .filter((m) => !oppFilter || m.opportunityId === oppFilter)
      .filter((m) => {
        if (!q) return true
        return `${meetingTitle(m)} ${m.outlookSubject} ${m.organizer?.name ?? ''} ${m.organizer?.email ?? ''} ${projectName(m.opportunityId)} ${contactNames(m)}`.toLowerCase().includes(q)
      })
      .sort((a, b) => b.start.localeCompare(a.start))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.meetings, resolved, oppFilter, search, opportunities, contactsApi.items])

  const view = paginate(rows, page, pageSize)
  const selected = rows.find((m) => m.id === selectedId) ?? api.meetings.find((m) => m.id === selectedId) ?? null

  const usedProjects = useMemo(() => {
    const ids = new Set(api.meetings.map((m) => m.opportunityId).filter(Boolean) as string[])
    return opportunities.filter((o) => ids.has(o.id)).sort((a, b) => a.projectName.localeCompare(b.projectName, undefined, { numeric: true }))
  }, [api.meetings, opportunities])

  const chips: ActiveFilterChip[] = [
    ...(!resolved.isAllTime ? [{ key: 'period', label: `Date: ${resolved.label}`, onRemove: () => setPeriod({ kind: 'all' }) }] : []),
    ...(oppFilter ? [{ key: 'opp', label: `Project: ${projectName(oppFilter)}`, onRemove: () => setOppFilter('') }] : []),
    ...(search.trim() ? [{ key: 'search', label: `Search: ${search.trim()}`, onRemove: () => setSearch('') }] : []),
  ]

  const downloadTranscript = async (m: CrmMeeting) => {
    const blob = await readTranscriptSource(api.owner, m.id)
    if (!blob || !m.transcript) {
      setNote('The transcript file is not on this device.')
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = m.transcript.fileName
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const input = 'h-9 rounded-lg border border-border bg-surface px-2.5 text-sm'
  const now = new Date()

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-none flex-col overflow-hidden">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-surface px-6 py-5 lg:px-8">
        <div>
          <button type="button" onClick={() => navigate('/meetings')} className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Meetings
          </button>
          <h1 className="font-brand text-2xl font-bold text-navy-900">Meeting History</h1>
          <p className="mt-1 text-sm text-ink-muted">Saved meetings linked to a project. Shared with your approved Newport team.</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search meetings…" className="h-10 w-full rounded-lg border border-border bg-canvas pr-3 pl-9 text-sm outline-none focus:border-accent sm:w-64" />
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-2 border-b border-border bg-canvas px-6 py-3 lg:px-8">
        <label className="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
          Date
          <select
            className={`${input} mt-1 block`}
            value={period.kind}
            onChange={(e) => {
              const kind = e.target.value as PeriodFilter['kind']
              if (kind === 'month') setPeriod({ kind, month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` })
              else if (kind === 'year') setPeriod({ kind, year: String(now.getFullYear()) })
              else if (kind === 'range') setPeriod({ kind, from: '', to: '' })
              else setPeriod({ kind: 'all' })
            }}
          >
            <option value="all">All dates</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
            <option value="range">Date range</option>
          </select>
        </label>
        {period.kind === 'month' && <input type="month" aria-label="Month" className={input} value={period.month ?? ''} onChange={(e) => setPeriod({ ...period, month: e.target.value })} />}
        {period.kind === 'year' && <input type="number" aria-label="Year" className={`${input} w-24`} value={period.year ?? ''} onChange={(e) => setPeriod({ ...period, year: e.target.value })} />}
        {period.kind === 'range' && (
          <>
            <input type="date" aria-label="From" className={input} value={period.from ?? ''} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
            <input type="date" aria-label="To" className={input} value={period.to ?? ''} onChange={(e) => setPeriod({ ...period, to: e.target.value })} />
          </>
        )}
        <label className="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
          Opportunity
          <select className={`${input} mt-1 block`} value={oppFilter} onChange={(e) => setOppFilter(e.target.value)}>
            <option value="">All projects</option>
            {usedProjects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.projectName}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto self-center">
          <FilterChips chips={chips} onClearAll={() => { setPeriod({ kind: 'all' }); setOppFilter(''); setSearch('') }} />
        </div>
      </div>
      {note && <p className="border-b border-border bg-accent-soft/50 px-6 py-2 text-sm text-navy-800 lg:px-8" role="status">{note}</p>}

      <div className={selected ? 'grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_460px] lg:grid-rows-[minmax(0,1fr)]' : 'flex min-h-0 flex-1 flex-col'}>
        <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${selected ? 'border-r border-border' : ''}`}>
          <div ref={tableRef} className="custom-scroll min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[900px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[4%]" />
                <col className="w-[11%]" />
                <col className="w-[20%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[15%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[4%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-canvas text-[11px] tracking-[0.06em] text-ink-subtle uppercase">
                <tr className="border-b border-border">
                  <th className="px-3 py-3 font-semibold">#</th>
                  <th className="px-3 py-3 font-semibold">Date</th>
                  <th className="px-3 py-3 font-semibold">Meeting Title</th>
                  <th className="px-3 py-3 font-semibold">Organizer</th>
                  <th className="px-3 py-3 font-semibold">Opportunity</th>
                  <th className="px-3 py-3 font-semibold">Contact(s)</th>
                  <th className="px-3 py-3 font-semibold">Transcript</th>
                  <th className="px-3 py-3 font-semibold">Recording</th>
                  <th className="px-2 py-3 font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((m, index) => (
                  <tr
                    key={m.id}
                    tabIndex={0}
                    aria-selected={selectedId === m.id}
                    onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setSelectedId(m.id)
                    }}
                    className={`cursor-pointer border-b border-border/70 ${selectedId === m.id ? 'bg-accent-soft/60' : 'hover:bg-accent-soft/30'}`}
                  >
                    <td className="px-3 py-3.5 text-xs text-ink-subtle">{view.start + index}</td>
                    <td className="px-3 py-3.5 text-ink-muted">{new Date(m.start).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td className="truncate px-3 py-3.5 font-semibold text-navy-900">{meetingTitle(m)}</td>
                    <td className="truncate px-3 py-3.5 text-ink-muted">{m.organizer?.name || m.organizer?.email || '—'}</td>
                    <td className="truncate px-3 py-3.5 text-ink-muted">{projectName(m.opportunityId)}</td>
                    <td className="truncate px-3 py-3.5 text-ink-muted">{contactNames(m)}</td>
                    <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                      {m.transcript ? (
                        <button type="button" onClick={() => void downloadTranscript(m)} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                          <Download className="h-3.5 w-3.5" /> {m.transcript.format.toUpperCase()}
                        </button>
                      ) : (
                        <button type="button" onClick={() => { setUploadFor(m); fileRef.current?.click() }} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink">
                          <Upload className="h-3.5 w-3.5" /> Upload Transcript
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                      {m.recordingUrl ? (
                        <a href={m.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" /> Open
                        </a>
                      ) : (
                        <button type="button" onClick={() => setSelectedId(m.id)} className="text-xs font-semibold text-ink-muted hover:text-ink">
                          Add Recording Link
                        </button>
                      )}
                    </td>
                    <td className="relative px-2 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <button type="button" aria-label="Meeting actions" aria-expanded={menuId === m.id} onClick={() => setMenuId(menuId === m.id ? null : m.id)} className="rounded p-1 text-ink-muted hover:bg-canvas">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuId === m.id && (
                        <div className="absolute right-2 z-20 mt-1 w-52 rounded-lg border border-border bg-surface py-1 text-sm shadow-(--shadow-elevated)" role="menu">
                          <button type="button" role="menuitem" onClick={() => { setSelectedId(m.id); setMenuId(null) }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-canvas">
                            <Pencil className="h-4 w-4" /> Edit Details
                          </button>
                          <button type="button" role="menuitem" disabled={!m.joinUrl} onClick={() => { void navigator.clipboard?.writeText(m.joinUrl); setMenuId(null); setNote('Meeting link copied.') }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-canvas disabled:opacity-50">
                            <Copy className="h-4 w-4" /> Copy Meeting Link
                          </button>
                          <button type="button" role="menuitem" onClick={() => { setRemoveId(m.id); setMenuId(null) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[var(--color-danger)] hover:bg-canvas">
                            <Trash2 className="h-4 w-4" /> Remove from CRM History
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="px-6 py-8 text-sm text-ink-muted">{api.meetings.some((m) => m.opportunityId) ? 'No meetings match these filters.' : 'No meetings saved yet. Save a meeting from the Meetings page.'}</p>}
          </div>
          <Pagination {...view} onPage={setPage} noun={rows.length === 1 ? 'meeting' : 'meetings'} testId="meeting-history-pagination" />
        </div>
        {selected && (
          <aside className="min-h-0 overflow-hidden bg-surface">
            <MeetingWorkspace key={selected.id} api={api} meeting={selected} variant="history" onRemoved={() => setSelectedId(null)} />
          </aside>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={TRANSCRIPT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file || !uploadFor) return
          const target = uploadFor
          setUploadFor(null)
          setNote(`Reading ${file.name}…`)
          void api
            .uploadTranscript(target, file)
            .then((done) => setNote(done.summary.status === 'ready' ? 'Transcript saved and summarized.' : `Transcript saved. ${done.summary.error ?? ''}`))
            .catch((err) => setNote(err instanceof Error ? err.message : 'The transcript could not be read.'))
        }}
      />
      <ConfirmDialog
        open={removeId != null}
        title="Remove from CRM History?"
        message="This removes the CRM record, its transcript and summary from this device. The Outlook event is not changed or deleted."
        confirmLabel="Remove"
        onCancel={() => setRemoveId(null)}
        onConfirm={() => {
          const id = removeId
          setRemoveId(null)
          if (id) void api.remove(id).then(() => selectedId === id && setSelectedId(null))
        }}
      />
    </div>
  )
}
