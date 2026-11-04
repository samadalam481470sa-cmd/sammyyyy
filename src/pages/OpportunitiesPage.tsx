import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { useData } from '@/data/DataContext'
import { OpportunityEditor, type OpportunityEditorHandle } from '@/components/shared/OpportunityEditor'
import { OpportunityCreateForm } from '@/components/shared/OpportunityCreateForm'
import { WarningTriangle } from '@/components/shared/WarningTriangle'
import { ProfileLinkButton } from '@/components/profile/ProfileLinkButton'
import { InitialsAvatar, SideDrawer } from '@/components/shared/Overlay'
import { ContentCard, FieldLabel, FilterPopover, PageShell, PageTitleBar, PageToolbar, PrimaryButton, RecordCount, SearchBox, SegmentButtons } from '@/components/shared/PageChrome'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { ACQUISITION_STAGES, OPPORTUNITY_STATUSES } from '@/data/constants'
import { formatCurrency, formatDate } from '@/utils/dashboard'
import { badgeClass, stageBadge, statusBadge } from '@/utils/badges'
import { dealIdFromOpportunity } from '@/lib/dealId'
import { primaryDealWarning } from '@/lib/attention'
import { resolveNextAction } from '@/lib/nextAction'
import { paginate } from '@/lib/paginate'
import { useFitRows } from '@/hooks/useFitRows'
import { useRestorableSelection, useSessionState } from '@/hooks/useSessionState'
import { Pagination } from '@/components/shared/Pagination'
import { FilterChips, type ActiveFilterChip } from '@/components/shared/FilterChips'
import type { AcquisitionStage, OpportunityStatus } from '@/types'

type StatusChip = 'All' | OpportunityStatus

const KEY = 'opportunities'

export function OpportunitiesPage() {
  const { opportunities, tasks, users, loading, saveOpportunity } = useData()
  const [params, setParams] = useSearchParams()
  const [selectedId, setSelectedId] = useRestorableSelection(KEY)
  const [search, setSearch] = useSessionState(`${KEY}:search`, '')
  const [statusFilter, setStatusFilter] = useSessionState<StatusChip>(`${KEY}:status`, 'All')
  const [stageFilter, setStageFilter] = useSessionState<AcquisitionStage | ''>(`${KEY}:stage`, '')
  const [ownerFilter, setOwnerFilter] = useSessionState(`${KEY}:owner`, '')
  const [needsAttentionOnly, setNeedsAttentionOnly] = useSessionState(`${KEY}:attention`, false)
  const [pageState, setPageState] = useSessionState(`${KEY}:page`, { key: '', page: 1 })
  const [createOpen, setCreateOpen] = useState(false)
  const editorRef = useRef<OpportunityEditorHandle>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const pageSize = useFitRows(tableRef, { rowHeight: 45, min: 4 })

  useEffect(() => {
    const attention = params.get('attention') === '1'
    const select = params.get('select')
    if (attention) setNeedsAttentionOnly(true)
    if (select) setSelectedId(select)
    if (select) {
      const next = new URLSearchParams(params)
      next.delete('select')
      setParams(next, { replace: true })
    }
    // Apply inbound query once on mount / URL change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('attention'), params.get('select')])

  const dealOwners = useMemo(() => {
    const names = new Set<string>()
    users.forEach((u) => names.add(u.name))
    opportunities.forEach((o) => {
      if (o.dealLead?.trim()) names.add(o.dealLead)
    })
    return [...names].sort()
  }, [users, opportunities])

  const rows = useMemo(
    () =>
      [...opportunities]
        .sort((a, b) => (a.projectNumber ?? 0) - (b.projectNumber ?? 0))
        .map((o) => ({ o, next: resolveNextAction(o, tasks), warning: primaryDealWarning(o, tasks) })),
    [opportunities, tasks],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(({ o, next }) => {
      if (statusFilter !== 'All' && o.status !== statusFilter) return false
      if (stageFilter && o.stage !== stageFilter) return false
      if (ownerFilter === '__unassigned' ? Boolean(o.dealLead?.trim()) : ownerFilter && o.dealLead !== ownerFilter) return false
      if (needsAttentionOnly && !o.needsAttention) return false
      if (q) {
        const hay = `${dealIdFromOpportunity(o)} ${o.projectName} ${o.entityName} ${o.dealLead || 'unassigned'} ${next.nextAction ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, search, statusFilter, stageFilter, ownerFilter, needsAttentionOnly])

  // Filters apply before paging; a filter change returns to page 1, Back keeps the page.
  const filterKey = JSON.stringify([search, statusFilter, stageFilter, ownerFilter, needsAttentionOnly])
  const page = pageState.key === filterKey ? pageState.page : 1
  const view = paginate(filtered, page, pageSize)
  const setPage = (next: number) => setPageState({ key: filterKey, page: next })

  const selected = selectedId ? (opportunities.find((o) => o.id === selectedId) ?? null) : null
  const closeEditor = () => setSelectedId(null)

  useEffect(() => {
    if (selectedId && !loading && opportunities.length && !opportunities.some((o) => o.id === selectedId)) setSelectedId(null)
  }, [opportunities, selectedId, loading, setSelectedId])

  const clearAttention = () => {
    setNeedsAttentionOnly(false)
    if (params.get('attention') === '1') {
      const next = new URLSearchParams(params)
      next.delete('attention')
      setParams(next, { replace: true })
    }
  }
  const chips: ActiveFilterChip[] = [
    ...(statusFilter !== 'All' ? [{ key: 'status', label: `Status: ${statusFilter}`, onRemove: () => setStatusFilter('All') }] : []),
    ...(stageFilter ? [{ key: 'stage', label: `Stage: ${stageFilter}`, onRemove: () => setStageFilter('') }] : []),
    ...(ownerFilter ? [{ key: 'owner', label: `Deal Lead: ${ownerFilter === '__unassigned' ? 'Unassigned' : ownerFilter}`, onRemove: () => setOwnerFilter('') }] : []),
    ...(needsAttentionOnly ? [{ key: 'attention', label: 'Needs Attention', tone: 'attention' as const, onRemove: clearAttention }] : []),
  ]
  const clearAll = () => {
    setStatusFilter('All')
    setStageFilter('')
    setOwnerFilter('')
    clearAttention()
  }

  const requestClose = () => (editorRef.current ? editorRef.current.requestLeave(closeEditor) : closeEditor())
  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelectedId(id)
    }
  }

  const statusOptions = [{ id: 'All' as StatusChip, label: 'All' }, ...OPPORTUNITY_STATUSES.map((s) => ({ id: s as StatusChip, label: s }))]

  return (
    <PageShell testId="opportunities-page">
      <PageTitleBar title="Opportunities" subtitle="Every acquisition deal, its status, stage, lead and next action.">
        <SearchBox value={search} onChange={setSearch} placeholder="Search opportunities" testId="opportunity-search" width="w-72" />
        <PrimaryButton onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />} testId="new-opportunity">
          New Opportunity
        </PrimaryButton>
      </PageTitleBar>

      <PageToolbar
        left={<SegmentButtons label="Status" options={statusOptions} value={statusFilter} onChange={setStatusFilter} />}
        right={
          <>
            <RecordCount count={filtered.length} noun={['Opportunity', 'Opportunities']} />
            <FilterChips chips={chips} onClearAll={clearAll} />
            <FilterPopover active={Boolean(stageFilter || ownerFilter || needsAttentionOnly)} testId="opportunity-filter">
              <div>
                <FieldLabel>Acquisition Stage</FieldLabel>
                <SearchSelect value={stageFilter || null} options={ACQUISITION_STAGES.map((s) => ({ id: s, label: s }))} onChange={(v) => setStageFilter((v ?? '') as AcquisitionStage | '')} placeholder="All stages" />
              </div>
              <div>
                <FieldLabel>Deal Lead</FieldLabel>
                <SearchSelect value={ownerFilter || null} options={[...dealOwners.map((n) => ({ id: n, label: n })), { id: '__unassigned', label: 'Unassigned' }]} onChange={(v) => setOwnerFilter(v ?? '')} placeholder="All deal leads" />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={needsAttentionOnly} onChange={(e) => (e.target.checked ? setNeedsAttentionOnly(true) : clearAttention())} />
                Needs Attention only
              </label>
              <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink" onClick={clearAll}>
                <X className="h-3.5 w-3.5" /> Clear Filters
              </button>
            </FilterPopover>
          </>
        }
      />

      <ContentCard>
        <div ref={tableRef} className="custom-scroll min-h-0 w-full flex-1 overflow-auto">
          {loading && <p className="px-6 py-8 text-sm text-ink-muted">Loading records…</p>}
          <ul className="divide-y divide-border sm:hidden" aria-label="Opportunities">
            {view.rows.map(({ o: opp, warning }) => (
              <li key={opp.id} data-card-row>
                <button type="button" onClick={() => setSelectedId(opp.id)} className="w-full px-4 py-3 text-left">
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-navy-900">
                      <span className="truncate">{opp.projectName}</span>
                      <WarningTriangle warning={warning} />
                    </span>
                    <span className="shrink-0 text-sm tabular-nums">{formatCurrency(opp.nwp)}</span>
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {dealIdFromOpportunity(opp)} · {opp.entityName} · {opp.dealLead || 'Unassigned'}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <span className={badgeClass(statusBadge(opp.status))}>{opp.status}</span>
                    <span className={badgeClass(stageBadge(opp.stage))}>{opp.stage}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <table className="hidden w-full min-w-[1040px] table-fixed text-left text-sm sm:table" data-testid="opportunities-table">
            <colgroup>
              <col className="w-[120px]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
              <col className="w-[96px]" />
              <col className="w-[148px]" />
              <col className="w-[150px]" />
              <col className="w-[66px]" />
              <col className="w-[86px]" />
              <col />
              <col className="w-[112px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-surface text-[11px] tracking-[0.06em] text-ink-subtle uppercase shadow-[inset_0_-1px_0_var(--color-border)]">
              <tr>
                <th className="py-3 pr-2 pl-5 font-semibold">Deal ID</th>
                <th className="px-2 py-3 font-semibold">Project Name</th>
                <th className="px-2 py-3 font-semibold">Company</th>
                <th className="px-2 py-3 font-semibold">Status</th>
                <th className="px-2 py-3 font-semibold">Stage</th>
                <th className="px-2 py-3 font-semibold">Deal Lead</th>
                <th className="px-2 py-3 text-right font-semibold">NWP</th>
                <th className="px-2 py-3 text-right font-semibold">PF EBITDA</th>
                <th className="px-3 py-3 font-semibold">Next Action</th>
                <th className="py-3 pr-5 pl-2 font-semibold">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map(({ o: opp, next, warning }) => {
                const active = selected?.id === opp.id
                const lead = opp.dealLead?.trim()
                return (
                  <tr
                    key={opp.id}
                    tabIndex={0}
                    data-testid={`opportunity-row-${opp.id}`}
                    aria-selected={active}
                    onClick={() => setSelectedId(opp.id)}
                    onKeyDown={(event) => onRowKeyDown(event, opp.id)}
                    className={`cursor-pointer border-b border-border/70 ${active ? 'bg-accent-soft/60' : 'hover:bg-accent-soft/30'}`}
                  >
                    <td className="py-2.5 pr-2 pl-5 font-semibold text-navy-900">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate">{dealIdFromOpportunity(opp)}</span>
                        <WarningTriangle warning={warning} />
                      </span>
                    </td>
                    <td className="truncate px-2 py-2.5 font-medium text-ink" title={opp.projectName}>{opp.projectName}</td>
                    <td className="truncate px-2 py-2.5 text-ink-muted" title={opp.entityName}>{opp.entityName}</td>
                    <td className="px-2 py-2.5">
                      <span className={badgeClass(statusBadge(opp.status))}>{opp.status}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={`${badgeClass(stageBadge(opp.stage))} max-w-full truncate`} title={opp.stage}>{opp.stage}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="flex min-w-0 items-center gap-1.5" title={lead || 'Unassigned'}>
                        <InitialsAvatar name={lead} size="xs" />
                        <span className={`truncate ${lead ? 'text-ink' : 'font-semibold text-[var(--color-danger)]'}`}>{lead || 'Unassigned'}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatCurrency(opp.nwp)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatCurrency(opp.pfEbitda)}</td>
                    <td className="truncate px-3 py-2.5 text-ink" title={next.nextAction ?? ''}>{next.nextAction || <span className="text-ink-subtle">—</span>}</td>
                    <td className="py-2.5 pr-5 pl-2 whitespace-nowrap text-ink-muted">{next.nextActionDate ? formatDate(next.nextActionDate) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && <p className="px-6 py-8 text-sm text-ink-muted">No opportunities match these filters.</p>}
        </div>
        <Pagination {...view} onPage={setPage} noun={filtered.length === 1 ? 'opportunity' : 'opportunities'} testId="opportunities-pagination" />
      </ContentCard>

      <SideDrawer open={Boolean(selected)} onRequestClose={requestClose} label="Edit opportunity" testId="opportunity-drawer">
        {selected && (
          <OpportunityEditor
            ref={editorRef}
            opportunity={selected}
            onClose={closeEditor}
            onDeleted={closeEditor}
            onSave={(patch) => saveOpportunity(selected.id, patch).then(() => undefined)}
            footerExtra={<ProfileLinkButton opportunityId={selected.id} />}
          />
        )}
      </SideDrawer>

      <OpportunityCreateForm open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => setCreateOpen(false)} />
    </PageShell>
  )
}
