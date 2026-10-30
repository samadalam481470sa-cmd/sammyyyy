import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { paginate } from '@/lib/paginate'
import { useFitRows } from '@/hooks/useFitRows'
import { Pagination } from '@/components/shared/Pagination'
import { FilterChips, type ActiveFilterChip } from '@/components/shared/FilterChips'
import { Plus, Search } from 'lucide-react'
import { useResource } from '@/hooks/useResource'
import { useData } from '@/data/DataContext'
import { CONTACT_STATUSES, mockContacts, type ContactRecord } from '@/data/mockModules'
import type { OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'
import { contactProjectIds, RelationshipEditor } from '@/components/relationships/RelationshipEditor'
import { NewRelationshipDrawer } from '@/components/relationships/NewRelationshipDrawer'

export function RelationshipsPage() {
  const api = useResource<ContactRecord>('contacts', mockContacts)
  const { opportunities } = useData()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All Relationships')
  const editorRef = useRef<OpportunityEditorHandle>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(1)
  const pageSize = useFitRows(tableRef, { rowHeight: 49 })

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return api.items.filter((item) => {
      if (status !== 'All Relationships' && item.status !== status) return false
      if (!q) return true
      return `${item.name} ${item.company} ${item.title} ${item.category} ${item.projectName}`.toLowerCase().includes(q)
    })
  }, [api.items, search, status])

  useEffect(() => {
    setPage(1)
  }, [search, status])
  const view = paginate(rows, page, pageSize)
  const chips: ActiveFilterChip[] = [
    ...(status !== 'All Relationships' ? [{ key: 'status', label: `Status: ${status}`, onRemove: () => setStatus('All Relationships') }] : []),
    ...(search.trim() ? [{ key: 'search', label: `Search: ${search.trim()}`, onRemove: () => setSearch('') }] : []),
  ]

  const selected = selectedId ? (api.items.find((item) => item.id === selectedId) ?? null) : null

  /** Only prompts when the open form really has unsaved edits. */
  const guarded = (run: () => void) => {
    if (editorRef.current) editorRef.current.requestLeave(run)
    else run()
  }

  const requestSelect = (id: string) => {
    if (selectedId === id) {
      guarded(() => setSelectedId(null))
      return
    }
    guarded(() => setSelectedId(id))
  }

  const startCreate = () => guarded(() => setCreating(true))

  const projectLabel = (contact: ContactRecord) => {
    const ids = contactProjectIds(contact)
    const names = ids.map((id) => opportunities.find((opp) => opp.id === id)?.projectName).filter(Boolean)
    if (!names.length) return contact.projectName || '—'
    return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`
  }

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-none flex-col overflow-hidden">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-surface px-6 py-5 lg:px-8">
        <div>
          <h1 className="font-brand text-2xl font-bold text-navy-900">Relationships</h1>
          <p className="mt-1 text-sm text-ink-muted">People across the book. A contact’s company can differ from the acquisition target.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search relationships" className="h-10 w-56 rounded-lg border border-border bg-canvas pr-3 pl-9 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
          </div>
          <button type="button" data-testid="new-relationship" onClick={startCreate} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-navy-900 px-3.5 text-sm font-semibold text-white hover:bg-navy-800">
            <Plus className="h-4 w-4" /> New Relationship
          </button>
        </div>
      </header>
      <div className="flex flex-wrap gap-2 border-b border-border bg-canvas px-6 py-3 lg:px-8">
        {['All Relationships', ...CONTACT_STATUSES].map((option) => (
          <button key={option} type="button" onClick={() => setStatus(option)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${status === option ? 'border-navy-900 bg-navy-900 text-white' : 'border-border bg-surface text-ink-muted'}`}>
            {option}
          </button>
        ))}
      </div>
      {chips.length > 0 && (
        <div className="border-b border-border bg-canvas px-6 py-2 lg:px-8">
          <FilterChips
            chips={chips}
            onClearAll={() => {
              setStatus('All Relationships')
              setSearch('')
            }}
          />
        </div>
      )}
      <div className={selected ? 'grid min-h-0 w-full flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[minmax(0,1fr)]' : 'flex min-h-0 w-full flex-1 flex-col'}>
        <div className={`flex min-h-0 min-w-0 w-full flex-1 flex-col ${selected ? 'border-r border-border' : ''}`}>
        <div ref={tableRef} className="custom-scroll min-h-0 w-full flex-1 overflow-auto">
          {api.loading && <p className="px-6 py-8 text-sm text-ink-muted">Loading records…</p>}
          <table className="w-full min-w-[760px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[17%]" />
              <col className="w-[16%]" />
              <col className="w-[15%]" />
              <col className="w-[13%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className="w-[13%]" />
            </colgroup>
            <thead className="sticky top-0 bg-canvas text-[11px] tracking-[0.06em] text-ink-subtle uppercase">
              <tr className="border-b border-border">
                {['Name', 'Company', 'Title', 'Category', 'Project', 'Status', 'Last Contact'].map((heading, index) => (
                  <th key={heading} className={`${index === 0 ? 'px-5' : index === 6 ? 'px-5' : 'px-3'} py-3 font-semibold`}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((contact) => {
                const active = selectedId === contact.id
                return (
                  <tr
                    key={contact.id}
                    tabIndex={0}
                    data-testid={`relationship-row-${contact.id}`}
                    aria-selected={active}
                    onClick={() => requestSelect(contact.id)}
                    onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        requestSelect(contact.id)
                      }
                    }}
                    className={`cursor-pointer border-b border-border/70 ${active ? 'bg-accent-soft/60' : 'hover:bg-accent-soft/30'}`}
                  >
                    <td className="truncate px-5 py-3.5 font-semibold text-navy-900">{contact.name}</td>
                    <td className="truncate px-3 py-3.5 text-ink-muted">{contact.company || '—'}</td>
                    <td className="truncate px-3 py-3.5 text-ink-muted">{contact.title || '—'}</td>
                    <td className="truncate px-3 py-3.5 text-ink-muted">{contact.category || '—'}</td>
                    <td className="truncate px-3 py-3.5 text-ink-muted" title={contactProjectIds(contact).map((id) => opportunities.find((opp) => opp.id === id)?.projectName).filter(Boolean).join(', ')}>
                      {projectLabel(contact)}
                    </td>
                    <td className="truncate px-3 py-3.5 text-ink-muted">{contact.status}</td>
                    <td className="truncate px-5 py-3.5 text-ink-muted">{contact.lastContactDate || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!api.loading && rows.length === 0 && (
            <p className="px-6 py-8 text-sm text-ink-muted">No relationships match these filters.</p>
          )}
        </div>
        <Pagination {...view} onPage={setPage} noun={rows.length === 1 ? 'relationship' : 'relationships'} testId="relationships-pagination" />
        </div>
        {selected && (
          <aside className="min-h-0 overflow-hidden bg-surface">
            <RelationshipEditor
              ref={editorRef}
              api={api}
              contact={selected}
              onClose={() => setSelectedId(null)}
              onDeleted={() => setSelectedId(null)}
            />
          </aside>
        )}
      </div>
      <NewRelationshipDrawer
        open={creating}
        api={api}
        onClose={() => setCreating(false)}
        onCreated={(created) => setSelectedId(created.id)}
      />
    </div>
  )
}
