import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, ExternalLink, Link2, MoreHorizontal, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useCrmMeetings } from '@/hooks/useCrmMeetings'
import { useData } from '@/data/DataContext'
import { useResource } from '@/hooks/useResource'
import { mockContacts, type ContactRecord } from '@/data/mockModules'
import { MeetingDrawer } from '@/components/meetings/MeetingDrawer'
import { AddMeetingDrawer } from '@/components/meetings/AddMeetingDrawer'
import { saveBlob } from '@/components/meetings/MeetingPanels'
import { Pagination } from '@/components/shared/Pagination'
import { FilterChips, type ActiveFilterChip } from '@/components/shared/FilterChips'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { PeriodFilterControl } from '@/components/shared/PeriodFilterControl'
import { ContentCard, PageShell, PageToolbar, PrimaryButton, RecordCount, SearchBox } from '@/components/shared/PageChrome'
import { useFitRows } from '@/hooks/useFitRows'
import { useSessionState } from '@/hooks/useSessionState'
import { paginate } from '@/lib/paginate'
import { inPeriod, resolvePeriod, type PeriodFilter } from '@/lib/reports'
import { readTranscriptSource } from '@/lib/crmMeetings'
import { TRANSCRIPT_ACCEPT } from '@/lib/transcript'
import { meetingTitle, type CrmMeeting } from '@/types/crmMeeting'

const KEY = 'meeting-history'

/** Your saved acquisition meetings (private to you), newest first. */
export function MeetingHistoryPage() {
  const navigate = useNavigate()
  const api = useCrmMeetings()
  const { opportunities } = useData()
  const contactsApi = useResource<ContactRecord>('contacts', mockContacts)
  const [search, setSearch] = useSessionState(`${KEY}:search`, '')
  const [period, setPeriod] = useSessionState<PeriodFilter>(`${KEY}:period`, { kind: 'all' })
  const [oppFilter, setOppFilter] = useSessionState(`${KEY}:opp`, '')
  const [pageState, setPageState] = useSessionState(`${KEY}:page`, { key: '', page: 1 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [uploadFor, setUploadFor] = useState<CrmMeeting | null>(null)
  const [adding, setAdding] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pageSize = useFitRows(tableRef, { rowHeight: 45, min: 4 })

  const projectName = (id: string | null) => opportunities.find((o) => o.id === id)?.projectName ?? '—'
  const contactName = (id: string | null) => (id ? contactsApi.items.find((c) => c.id === id)?.name : undefined)
  const primaryContact = (m: CrmMeeting) => contactName(m.primaryContactId) ?? contactName(m.contactIds[0] ?? null) ?? '—'

  const resolved = useMemo(() => resolvePeriod(period), [period])
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return api.meetings
      .filter((m) => m.opportunityId && new Date(m.start).getTime() <= Date.now())
      .filter((m) => inPeriod(m.start, resolved))
      .filter((m) => !oppFilter || m.opportunityId === oppFilter)
      .filter((m) => {
        if (!q) return true
        const contacts = m.contactIds.map((id) => contactName(id) ?? '').join(' ')
        return `${meetingTitle(m)} ${m.outlookSubject} ${projectName(m.opportunityId)} ${contacts} ${m.notes}`.toLowerCase().includes(q)
      })
      .sort((a, b) => b.start.localeCompare(a.start))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.meetings, resolved, oppFilter, search, opportunities, contactsApi.items])

  const filterKey = JSON.stringify([search, period, oppFilter])
  const page = pageState.key === filterKey ? pageState.page : 1
  const view = paginate(rows, page, pageSize)
  const selected = api.meetings.find((m) => m.id === selectedId) ?? null

  const projectOptions = useMemo(
    () => [...opportunities].sort((a, b) => (a.projectNumber ?? 0) - (b.projectNumber ?? 0)).map((o) => ({ id: o.id, label: o.projectName })),
    [opportunities],
  )

  const chips: ActiveFilterChip[] = [
    ...(!resolved.isAllTime ? [{ key: 'period', label: `Date: ${resolved.label}`, onRemove: () => setPeriod({ kind: 'all' }) }] : []),
    ...(oppFilter ? [{ key: 'opp', label: `Project: ${projectName(oppFilter)}`, onRemove: () => setOppFilter('') }] : []),
  ]

  const downloadTranscript = async (m: CrmMeeting) => {
    const blob = await readTranscriptSource(api.owner, m.id)
    if (!blob || !m.transcript) return setNote('The transcript file is not stored in this browser.')
    saveBlob(blob, m.transcript.fileName)
  }

  return (
    <PageShell testId="meeting-history-page">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 pt-4 pb-3 lg:px-8">
        <div className="min-w-0">
          <button type="button" onClick={() => navigate('/meetings')} className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink" data-testid="history-back">
            <ArrowLeft className="h-3.5 w-3.5" /> Meetings
          </button>
          <h1 className="font-brand text-2xl leading-tight font-bold text-navy-900">Meeting History</h1>
          <p className="text-sm text-ink-muted">Your saved acquisition meetings, newest first. Private to you.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={search} onChange={setSearch} placeholder="Search meetings" testId="meeting-history-search" />
          <PrimaryButton onClick={() => setAdding(true)} icon={<Plus className="h-4 w-4" />} testId="history-add-meeting">
            Add Meeting
          </PrimaryButton>
        </div>
      </header>

      <PageToolbar
        left={
          <>
            <PeriodFilterControl value={period} onChange={setPeriod} testId="history-period" allLabel="All dates" />
            <div className="w-56">
              <SearchSelect value={oppFilter || null} options={projectOptions} onChange={(v) => setOppFilter(v ?? '')} placeholder="All projects" />
            </div>
          </>
        }
        right={
          <>
            <FilterChips chips={chips} onClearAll={() => { setPeriod({ kind: 'all' }); setOppFilter('') }} />
            <RecordCount count={rows.length} noun={['meeting', 'meetings']} />
          </>
        }
      />
      {note && (
        <p className="mx-6 mb-2 rounded-lg bg-accent-soft/60 px-3 py-1.5 text-sm text-navy-800 lg:mx-8" role="status">
          {note}
        </p>
      )}

      <ContentCard>
        <div ref={tableRef} className="custom-scroll min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[860px] table-fixed text-left text-sm" data-testid="meeting-history-table">
            <colgroup>
              <col className="w-[48px]" />
              <col className="w-[112px]" />
              <col />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[120px]" />
              <col className="w-[130px]" />
              <col className="w-[48px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-surface text-[11px] tracking-[0.06em] text-ink-subtle uppercase shadow-[inset_0_-1px_0_var(--color-border)]">
              <tr>
                <th className="py-3 pl-5 font-semibold">#</th>
                <th className="px-3 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Meeting Title</th>
                <th className="px-3 py-3 font-semibold">Linked Opportunity</th>
                <th className="px-3 py-3 font-semibold">Primary Contact</th>
                <th className="px-3 py-3 font-semibold">Transcript</th>
                <th className="px-3 py-3 font-semibold">Recording</th>
                <th className="px-2 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((m, index) => (
                <tr
                  key={m.id}
                  tabIndex={0}
                  onClick={() => setSelectedId(m.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setSelectedId(m.id)
                  }}
                  className={`cursor-pointer border-b border-border/70 ${selectedId === m.id ? 'bg-accent-soft/60' : 'hover:bg-accent-soft/30'}`}
                >
                  <td className="py-2.5 pl-5 text-xs text-ink-subtle">{view.start + index}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{new Date(m.start).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className="truncate px-3 py-2.5 font-semibold text-navy-900" title={meetingTitle(m)}>{meetingTitle(m)}</td>
                  <td className="truncate px-3 py-2.5 text-ink">{projectName(m.opportunityId)}</td>
                  <td className="truncate px-3 py-2.5 text-ink-muted">{primaryContact(m)}</td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    {m.transcript ? (
                      <button type="button" onClick={() => void downloadTranscript(m)} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline" title={`Download ${m.transcript.fileName}`}>
                        <Download className="h-3.5 w-3.5" /> {m.transcript.format.toUpperCase()}
                      </button>
                    ) : (
                      <span className="text-xs text-ink-subtle">None</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    {m.recordingUrl ? (
                      <a href={m.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" /> Open
                      </a>
                    ) : (
                      <span className="text-xs text-ink-subtle">None</span>
                    )}
                  </td>
                  <td className="relative px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <button type="button" aria-label="Meeting actions" aria-expanded={menuId === m.id} onClick={() => setMenuId(menuId === m.id ? null : m.id)} className="rounded p-1 text-ink-muted hover:bg-canvas" data-testid="meeting-row-menu">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuId === m.id && (
                      <div className="absolute right-2 z-20 mt-1 w-56 rounded-lg border border-border bg-surface py-1 text-sm shadow-(--shadow-elevated)" role="menu">
                        <button type="button" role="menuitem" onClick={() => { setSelectedId(m.id); setMenuId(null) }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-canvas">
                          <Pencil className="h-4 w-4" /> Edit Meeting
                        </button>
                        <button type="button" role="menuitem" onClick={() => { setUploadFor(m); setMenuId(null); fileRef.current?.click() }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-canvas">
                          <Upload className="h-4 w-4" /> {m.transcript ? 'Replace Transcript' : 'Add Transcript'}
                        </button>
                        <button type="button" role="menuitem" onClick={() => { setSelectedId(m.id); setMenuId(null) }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-canvas">
                          <Link2 className="h-4 w-4" /> {m.recordingUrl ? 'Edit Recording Link' : 'Add Recording Link'}
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
          {rows.length === 0 && (
            <p className="px-6 py-8 text-sm text-ink-muted">{api.meetings.some((m) => m.opportunityId) ? 'No meetings match these filters.' : 'No saved meetings yet. Save one from the Meetings page or use Add Meeting.'}</p>
          )}
        </div>
        <Pagination {...view} onPage={(next) => setPageState({ key: filterKey, page: next })} noun={rows.length === 1 ? 'meeting' : 'meetings'} testId="meeting-history-pagination" />
      </ContentCard>

      <MeetingDrawer api={api} meeting={selected} onClose={() => setSelectedId(null)} />
      <AddMeetingDrawer open={adding} onClose={() => setAdding(false)} api={api} onSaved={(m) => setSelectedId(m.id)} />

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
          setNote(`Reading ${file.name} and creating the summary…`)
          void api
            .uploadTranscript(target, file)
            .then((done) => setNote(done.summary.status === 'ready' ? 'Transcript saved and summarized.' : `Transcript saved. ${done.summary.error ?? ''}`))
            .catch((err) => setNote(err instanceof Error ? err.message : 'The transcript could not be read.'))
        }}
      />
      <ConfirmDialog
        open={removeId != null}
        title="Remove from CRM History?"
        message="This removes the CRM meeting record, its transcript and summary from your private history in this browser. The Outlook event and any external recording are not changed or deleted."
        confirmLabel="Remove from History"
        onCancel={() => setRemoveId(null)}
        onConfirm={() => {
          const id = removeId
          setRemoveId(null)
          if (id) void api.remove(id).then(() => selectedId === id && setSelectedId(null))
        }}
      />
    </PageShell>
  )
}
