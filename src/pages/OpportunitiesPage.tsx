import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Filter, Plus, X } from 'lucide-react'
import { useData } from '@/data/DataContext'
import {
  OpportunityEditor,
  type OpportunityEditorHandle,
} from '@/components/shared/OpportunityEditor'
import { OpportunityCreateForm } from '@/components/shared/OpportunityCreateForm'
import { WarningTriangle } from '@/components/shared/WarningTriangle'
import { ACQUISITION_STAGES, OPPORTUNITY_STATUSES } from '@/data/constants'
import { formatCurrency } from '@/utils/dashboard'
import { badgeClass, stageBadge, statusBadge } from '@/utils/badges'
import { dealIdFromOpportunity } from '@/lib/dealId'
import { primaryDealWarning } from '@/lib/attention'
import type { AcquisitionStage, OpportunityStatus } from '@/types'

type StatusChip = 'All' | OpportunityStatus

export function OpportunitiesPage() {
  const { opportunities, tasks, users, loading, saveOpportunity } = useData()
  const [params, setParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusChip>('All')
  const [stageFilter, setStageFilter] = useState<AcquisitionStage | ''>('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const editorRef = useRef<OpportunityEditorHandle>(null)
  const filterRef = useRef<HTMLDivElement>(null)

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
    // Apply inbound query once on mount / URL change; keep attention=1 visible.
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

  const filtered = useMemo(() => {
    return opportunities.filter((o) => {
      if (statusFilter !== 'All' && o.status !== statusFilter) return false
      if (stageFilter && o.stage !== stageFilter) return false
      if (ownerFilter && o.dealLead !== ownerFilter) return false
      if (needsAttentionOnly && !o.needsAttention) return false
      return true
    })
  }, [opportunities, statusFilter, stageFilter, ownerFilter, needsAttentionOnly])

  const selected = selectedId
    ? (opportunities.find((o) => o.id === selectedId) ?? null)
    : null

  const closeEditor = () => setSelectedId(null)
  const advancedActive = Boolean(stageFilter || ownerFilter || needsAttentionOnly)

  useEffect(() => {
    if (!selectedId) return
    if (!opportunities.some((o) => o.id === selectedId)) {
      setSelectedId(null)
      return
    }
    if (!filtered.some((o) => o.id === selectedId) && !editorRef.current?.isDirty()) {
      setSelectedId(null)
    }
  }, [filtered, opportunities, selectedId])

  useEffect(() => {
    if (!selectedId) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (editorRef.current) editorRef.current.requestLeave(closeEditor)
      else closeEditor()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const onRowActivate = (id: string) => {
    if (selectedId === id) {
      if (editorRef.current) editorRef.current.requestLeave(closeEditor)
      else closeEditor()
      return
    }
    if (!selectedId) {
      setSelectedId(id)
      return
    }
    if (editorRef.current) editorRef.current.requestLeave(() => setSelectedId(id))
    else setSelectedId(id)
  }

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onRowActivate(id)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-surface px-6 py-5 lg:px-8">
        <div>
          <h1 className="font-brand text-2xl font-bold text-navy-900">Opportunities</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Edit deal status, company details, and the full acquisition record — one-stop view for
            Dennis and the team.
          </p>
        </div>
        <p className="text-sm font-semibold text-navy-900">
          {filtered.length} {filtered.length === 1 ? 'Opportunity' : 'Opportunities'}
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-canvas px-6 py-3 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-[0.06em] text-ink-subtle uppercase">
            Status
          </span>
          <button
            type="button"
            onClick={() => setStatusFilter('All')}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              statusFilter === 'All'
                ? 'border-navy-900 bg-navy-900 text-white'
                : 'border-border bg-surface text-ink-muted'
            }`}
          >
            All
          </button>
          {OPPORTUNITY_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                statusFilter === s
                  ? 'border-navy-900 bg-navy-900 text-white'
                  : 'border-border bg-surface text-ink-muted'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {needsAttentionOnly && (
            <span className="rounded-full border border-attention bg-attention-bg px-3 py-1.5 text-xs font-semibold text-attention">
              Needs Attention
            </span>
          )}
          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold ${
                advancedActive
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
                <label className="mt-3 block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
                  Deal Owner
                </label>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm"
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                >
                  <option value="">All owners</option>
                  {dealOwners.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
                <label className="mt-3 flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={needsAttentionOnly}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setNeedsAttentionOnly(checked)
                      if (!checked && params.get('attention') === '1') {
                        const next = new URLSearchParams(params)
                        next.delete('attention')
                        setParams(next, { replace: true })
                      }
                    }}
                  />
                  Needs Attention
                </label>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink"
                  onClick={() => {
                    setStageFilter('')
                    setOwnerFilter('')
                    setNeedsAttentionOnly(false)
                    if (params.get('attention') === '1') {
                      const next = new URLSearchParams(params)
                      next.delete('attention')
                      setParams(next, { replace: true })
                    }
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  Clear Filters
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-navy-900 px-3.5 text-sm font-semibold text-white hover:bg-navy-800"
          >
            <Plus className="h-4 w-4" />
            New Opportunity
          </button>
        </div>
      </div>

      <div
        className={
          selected
            ? 'grid min-h-0 w-full flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]'
            : 'flex min-h-0 w-full flex-1 flex-col'
        }
      >
        <div
          className={`custom-scroll min-h-0 min-w-0 w-full flex-1 overflow-auto ${
            selected ? 'border-r border-border' : ''
          }`}
        >
          {loading && (
            <p className="px-6 py-8 text-sm text-ink-muted">Loading records…</p>
          )}
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
              <col className="w-[14%]" />
              <col className="w-[18%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="sticky top-0 bg-canvas text-[11px] tracking-[0.06em] text-ink-subtle uppercase">
              <tr className="border-b border-border">
                <th className="px-5 py-3 font-semibold">Deal ID</th>
                <th className="px-3 py-3 font-semibold">Project Name</th>
                <th className="px-3 py-3 font-semibold">Company</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Stage</th>
                <th className="px-5 py-3 text-right font-semibold">NWP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((opp) => {
                const active = selected?.id === opp.id
                const warning = primaryDealWarning(opp, tasks)
                return (
                  <tr
                    key={opp.id}
                    tabIndex={0}
                    data-testid={`opportunity-row-${opp.id}`}
                    aria-selected={active}
                    onClick={() => onRowActivate(opp.id)}
                    onKeyDown={(event) => onRowKeyDown(event, opp.id)}
                    className={`cursor-pointer border-b border-border/70 ${
                      active ? 'bg-accent-soft/60' : 'hover:bg-accent-soft/30'
                    }`}
                  >
                    <td className="px-5 py-3.5 font-semibold text-navy-900">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate">{dealIdFromOpportunity(opp)}</span>
                        <WarningTriangle warning={warning} />
                      </span>
                    </td>
                    <td className="truncate px-3 py-3.5 font-medium text-ink">{opp.projectName}</td>
                    <td className="truncate px-3 py-3.5 text-ink-muted">{opp.entityName}</td>
                    <td className="px-3 py-3.5">
                      <span className={badgeClass(statusBadge(opp.status))}>{opp.status}</span>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={badgeClass(stageBadge(opp.stage))}>{opp.stage}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatCurrency(opp.nwp)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {selected && (
          <aside className="min-h-[480px] bg-surface lg:h-[calc(100vh-11rem)]">
            <OpportunityEditor
              ref={editorRef}
              opportunity={selected}
              onClose={closeEditor}
              onDeleted={closeEditor}
              onSave={(patch) => saveOpportunity(selected.id, patch).then(() => undefined)}
            />
          </aside>
        )}
      </div>

      <OpportunityCreateForm open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
