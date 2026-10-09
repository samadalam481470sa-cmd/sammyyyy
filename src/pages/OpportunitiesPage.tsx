import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useData } from '@/data/DataContext'
import {
  OpportunityEditor,
  type OpportunityEditorHandle,
} from '@/components/shared/OpportunityEditor'
import { OPPORTUNITY_STATUSES } from '@/data/constants'
import { formatCurrency } from '@/utils/dashboard'
import { badgeClass, stageBadge, statusBadge } from '@/utils/badges'
import type { OpportunityStatus } from '@/types'

export function OpportunitiesPage() {
  const { opportunities, loading, saveOpportunity } = useData()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'All' | OpportunityStatus>('All')
  const editorRef = useRef<OpportunityEditorHandle>(null)

  const filtered = useMemo(() => {
    if (statusFilter === 'All') return opportunities
    return opportunities.filter((o) => o.status === statusFilter)
  }, [opportunities, statusFilter])

  const selected = selectedId
    ? (opportunities.find((o) => o.id === selectedId) ?? null)
    : null

  const closeEditor = () => setSelectedId(null)

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
      <header className="border-b border-border bg-surface px-6 py-5 lg:px-8">
        <h1 className="font-brand text-2xl font-bold text-navy-900">Opportunities</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Edit deal status, entity details, and the full acquisition record — one-stop view for
          Dennis and the team.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-canvas px-6 py-3 lg:px-8">
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

      <div
        className={`flex min-h-0 flex-1 ${selected ? 'lg:grid lg:grid-cols-[1fr_420px]' : ''}`}
      >
        <div className={`custom-scroll min-w-0 overflow-auto ${selected ? 'border-r border-border' : ''}`}>
          {loading && (
            <p className="px-6 py-8 text-sm text-ink-muted">Loading from database…</p>
          )}
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 bg-canvas text-[11px] tracking-[0.06em] text-ink-subtle uppercase">
              <tr className="border-b border-border">
                <th className="px-5 py-3 font-semibold">Project #</th>
                <th className="px-3 py-3 font-semibold">Project</th>
                <th className="px-3 py-3 font-semibold">Entity</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Stage</th>
                <th className="px-5 py-3 text-right font-semibold">NWP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((opp) => {
                const active = selected?.id === opp.id
                return (
                  <tr
                    key={opp.id}
                    tabIndex={0}
                    aria-selected={active}
                    onClick={() => onRowActivate(opp.id)}
                    onKeyDown={(event) => onRowKeyDown(event, opp.id)}
                    className={`cursor-pointer border-b border-border/70 ${
                      active ? 'bg-accent-soft/60' : 'hover:bg-accent-soft/30'
                    }`}
                  >
                    <td className="px-5 py-3.5 font-semibold text-navy-900">
                      Project {opp.projectNumber}
                    </td>
                    <td className="px-3 py-3.5 font-medium text-ink">{opp.projectName}</td>
                    <td className="px-3 py-3.5 text-ink-muted">{opp.entityName}</td>
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
              onSave={(patch) => saveOpportunity(selected.id, patch).then(() => undefined)}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
