import { useMemo, useRef, useState } from 'react'
import { Mail, Phone, Plus } from 'lucide-react'
import { paginate } from '@/lib/paginate'
import { useFitRows, useGridColumns } from '@/hooks/useFitRows'
import { Pagination } from '@/components/shared/Pagination'
import { useResource } from '@/hooks/useResource'
import { useData } from '@/data/DataContext'
import { mockContacts, type ContactRecord } from '@/data/mockModules'
import type { OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'
import { contactProjectIds, RelationshipEditor, RELATIONSHIP_STATUS_CHIP } from '@/components/relationships/RelationshipEditor'
import { NewRelationshipDrawer } from '@/components/relationships/NewRelationshipDrawer'
import { InitialsAvatar, SideDrawer } from '@/components/shared/Overlay'
import { ContentCard, PageShell, PageTitleBar, PageToolbar, PrimaryButton, RecordCount, SearchBox, SegmentButtons } from '@/components/shared/PageChrome'
import { useRestorableSelection, useSessionState } from '@/hooks/useSessionState'

const KEY = 'relationships'
const SEGMENTS = ['All Relationships', 'Active', 'Inactive', 'Do Not Contact'] as const
type Segment = (typeof SEGMENTS)[number]

export function RelationshipsPage() {
  const api = useResource<ContactRecord>('contacts', mockContacts)
  const { opportunities } = useData()
  const [selectedId, setSelectedId] = useRestorableSelection(KEY)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useSessionState(`${KEY}:search`, '')
  const [status, setStatus] = useSessionState<Segment>(`${KEY}:status`, 'All Relationships')
  const [pageState, setPageState] = useSessionState(`${KEY}:page`, { key: '', page: 1 })
  const editorRef = useRef<OpportunityEditorHandle>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const columns = useGridColumns(gridRef, 3)
  const rowsThatFit = useFitRows(gridRef, { rowHeight: 168, headerHeight: 0, gap: 12, min: 1, max: 8, fallback: 3, rowSelector: '[data-card-row]' })
  const pageSize = Math.max(columns, rowsThatFit * columns)

  const projectNames = (contact: ContactRecord) =>
    contactProjectIds(contact)
      .map((id) => opportunities.find((opp) => opp.id === id))
      .filter((o): o is NonNullable<typeof o> => Boolean(o))
      .sort((a, b) => (a.projectNumber ?? 0) - (b.projectNumber ?? 0))
      .map((o) => o.projectName)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return api.items
      .filter((item) => {
        if (status !== 'All Relationships' && item.status !== status) return false
        if (!q) return true
        return `${item.name} ${item.company} ${item.title} ${item.email} ${item.phone} ${item.category} ${projectNames(item).join(' ')} ${item.projectName}`.toLowerCase().includes(q)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.items, search, status, opportunities])

  const counts = Object.fromEntries(SEGMENTS.map((s) => [s, s === 'All Relationships' ? api.items.length : api.items.filter((c) => c.status === s).length])) as Record<Segment, number>
  const filterKey = JSON.stringify([search, status])
  const page = pageState.key === filterKey ? pageState.page : 1
  const view = paginate(rows, page, pageSize)
  const selected = selectedId ? (api.items.find((item) => item.id === selectedId) ?? null) : null
  const close = () => setSelectedId(null)
  const requestClose = () => (editorRef.current ? editorRef.current.requestLeave(close) : close())

  return (
    <PageShell testId="relationships-page">
      <PageTitleBar title="Relationships" subtitle="People across the book. A contact’s company can differ from the acquisition target.">
        <SearchBox value={search} onChange={setSearch} placeholder="Search relationships" testId="relationship-search" width="w-64" />
        <PrimaryButton onClick={() => setCreating(true)} icon={<Plus className="h-4 w-4" />} testId="new-relationship">
          New Relationship
        </PrimaryButton>
      </PageTitleBar>
      <PageToolbar
        left={<SegmentButtons label="Relationship status" value={status} onChange={setStatus} options={SEGMENTS.map((s) => ({ id: s, label: s, count: counts[s] }))} />}
        right={<RecordCount count={rows.length} noun={['relationship', 'relationships']} />}
      />

      <ContentCard plain>
        <div ref={gridRef} className="custom-scroll grid min-h-0 flex-1 auto-rows-max grid-cols-1 content-start gap-3 overflow-y-auto pb-1 md:grid-cols-2 xl:grid-cols-3" data-testid="relationship-cards">
          {view.rows.map((contact) => {
            const projects = projectNames(contact)
            return (
              <button
                key={contact.id}
                type="button"
                data-card-row
                data-testid={`relationship-card-${contact.id}`}
                onClick={() => setSelectedId(contact.id)}
                className={`flex h-[156px] min-w-0 flex-col rounded-xl border bg-surface p-4 text-left shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-elevated) ${selectedId === contact.id ? 'border-accent ring-2 ring-accent/20' : 'border-border'}`}
              >
                <span className="flex items-start gap-3">
                  <InitialsAvatar name={contact.name} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy-900">{contact.name}</span>
                    <span className="block truncate text-xs text-ink-muted">{[contact.title, contact.company].filter(Boolean).join(' · ') || '—'}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${RELATIONSHIP_STATUS_CHIP[contact.status] ?? RELATIONSHIP_STATUS_CHIP.Inactive}`}>{contact.status}</span>
                </span>
                <span className="mt-2.5 flex min-w-0 items-center gap-1.5 text-xs text-ink">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                  <span className="truncate">{contact.email || '—'}</span>
                </span>
                <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-ink">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                  <span className="truncate">{contact.phone || '—'}</span>
                </span>
                <span className="mt-auto flex min-w-0 flex-wrap gap-1 overflow-hidden pt-2" style={{ maxHeight: 30 }}>
                  {projects.length ? (
                    <>
                      {projects.slice(0, 3).map((name) => (
                        <span key={name} className="rounded-md border border-border bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-navy-900">
                          {name}
                        </span>
                      ))}
                      {projects.length > 3 && <span className="rounded-md px-1 py-0.5 text-[10px] font-semibold text-ink-muted">+{projects.length - 3}</span>}
                    </>
                  ) : (
                    <span className="text-[11px] text-ink-subtle">No linked projects</span>
                  )}
                </span>
              </button>
            )
          })}
          {rows.length === 0 && <p className="col-span-full px-2 py-8 text-sm text-ink-muted">No relationships match.</p>}
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <Pagination {...view} onPage={(next) => setPageState({ key: filterKey, page: next })} noun={rows.length === 1 ? 'relationship' : 'relationships'} testId="relationships-pagination" />
        </div>
      </ContentCard>

      <SideDrawer open={Boolean(selected)} onRequestClose={requestClose} label="Edit relationship" testId="relationship-drawer">
        {selected && <RelationshipEditor ref={editorRef} api={api} contact={selected} onClose={close} onDeleted={close} />}
      </SideDrawer>

      <NewRelationshipDrawer open={creating} api={api} onClose={() => setCreating(false)} onCreated={(created) => setSelectedId(created.id)} />
    </PageShell>
  )
}
