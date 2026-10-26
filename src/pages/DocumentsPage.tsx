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
import type { OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'
import type { AcquisitionStage, OpportunityStatus } from '@/types'

export function DocumentsPage() {
  const { opportunities, documents, loading } = useData()
  const [params, setParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectDocId, setSelectDocId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | ''>('')
  const [stageFilter, setStageFilter] = useState<AcquisitionStage | ''>('')
  const [filterOpen, setFilterOpen] = useState(false)
  const editorRef = useRef<OpportunityEditorHandle>(null)
  const filterRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

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
    <div className="flex min-h-0 flex-1 flex-col">
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

      <div
        className={
          selected
            ? 'grid min-h-0 w-full flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]'
            : 'flex min-h-0 w-full flex-1 flex-col'
        }
      >
        <div className={`custom-scroll min-h-0 flex-1 overflow-auto p-6 ${selected ? 'border-r border-border' : ''}`}>
          {loading && <p className="text-sm text-ink-muted">Loading records…</p>}
          <div
            className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
              selected ? 'lg:grid-cols-2 xl:grid-cols-3' : 'lg:grid-cols-3 xl:grid-cols-5'
            }`}
          >
            {filtered.map((opp) => {
              const active = selected?.id === opp.id
              return (
                <button
                  key={opp.id}
                  type="button"
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
        </div>
        {selected && (
          <aside className="min-h-[480px] bg-surface lg:h-[calc(100vh-11rem)]">
            <DocumentWorkspace
              ref={editorRef}
              opportunity={selected}
              initialDocumentId={selectDocId}
              onClose={() => {
                setSelectedId(null)
                setSelectDocId(null)
              }}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
