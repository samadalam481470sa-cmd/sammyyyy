import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Filter, Search, X } from 'lucide-react'
import { useData } from '@/data/DataContext'
import { ACQUISITION_STAGES, OPPORTUNITY_STATUSES } from '@/data/constants'
import { dealIdFromOpportunity } from '@/lib/dealId'
import {
  DOCUMENT_SLOT_META,
  hasAttachedFile,
  slotDocument,
} from '@/lib/documentSlots'
import { SlotPresenceIcon } from '@/components/documents/SlotPresenceIcon'
import { DocumentWorkspace } from '@/components/documents/DocumentWorkspace'
import { ProfileLinkButton } from '@/components/profile/ProfileLinkButton'
import type { OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'
import type { AcquisitionStage, OpportunityStatus } from '@/types'
import { paginate } from '@/lib/paginate'
import { usePageFor } from '@/hooks/usePageFor'
import { useFitRows, useGridColumns } from '@/hooks/useFitRows'
import { Pagination } from '@/components/shared/Pagination'
import { FilterChips, type ActiveFilterChip } from '@/components/shared/FilterChips'

export function DocumentsPage() {
  const { opportunities, documents, loading } = useData()
  const [params, setParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectDocId, setSelectDocId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | ''>('')
  const [stageFilter, setStageFilter] = useState<AcquisitionStage | ''>('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [creatingDoc, setCreatingDoc] = useState(false)
  const [cancelCreate, setCancelCreate] = useState(0)
  const editorRef = useRef<OpportunityEditorHandle>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = usePageFor(JSON.stringify([search, statusFilter, stageFilter]))
  // One row is a measured card plus the 16px grid gap; the area has 48px of vertical padding.
  const rowsThatFit = useFitRows(areaRef, { rowHeight: 126, headerHeight: 48, gap: 16, rowSelector: '[data-doc-card]', min: 1, max: 20, fallback: 3 })
  const columns = useGridColumns(gridRef, 3)

  useEffect(() => {
    const select = params.get('select')
    const doc = params.get('doc')
    if (select) {
      setSelectedId(select)
      setSelectDocId(doc)
      const next = new URLSearchParams(params)
      next.delete('select')
      next.delete('doc')
      setParams(next, { replace: true })
    }
  }, [params, setParams])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return opportunities.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false
      if (stageFilter && o.stage !== stageFilter) return false
      if (!q) return true
      const dealId = dealIdFromOpportunity(o).toLowerCase()
      return `${o.projectName} ${o.entityName} ${dealId}`.toLowerCase().includes(q)
    })
  }, [opportunities, search, statusFilter, stageFilter])

  const selected = selectedId ? (opportunities.find((o) => o.id === selectedId) ?? null) : null

  const view = paginate(filtered, page, Math.max(1, rowsThatFit * columns))
  const chips: ActiveFilterChip[] = [
    ...(statusFilter ? [{ key: 'status', label: `Status: ${statusFilter}`, onRemove: () => setStatusFilter('') }] : []),
    ...(stageFilter ? [{ key: 'stage', label: `Stage: ${stageFilter}`, onRemove: () => setStageFilter('') }] : []),
    ...(search.trim() ? [{ key: 'search', label: `Search: ${search.trim()}`, onRemove: () => setSearch('') }] : []),
  ]

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // "Add New Document" dims the rest of the CRM like other creation drawers; Escape or the backdrop leaves creation.
  useEffect(() => {
    if (!creatingDoc) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setCancelCreate((n) => n + 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [creatingDoc])

  const activate = (id: string) => {
    if (selectedId === id) {
      if (editorRef.current) editorRef.current.requestLeave(() => setSelectedId(null))
      else setSelectedId(null)
      return
    }
    if (editorRef.current) editorRef.current.requestLeave(() => setSelectedId(id))
    else setSelectedId(id)
  }

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-none flex-col overflow-hidden">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-surface px-6 py-5 lg:px-8">
        <div>
          <h1 className="font-brand text-2xl font-bold text-navy-900">Documents</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Navy icons mean a file is saved. Grey icons mean that slot is empty.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Projects"
              className="h-10 w-56 rounded-lg border border-border bg-canvas pr-3 pl-9 text-sm outline-none focus:border-accent"
            />
          </div>
          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold ${
                statusFilter || stageFilter
                  ? 'border-navy-900 bg-navy-900 text-white'
                  : 'border-border bg-surface text-ink'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filter
            </button>
            {filterOpen && (
              <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-border bg-surface p-4 shadow-(--shadow-elevated)">
                <label className="block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
                  Status
                </label>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as OpportunityStatus | '')}
                >
                  <option value="">All statuses</option>
                  {OPPORTUNITY_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <label className="mt-3 block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
                  Acquisition Stage
                </label>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm"
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value as AcquisitionStage | '')}
                >
                  <option value="">All stages</option>
                  {ACQUISITION_STAGES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-muted"
                  onClick={() => {
                    setStatusFilter('')
                    setStageFilter('')
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {chips.length > 0 && (
        <div className="border-b border-border bg-canvas px-6 py-2 lg:px-8">
          <FilterChips
            chips={chips}
            onClearAll={() => {
              setStatusFilter('')
              setStageFilter('')
              setSearch('')
            }}
          />
        </div>
      )}

      <div
        className={
          selected
            ? 'grid min-h-0 w-full flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[minmax(0,1fr)]'
            : 'flex min-h-0 w-full flex-1 flex-col'
        }
      >
        <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${selected ? 'border-r border-border' : ''}`}>
        <div ref={areaRef} className="custom-scroll min-h-0 flex-1 overflow-auto p-6">
          {loading && <p className="text-sm text-ink-muted">Loading records…</p>}
          <div
            ref={gridRef}
            className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
              selected ? 'lg:grid-cols-2 xl:grid-cols-3' : 'lg:grid-cols-3 xl:grid-cols-5'
            }`}
          >
            {view.rows.map((opp) => {
              const active = selected?.id === opp.id
              return (
                <button
                  key={opp.id}
                  type="button"
                  data-doc-card
                  onClick={() => activate(opp.id)}
                  className={`rounded-2xl border bg-surface p-4 text-left shadow-(--shadow-card) transition-colors ${
                    active ? 'border-accent bg-accent-soft/50' : 'border-border hover:border-accent-muted'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-brand text-lg font-bold text-navy-900">{opp.projectName}</p>
                      <p className="mt-1 text-xs font-semibold text-ink">{dealIdFromOpportunity(opp)}</p>
                      <p className="truncate text-xs text-ink-muted">{opp.entityName}</p>
                    </div>
                    <div className="grid shrink-0 grid-cols-3 gap-1.5">
                      {DOCUMENT_SLOT_META.map((slot) => {
                        const record = slotDocument(documents, opp.id, slot.id)
                        const available = hasAttachedFile(record)
                        return (
                          <span key={slot.id} className="flex flex-col items-center gap-0.5" title={slot.label}>
                            <SlotPresenceIcon available={available} size="sm" />
                            <span className="text-[9px] font-semibold tracking-wide text-ink-muted">{slot.abbr}</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          {!loading && filtered.length === 0 && <p className="text-sm text-ink-muted">No projects match these filters.</p>}
        </div>
        <Pagination {...view} onPage={setPage} noun={filtered.length === 1 ? 'project' : 'projects'} testId="documents-pagination" />
        </div>
        {selected && creatingDoc && (
          <button
            type="button"
            tabIndex={-1}
            data-testid="document-create-backdrop"
            aria-label="Cancel new document"
            className="fixed inset-0 z-[60] bg-navy-950/40"
            onClick={() => setCancelCreate((n) => n + 1)}
          />
        )}
        {selected && (
          <aside
            className={
              creatingDoc
                ? 'fixed inset-y-0 right-0 z-[65] flex h-dvh w-full max-w-[460px] flex-col bg-surface shadow-(--shadow-drawer)'
                : 'min-h-0 overflow-hidden bg-surface'
            }
            role={creatingDoc ? 'dialog' : undefined}
            aria-modal={creatingDoc ? true : undefined}
            aria-label={creatingDoc ? 'New document' : undefined}
          >
            <DocumentWorkspace
              ref={editorRef}
              opportunity={selected}
              initialDocumentId={selectDocId}
              onCreatingChange={setCreatingDoc}
              cancelCreateRequest={cancelCreate}
              footerExtra={<ProfileLinkButton opportunityId={selected.id} />}
              onClose={() => {
                setSelectedId(null)
                setSelectDocId(null)
                setCreatingDoc(false)
              }}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
