import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { SideDrawer } from '@/components/shared/Overlay'
import { ContentCard, FieldLabel, FilterPopover, PageShell, PageTitleBar, PageToolbar, RecordCount, SearchBox } from '@/components/shared/PageChrome'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { useRestorableSelection, useSessionState } from '@/hooks/useSessionState'
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
import { useFitRows, useGridColumns } from '@/hooks/useFitRows'
import { Pagination } from '@/components/shared/Pagination'
import { FilterChips, type ActiveFilterChip } from '@/components/shared/FilterChips'

export function DocumentsPage() {
  const { opportunities, documents, loading } = useData()
  const [params, setParams] = useSearchParams()
  const [selectedId, setSelectedId] = useRestorableSelection('documents')
  const [selectDocId, setSelectDocId] = useState<string | null>(null)
  // The slot clicked on a card. Kept so Back from the profile reopens the same document.
  const [selectSlot, setSelectSlot] = useSessionState<string | null>('documents:slot', null)
  const [search, setSearch] = useSessionState('documents:search', '')
  const [statusFilter, setStatusFilter] = useSessionState<OpportunityStatus | ''>('documents:status', '')
  const [stageFilter, setStageFilter] = useSessionState<AcquisitionStage | ''>('documents:stage', '')
  const [pageState, setPageState] = useSessionState('documents:page', { key: '', page: 1 })
  const editorRef = useRef<OpportunityEditorHandle>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const filterKey = JSON.stringify([search, statusFilter, stageFilter])
  const page = pageState.key === filterKey ? pageState.page : 1
  // One row is a measured card plus the 12px grid gap.
  const rowsThatFit = useFitRows(areaRef, { rowHeight: 124, headerHeight: 0, gap: 12, rowSelector: '[data-doc-card]', min: 1, max: 20, fallback: 3 })
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
    return [...opportunities].sort((a, b) => (a.projectNumber ?? 0) - (b.projectNumber ?? 0)).filter((o) => {
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
  ]

  const statusOptions = OPPORTUNITY_STATUSES.map((st) => ({ id: st, label: st }))
  const stageOptions = ACQUISITION_STAGES.map((st) => ({ id: st, label: st }))
  const close = () => {
    setSelectedId(null)
    setSelectDocId(null)
    setSelectSlot(null)
  }
  const requestClose = () => (editorRef.current ? editorRef.current.requestLeave(close) : close())

  return (
    <PageShell testId="documents-page">
      <PageTitleBar title="Documents" subtitle="Navy icons mean a file is saved. Gray icons mean that slot is empty.">
        <SearchBox value={search} onChange={setSearch} placeholder="Search projects" testId="documents-search" width="w-64" />
      </PageTitleBar>
      <PageToolbar
        left={<FilterChips chips={chips} onClearAll={() => { setStatusFilter(''); setStageFilter(''); setSearch('') }} />}
        right={
          <>
            <RecordCount count={filtered.length} noun={['project', 'projects']} />
            <FilterPopover active={Boolean(statusFilter || stageFilter)} testId="documents-filter">
              <div>
                <FieldLabel>Status</FieldLabel>
                <SearchSelect value={statusFilter || null} options={statusOptions} onChange={(v) => setStatusFilter((v ?? '') as OpportunityStatus | '')} placeholder="All statuses" />
              </div>
              <div>
                <FieldLabel>Acquisition Stage</FieldLabel>
                <SearchSelect value={stageFilter || null} options={stageOptions} onChange={(v) => setStageFilter((v ?? '') as AcquisitionStage | '')} placeholder="All stages" />
              </div>
              <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink" onClick={() => { setStatusFilter(''); setStageFilter('') }}>
                <X className="h-3.5 w-3.5" /> Clear Filters
              </button>
            </FilterPopover>
          </>
        }
      />
      <ContentCard plain>
        <div ref={areaRef} className="custom-scroll min-h-0 flex-1 overflow-y-auto pb-1">
          {loading && <p className="text-sm text-ink-muted">Loading records…</p>}
          <div ref={gridRef} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="document-cards">
            {view.rows.map((opp) => (
              <div
                key={opp.id}
                role="button"
                tabIndex={0}
                data-doc-card
                data-testid={`document-card-${opp.id}`}
                onClick={() => {
                  setSelectSlot(null)
                  setSelectedId(opp.id)
                }}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    setSelectSlot(null)
                    setSelectedId(opp.id)
                  }
                }}
                className={`flex h-[124px] min-w-0 cursor-pointer flex-col justify-between rounded-xl border bg-surface p-4 text-left shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-elevated) ${selectedId === opp.id ? 'border-accent ring-2 ring-accent/20' : 'border-border'}`}
              >
                <span className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className="min-w-0 font-brand text-lg leading-tight font-bold break-words text-navy-900">{opp.projectName}</span>
                  <span className="shrink-0 text-[11px] font-semibold text-ink-muted">{dealIdFromOpportunity(opp)}</span>
                </span>
                <span className="truncate text-xs text-ink-muted">{opp.entityName}</span>
                <span className="grid grid-cols-6 gap-1">
                  {DOCUMENT_SLOT_META.map((slot) => {
                    const available = hasAttachedFile(slotDocument(documents, opp.id, slot.id))
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        className="flex flex-col items-center gap-0.5 rounded-md py-0.5 hover:bg-accent-soft"
                        title={`${slot.label}${available ? ' — file saved' : ' — empty'}`}
                        aria-label={`${slot.label} for ${opp.projectName}${available ? ', file saved' : ', empty'}`}
                        data-testid={`card-slot-${opp.id}-${slot.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectDocId(null)
                          setSelectSlot(slot.id)
                          setSelectedId(opp.id)
                        }}
                      >
                        <SlotPresenceIcon available={available} size="sm" />
                        <span className="text-[9px] font-semibold tracking-wide text-ink-muted">{slot.abbr}</span>
                      </button>
                    )
                  })}
                </span>
              </div>
            ))}
          </div>
          {!loading && filtered.length === 0 && <p className="text-sm text-ink-muted">No projects match these filters.</p>}
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <Pagination {...view} onPage={(next) => setPageState({ key: filterKey, page: next })} noun={filtered.length === 1 ? 'project' : 'projects'} testId="documents-pagination" />
        </div>
      </ContentCard>

      <SideDrawer open={Boolean(selected)} onRequestClose={requestClose} label="Project documents" width="max-w-[580px]" testId="documents-drawer">
        {selected && (
          <DocumentWorkspace key={`${selected.id}:${selectSlot ?? ''}:${selectDocId ?? ''}`} ref={editorRef} opportunity={selected} initialDocumentId={selectDocId} initialSlot={selectSlot} footerExtra={<ProfileLinkButton opportunityId={selected.id} tab="documents" focus={selectSlot ? { slot: selectSlot } : selectDocId ? { doc: selectDocId } : undefined} />} onClose={close} />
        )}
      </SideDrawer>
    </PageShell>
  )
}
