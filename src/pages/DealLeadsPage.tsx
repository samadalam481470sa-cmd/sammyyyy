import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Mail, Phone, Plus, UserCheck, X } from 'lucide-react'
import { useData } from '@/data/DataContext'
import type { DealLead } from '@/lib/dealLeads'
import { useDealLeads } from '@/hooks/useDealLeads'
import { useFitRows, useGridColumns } from '@/hooks/useFitRows'
import { useRestorableSelection, useSessionState } from '@/hooks/useSessionState'
import { leadLinks } from '@/lib/dealLeads'
import { paginate } from '@/lib/paginate'
import { DealLeadEditor } from '@/components/dealLeads/DealLeadEditor'
import { NewDealLeadModal } from '@/components/dealLeads/NewDealLeadModal'
import type { OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'
import { InitialsAvatar, SideDrawer } from '@/components/shared/Overlay'
import { ContentCard, PageShell, PageTitleBar, PageToolbar, PrimaryButton, RecordCount, SearchBox, SegmentButtons } from '@/components/shared/PageChrome'
import { Pagination } from '@/components/shared/Pagination'

const KEY = 'deal-leads'
const SEGMENTS = ['All', 'Active', 'Inactive'] as const
type Segment = (typeof SEGMENTS)[number]

/** The controlled roster of acquisition leads. Signing in never adds anyone here. */
export function DealLeadsPage() {
  const roster = useDealLeads()
  const { leads, own, claimable, api } = roster
  const { opportunities, undoDeleteDealLead } = useData()
  const [undo, setUndo] = useState<{ lead: DealLead; error: string | null } | null>(null)
  useEffect(() => {
    if (!undo || undo.error) return
    const timer = window.setTimeout(() => setUndo(null), 10_000)
    return () => window.clearTimeout(timer)
  }, [undo])
  const [params, setParams] = useSearchParams()
  const [selectedId, setSelectedId] = useRestorableSelection(KEY)
  const [search, setSearch] = useSessionState(`${KEY}:search`, '')
  const [status, setStatus] = useSessionState<Segment>(`${KEY}:status`, 'All')
  const [pageState, setPageState] = useSessionState(`${KEY}:page`, { key: '', page: 1 })
  const [creating, setCreating] = useState<'create' | 'self' | null>(null)
  const [claiming, setClaiming] = useState(false)
  const editorRef = useRef<OpportunityEditorHandle>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const columns = useGridColumns(gridRef, 3)
  const rowsThatFit = useFitRows(gridRef, { rowHeight: 168, headerHeight: 0, gap: 12, min: 1, max: 8, fallback: 3, rowSelector: '[data-card-row]' })
  const pageSize = Math.max(columns, rowsThatFit * columns)

  const openSelf = () => {
    if (own) {
      setClaiming(false)
      setSelectedId(own.id)
    } else if (claimable) {
      setClaiming(true)
      setSelectedId(claimable.id)
    } else setCreating('self')
  }

  // Links from the Dashboard quick action: ?new=lead, ?new=self.
  useEffect(() => {
    const action = params.get('new')
    if (!action || api.loading) return
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
    if (action === 'lead') setCreating('create')
    else openSelf()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, api.loading])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads
      .map((lead) => ({ lead, links: leadLinks(opportunities, lead.id) }))
      .filter(({ lead, links }) => {
        if (status !== 'All' && lead.status !== status) return false
        if (!q) return true
        return `${lead.name} ${lead.jobTitle} ${lead.email} ${links.map((row) => row.opportunity.projectName).join(' ')}`.toLowerCase().includes(q)
      })
      .sort((a, b) => a.lead.name.localeCompare(b.lead.name))
  }, [leads, opportunities, search, status])

  const counts = { All: leads.length, Active: leads.filter((l) => l.status === 'Active').length, Inactive: leads.filter((l) => l.status === 'Inactive').length }
  const filterKey = JSON.stringify([search, status])
  const page = pageState.key === filterKey ? pageState.page : 1
  const view = paginate(rows, page, pageSize)
  const selected = selectedId ? (leads.find((l) => l.id === selectedId) ?? null) : null
  const close = () => {
    setSelectedId(null)
    setClaiming(false)
  }
  const requestClose = () => (editorRef.current ? editorRef.current.requestLeave(close) : close())
  const selfLabel = own ? 'Edit My Deal Lead Profile' : 'Add Myself as Deal Lead'

  return (
    <PageShell testId="deal-leads-page">
      <PageTitleBar title="Deal Leads" subtitle="Manage acquisition leads and their assigned opportunities.">
        <SearchBox value={search} onChange={setSearch} placeholder="Search deal leads..." testId="deal-lead-search" width="w-64" />
        <button type="button" onClick={openSelf} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-ink hover:bg-canvas" data-testid="deal-lead-self">
          <UserCheck className="h-4 w-4" /> {selfLabel}
        </button>
        <PrimaryButton onClick={() => setCreating('create')} icon={<Plus className="h-4 w-4" />} testId="new-deal-lead">
          New Deal Lead
        </PrimaryButton>
      </PageTitleBar>
      <PageToolbar
        left={<SegmentButtons label="Deal lead status" value={status} onChange={setStatus} options={SEGMENTS.map((s) => ({ id: s, label: s, count: counts[s] }))} />}
        right={<RecordCount count={rows.length} noun={['deal lead', 'deal leads']} />}
      />
      <ContentCard plain>
        <div ref={gridRef} className="custom-scroll grid min-h-0 flex-1 auto-rows-max grid-cols-1 content-start gap-3 overflow-y-auto pb-1 md:grid-cols-2 xl:grid-cols-3" data-testid="deal-lead-cards">
          {view.rows.map(({ lead, links }) => {
            const names = links.map((row) => row.opportunity.projectName)
            return (
              <button
                key={lead.id}
                type="button"
                data-card-row
                data-testid={`deal-lead-card-${lead.id}`}
                onClick={() => {
                  setClaiming(false)
                  setSelectedId(lead.id)
                }}
                className={`flex h-[156px] min-w-0 flex-col rounded-xl border bg-surface p-4 text-left shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-elevated) ${selectedId === lead.id ? 'border-accent ring-2 ring-accent/20' : 'border-border'}`}
              >
                <span className="flex items-start gap-3">
                  <InitialsAvatar name={lead.name} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy-900">{lead.name}</span>
                    <span className="block truncate text-xs text-ink-muted">{lead.jobTitle || 'No job title saved'}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${lead.status === 'Active' ? 'bg-[#e6f4ec] text-[#1f6b4a]' : 'bg-[#eef0f3] text-[#5a6577]'}`}>{lead.status}</span>
                </span>
                <span className="mt-2.5 flex min-w-0 items-center gap-1.5 text-xs text-ink">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                  <span className="truncate">{lead.email || 'No email saved'}</span>
                </span>
                {lead.phone && (
                  <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-ink">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                    <span className="truncate">{lead.phone}</span>
                  </span>
                )}
                <span className="mt-auto flex min-w-0 flex-wrap gap-1 overflow-hidden pt-2" style={{ maxHeight: 30 }} title={names.join(', ')}>
                  {names.length ? (
                    <>
                      {names.slice(0, 3).map((name) => (
                        <span key={name} className="max-w-[9rem] truncate rounded-md border border-border bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-navy-900">{name}</span>
                      ))}
                      {names.length > 3 && <span className="rounded-md px-1 py-0.5 text-[10px] font-semibold text-ink-muted">+{names.length - 3} more</span>}
                    </>
                  ) : (
                    <span className="text-[11px] text-ink-subtle">No linked opportunities</span>
                  )}
                </span>
              </button>
            )
          })}
          {rows.length === 0 && <p className="col-span-full px-2 py-8 text-sm text-ink-muted">No deal leads match.</p>}
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <Pagination {...view} onPage={(next) => setPageState({ key: filterKey, page: next })} noun={rows.length === 1 ? 'deal lead' : 'deal leads'} testId="deal-leads-pagination" />
        </div>
      </ContentCard>

      <SideDrawer open={Boolean(selected)} onRequestClose={requestClose} label="Edit deal lead" testId="deal-lead-drawer">
        {selected && <DealLeadEditor key={selected.id} ref={editorRef} roster={roster} mode={claiming ? 'self' : 'edit'} lead={selected} onDeleted={(lead) => setUndo({ lead, error: null })} onClose={close} onSaved={() => setClaiming(false)} />}
      </SideDrawer>
      {undo && (
        <div role="status" data-testid="deal-lead-undo" className="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-lg bg-navy-900 px-4 py-2.5 text-sm text-white shadow-(--shadow-drawer)">
          <span>{undo.error ?? `${undo.lead.name} was deleted.`}</span>
          {!undo.error && (
            <button
              type="button"
              data-testid="deal-lead-undo-button"
              className="font-semibold underline"
              onClick={() => {
                void undoDeleteDealLead(undo.lead.id)
                  .then(() => setUndo(null))
                  .catch((err: unknown) => setUndo({ lead: undo.lead, error: err instanceof Error ? err.message : 'It could not be restored.' }))
              }}
            >
              Undo
            </button>
          )}
          <button type="button" aria-label="Dismiss" onClick={() => setUndo(null)} className="rounded p-0.5 hover:bg-white/10">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <NewDealLeadModal open={creating != null} mode={creating ?? 'self'} roster={roster} onClose={() => setCreating(null)} onCreated={(lead) => setSelectedId(lead.id)} />
    </PageShell>
  )
}
