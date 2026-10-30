import { useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowLeftRight, DatabaseBackup, Download, FileJson, Info } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useData } from '@/data/DataContext'
import { formatCurrency } from '@/utils/dashboard'
import { downloadDatabaseFile } from '@/lib/api'
import { opportunitiesCsv, opportunitiesJson, saveFile } from '@/lib/reportExport'
import { todayDateInput } from '@/lib/calendarDate'
import {
  buildTrends,
  countByLead,
  dealsByStatus,
  exportScope,
  financialGroups,
  leadFinancials,
  missedDeadlinesByOwner,
  pipelineByStage,
  reportKpis,
  resolvePeriod,
  scopeDeals,
  type PeriodFilter,
} from '@/lib/reports'

const NAVY = '#0b1f3a'
const BLUE = '#3d7eb8'
const NAVY_LIGHT = '#6f86a6'
const BLUE_LIGHT = '#9cc3e4'
const GRID = '#e2e6ed'
const AXIS = { fill: '#5a6577', fontSize: 11 }

type Tab = 'pipeline' | 'leads' | 'trends'
const TABS: { id: Tab; label: string }[] = [
  { id: 'pipeline', label: 'Pipeline Overview' },
  { id: 'leads', label: 'Lead Analysis' },
  { id: 'trends', label: 'Trends Over Time' },
]

const money = (v: number) => formatCurrency(v)
const moneyAxis = (v: number) => (v === 0 ? '$0' : formatCurrency(v))

function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-(--shadow-elevated)">
      <p className="font-semibold text-ink">{label}</p>
      {payload.map((row) => (
        <p key={row.name} className="mt-0.5 text-ink-muted">
          <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: row.color }} />
          {row.name}: <span className="font-semibold text-ink">{formatCurrency(row.value, false)}</span>
        </p>
      ))}
    </div>
  )
}

function CountTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-(--shadow-elevated)">
      <p className="font-semibold text-ink">{label}</p>
      {payload.map((row) => (
        <p key={row.name} className="mt-0.5 text-ink-muted">
          {row.name}: <span className="font-semibold text-ink">{row.value}</span>
        </p>
      ))}
    </div>
  )
}

function ChartCard({ title, scope, children, empty, table, action }: { title: string; scope: string; children: ReactNode; empty?: string | null; table: { head: string[]; rows: (string | number)[][] }; action?: ReactNode }) {
  return (
    <figure className="flex min-w-0 flex-col rounded-xl border border-border bg-surface p-5 shadow-(--shadow-card)" aria-label={title}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <figcaption>
          <h2 className="font-brand text-lg font-bold text-navy-900">{title}</h2>
          <p className="text-xs text-ink-muted">{scope}</p>
        </figcaption>
        {action}
      </div>
      {empty ? <p className="flex h-60 items-center justify-center rounded-lg bg-canvas px-4 text-center text-sm text-ink-muted">{empty}</p> : <div className="h-60">{children}</div>}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>{table.head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

function PeriodBar({ value, onChange }: { value: PeriodFilter; onChange: (next: PeriodFilter) => void }) {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const input = 'h-9 rounded-lg border border-border bg-surface px-2.5 text-sm'
  return (
    <div className="flex flex-wrap items-end gap-2" data-testid="report-period">
      <label className="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
        Period
        <select
          className={`${input} mt-1 block`}
          value={value.kind}
          onChange={(e) => {
            const kind = e.target.value as PeriodFilter['kind']
            if (kind === 'month') onChange({ kind, month: value.month ?? thisMonth })
            else if (kind === 'year') onChange({ kind, year: value.year ?? String(now.getFullYear()) })
            else if (kind === 'range') onChange({ kind, from: value.from ?? `${now.getFullYear()}-01-01`, to: value.to ?? todayDateInput(now) })
            else onChange({ kind: 'all' })
          }}
        >
          <option value="all">All Time</option>
          <option value="month">Month</option>
          <option value="year">Year</option>
          <option value="range">Custom date range</option>
        </select>
      </label>
      {value.kind === 'month' && (
        <label className="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
          Month
          <input type="month" className={`${input} mt-1 block`} value={value.month ?? ''} onChange={(e) => onChange({ ...value, month: e.target.value })} />
        </label>
      )}
      {value.kind === 'year' && (
        <label className="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
          Year
          <input type="number" min={2000} max={2100} className={`${input} mt-1 block w-28`} value={value.year ?? ''} onChange={(e) => onChange({ ...value, year: e.target.value })} />
        </label>
      )}
      {value.kind === 'range' && (
        <>
          <label className="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
            From
            <input type="date" className={`${input} mt-1 block`} value={value.from ?? ''} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          </label>
          <label className="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
            To
            <input type="date" className={`${input} mt-1 block`} value={value.to ?? ''} onChange={(e) => onChange({ ...value, to: e.target.value })} />
          </label>
        </>
      )}
    </div>
  )
}

export function ReportsPage() {
  const { user } = useAuth()
  const { opportunities, tasks, users } = useData()
  const [tab, setTab] = useState<Tab>('pipeline')
  const [filters, setFilters] = useState<Record<Tab, PeriodFilter>>({ pipeline: { kind: 'all' }, leads: { kind: 'all' }, trends: { kind: 'all' } })
  const [horizontalOverdue, setHorizontalOverdue] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)

  const filter = filters[tab]
  const period = useMemo(() => resolvePeriod(filter), [filter])
  const scoped = useMemo(() => scopeDeals(opportunities, period), [opportunities, period])
  const kpis = useMemo(() => reportKpis(scoped), [scoped])
  const leads = useMemo(() => users.map((u) => u.name), [users])
  const asOf = new Date().toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

  const statusRows = useMemo(() => dealsByStatus(scoped.allStatuses), [scoped])
  const stageRows = useMemo(() => pipelineByStage(scoped.pipeline).map((r) => ({ ...r, short: r.stage.length > 15 ? `${r.stage.slice(0, 13)}…` : r.stage })), [scoped])
  const pipelineLeadRows = useMemo(() => countByLead(scoped.pipeline, leads), [scoped, leads])
  const completedLeadRows = useMemo(() => countByLead(scoped.completed, leads), [scoped, leads])
  const groups = useMemo(() => financialGroups(kpis), [kpis])
  const leadMoney = useMemo(() => leadFinancials(scoped, leads), [scoped, leads])
  const missed = useMemo(() => missedDeadlinesByOwner(tasks, period, leads), [tasks, period, leads])
  const trends = useMemo(() => buildTrends(opportunities, period), [opportunities, period])

  const createdScope = period.isAllTime ? 'all deals' : `deals created in ${period.label}`
  const completedScope = period.isAllTime ? 'all completed deals' : `deals completed in ${period.label}`

  const runExport = (kind: 'csv' | 'json') => {
    const rows = exportScope(opportunities, period)
    const slug = `${tab}-${period.isAllTime ? 'all-time' : period.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
    const name = `newport-report-${slug}-${todayDateInput()}.${kind}`
    try {
      if (kind === 'csv') saveFile(name, opportunitiesCsv(rows), 'text/csv;charset=utf-8')
      else saveFile(name, opportunitiesJson(rows), 'application/json')
      setExportMsg(`${kind.toUpperCase()} of ${rows.length} opportunit${rows.length === 1 ? 'y' : 'ies'} (${TABS.find((t) => t.id === tab)?.label}, ${period.label}) downloaded.`)
    } catch {
      setExportMsg('The export could not be created. Try again.')
    }
  }

  const kpiCards = [
    { label: 'Active + Pending Deals', value: String(kpis.pipeline.deals) },
    { label: 'Active + Pending NWP', value: money(kpis.pipeline.nwp), exact: kpis.pipeline.nwp },
    { label: 'Active + Pending PF EBITDA', value: money(kpis.pipeline.pfEbitda), exact: kpis.pipeline.pfEbitda },
    { label: 'Completed Deals', value: String(kpis.completed.deals) },
    { label: 'Completed NWP', value: money(kpis.completed.nwp), exact: kpis.completed.nwp },
    { label: 'Completed PF EBITDA', value: money(kpis.completed.pfEbitda), exact: kpis.completed.pfEbitda },
  ]

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-surface px-6 py-5 lg:px-8">
        <div>
          <h1 className="font-brand text-2xl font-bold text-navy-900">Reports</h1>
          <p className="mt-1 text-sm text-ink-muted">Pipeline analytics from the saved CRM records, as of {asOf}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => runExport('csv')} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-ink hover:bg-accent-soft">
            <Download className="h-4 w-4 text-accent" /> CSV (Excel)
          </button>
          <button type="button" onClick={() => runExport('json')} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-ink hover:bg-accent-soft">
            <FileJson className="h-4 w-4 text-accent" /> JSON
          </button>
          {user?.isManager && (
            <button
              type="button"
              onClick={() => void downloadDatabaseFile().then(() => setExportMsg('Database file downloaded.')).catch(() => setExportMsg('Database file could not be created. Try again.'))}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-navy-900 px-3 text-sm font-semibold text-white hover:bg-navy-800"
            >
              <DatabaseBackup className="h-4 w-4" /> Full database
            </button>
          )}
        </div>
      </header>

      {exportMsg && <p className="border-b border-border bg-accent-soft/50 px-6 py-2 text-sm text-navy-800 lg:px-8" role="status">{exportMsg}</p>}

      <div className="mx-auto w-full max-w-[1500px] space-y-5 px-6 py-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" data-testid="report-kpis">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-(--shadow-card)" title={kpi.exact != null ? formatCurrency(kpi.exact, false) : undefined}>
              <p className="text-[11px] leading-tight font-semibold tracking-[0.06em] text-ink-muted uppercase">{kpi.label}</p>
              <p className="mt-2 truncate font-brand text-2xl font-bold text-navy-900">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border">
          <nav className="flex flex-wrap gap-1" role="tablist" aria-label="Report">
            {TABS.map((row) => (
              <button
                key={row.id}
                type="button"
                role="tab"
                aria-selected={tab === row.id}
                data-testid={`report-tab-${row.id}`}
                onClick={() => setTab(row.id)}
                className={`border-b-2 px-3.5 py-2.5 text-sm font-semibold ${tab === row.id ? 'border-navy-900 text-navy-900' : 'border-transparent text-ink-muted hover:text-ink'}`}
              >
                {row.label}
              </button>
            ))}
          </nav>
          <div className="pb-2">
            <PeriodBar value={filter} onChange={(next) => setFilters((prev) => ({ ...prev, [tab]: next }))} />
          </div>
        </div>

        <p className="flex items-start gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-xs text-ink-muted" data-testid="report-scope-note">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <span>
            {period.isAllTime
              ? 'All Time: every saved deal by its current status. '
              : `${period.label}: Active + Pending figures are current-status deals created in this period; Completed figures are deals whose recorded completion date is in this period. Past statuses are not stored, so a period view never reconstructs an older pipeline. `}
            {!period.isAllTime && scoped.undatedCreated > 0 && `${scoped.undatedCreated} older deals have no recorded creation date and appear only under All Time. `}
            {!period.isAllTime && scoped.undatedCompleted > 0 && `${scoped.undatedCompleted} completed deals have no recorded completion date and appear only under All Time.`}
            {` KPIs above follow this tab's period. As of ${asOf}.`}
          </span>
        </p>

        {tab === 'pipeline' && (
          <div className="grid gap-4 lg:grid-cols-2" data-testid="report-pipeline">
            <ChartCard title="Deals by Status" scope={`All statuses · ${createdScope}`} table={{ head: ['Status', 'Deals'], rows: statusRows.map((r) => [r.status, r.count]) }} empty={statusRows.every((r) => r.count === 0) ? 'No deals in this period.' : null}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusRows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="status" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                  <Tooltip content={<CountTooltip />} cursor={{ fill: '#e8f1f8' }} />
                  <Bar dataKey="count" name="Deals" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Active + Pending Deals by Acquisition Stage" scope={`Active + Pending only · ${createdScope}`} table={{ head: ['Stage', 'Deals'], rows: stageRows.map((r) => [r.stage, r.count]) }} empty={scoped.pipeline.length === 0 ? 'No Active or Pending deals in this period.' : null}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageRows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="short" width={110} tick={AXIS} axisLine={false} tickLine={false} />
                  <Tooltip content={<CountTooltip />} cursor={{ fill: '#e8f1f8' }} />
                  <Bar dataKey="count" name="Deals" fill={BLUE} radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Pipeline Deals by Deal Lead" scope={`Active + Pending deals owned by each deal lead · ${createdScope}`} table={{ head: ['Deal lead', 'Deals'], rows: pipelineLeadRows.map((r) => [r.lead, r.count]) }} empty={scoped.pipeline.length === 0 ? 'No Active or Pending deals in this period.' : null}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineLeadRows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="lead" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                  <Tooltip content={<CountTooltip />} cursor={{ fill: '#e8f1f8' }} />
                  <Bar dataKey="count" name="Active + Pending deals" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="NWP and PF EBITDA by Category"
              scope={`Active + Pending (${createdScope}), Completed (${completedScope}), Combined = both`}
              table={{ head: ['Category', 'NWP', 'PF EBITDA'], rows: groups.map((g) => [g.category, formatCurrency(g.nwp, false), formatCurrency(g.pfEbitda, false)]) }}
              empty={groups.every((g) => g.nwp === 0 && g.pfEbitda === 0) ? 'No deal value in this period.' : null}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groups} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="category" tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={moneyAxis} tick={AXIS} axisLine={false} tickLine={false} width={56} />
                  <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#e8f1f8' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="nwp" name="NWP" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="pfEbitda" name="PF EBITDA" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}

        {tab === 'leads' && (
          <div className="grid gap-4 lg:grid-cols-2" data-testid="report-leads">
            <ChartCard title="Active + Pending Deals by Lead" scope={`Current Active + Pending deals · ${createdScope}`} table={{ head: ['Deal lead', 'Deals'], rows: pipelineLeadRows.map((r) => [r.lead, r.count]) }} empty={scoped.pipeline.length === 0 ? 'No Active or Pending deals in this period.' : null}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineLeadRows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="lead" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                  <Tooltip content={<CountTooltip />} cursor={{ fill: '#e8f1f8' }} />
                  <Bar dataKey="count" name="Active + Pending deals" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Completed Deals by Lead" scope={`Completed deals · ${completedScope}`} table={{ head: ['Deal lead', 'Deals'], rows: completedLeadRows.map((r) => [r.lead, r.count]) }} empty={scoped.completed.length === 0 ? 'No completed deals in this period.' : null}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={completedLeadRows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="lead" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                  <Tooltip content={<CountTooltip />} cursor={{ fill: '#e8f1f8' }} />
                  <Bar dataKey="count" name="Completed deals" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="NWP and PF EBITDA by Lead"
              scope="Each lead's Active + Pending value next to their Completed value. No combined total."
              table={{
                head: ['Deal lead', 'Active + Pending NWP', 'Active + Pending PF EBITDA', 'Completed NWP', 'Completed PF EBITDA'],
                rows: leadMoney.map((r) => [r.lead, formatCurrency(r.pipelineNwp, false), formatCurrency(r.pipelinePfEbitda, false), formatCurrency(r.completedNwp, false), formatCurrency(r.completedPfEbitda, false)]),
              }}
              empty={leadMoney.every((r) => !r.pipelineNwp && !r.completedNwp && !r.pipelinePfEbitda && !r.completedPfEbitda) ? 'No deal value in this period.' : null}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadMoney} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barGap={2} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="lead" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tickFormatter={moneyAxis} tick={AXIS} axisLine={false} tickLine={false} width={56} />
                  <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#e8f1f8' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="pipelineNwp" name="Active + Pending NWP" fill={NAVY} radius={[3, 3, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="pipelinePfEbitda" name="Active + Pending PF EBITDA" fill={BLUE} radius={[3, 3, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="completedNwp" name="Completed NWP" fill={NAVY_LIGHT} radius={[3, 3, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="completedPfEbitda" name="Completed PF EBITDA" fill={BLUE_LIGHT} radius={[3, 3, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Missed Deadlines by Task Owner"
              scope={`Tasks whose original due date ${period.isAllTime ? '' : `in ${period.label} `}passed before they were completed (or are still open). Counts tasks, by assigned task owner.`}
              action={
                <button type="button" onClick={() => setHorizontalOverdue((v) => !v)} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border px-2 text-xs font-semibold text-ink-muted hover:bg-canvas" aria-label="Switch chart orientation">
                  <ArrowLeftRight className="h-3.5 w-3.5" /> {horizontalOverdue ? 'Vertical' : 'Horizontal'}
                </button>
              }
              table={{ head: ['Task owner', 'Missed deadlines'], rows: missed.rows.map((r) => [r.owner, r.count]) }}
              empty={missed.total === 0 ? 'No missed deadlines in this period.' : null}
            >
              <ResponsiveContainer width="100%" height="100%">
                {horizontalOverdue ? (
                  <BarChart data={missed.rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="owner" width={110} tick={AXIS} axisLine={false} tickLine={false} />
                    <Tooltip content={<CountTooltip />} cursor={{ fill: '#e8f1f8' }} />
                    <Bar dataKey="count" name="Missed deadlines" fill={NAVY} radius={[0, 4, 4, 0]} maxBarSize={22} />
                  </BarChart>
                ) : (
                  <BarChart data={missed.rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                    <XAxis dataKey="owner" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
                    <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                    <Tooltip content={<CountTooltip />} cursor={{ fill: '#e8f1f8' }} />
                    <Bar dataKey="count" name="Missed deadlines" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={56} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </ChartCard>
            {missed.presentStateOnly > 0 && (
              <p className="text-xs text-ink-muted lg:col-span-2">
                {missed.presentStateOnly} of these tasks were created before original due dates were recorded (Oct 30, 2026). For them, the current due date is used, so earlier date changes cannot be checked.
              </p>
            )}
          </div>
        )}

        {tab === 'trends' && (
          <div className="grid gap-4 lg:grid-cols-2" data-testid="report-trends">
            <div className="lg:col-span-2">
              <ChartCard
                title="New Opportunities Created vs Acquisitions Completed"
                scope="Per month, from recorded dates. Created counts every new deal whatever its status now. Completed counts recorded moves into Completed, minus recorded reversals."
                table={{ head: ['Month', 'Created', 'Completed'], rows: trends.points.map((p) => [p.label, p.created, p.completed]) }}
                empty={trends.points.length === 0 ? 'No dated records in this period yet.' : null}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends.points} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                    <Tooltip content={<CountTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line isAnimationActive={false} type="linear" dataKey="created" name="New opportunities created" stroke={NAVY} strokeWidth={2} dot={{ r: 3 }} />
                    <Line isAnimationActive={false} type="linear" dataKey="completed" name="Acquisitions completed" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <ChartCard
              title="Cumulative Completed NWP"
              scope="Running total of NWP on completion dates. It only drops when a completion is reversed."
              table={{ head: ['Month', 'Cumulative NWP'], rows: trends.points.map((p) => [p.label, formatCurrency(p.cumulativeNwp, false)]) }}
              empty={trends.points.length === 0 ? 'No dated completions yet.' : null}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends.points} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={moneyAxis} tick={AXIS} axisLine={false} tickLine={false} width={56} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Line isAnimationActive={false} type="stepAfter" dataKey="cumulativeNwp" name="Completed NWP" stroke={NAVY} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard
              title="Cumulative Completed PF EBITDA"
              scope="Running total of PF EBITDA on completion dates. Shown separately because its scale differs from NWP."
              table={{ head: ['Month', 'Cumulative PF EBITDA'], rows: trends.points.map((p) => [p.label, formatCurrency(p.cumulativePfEbitda, false)]) }}
              empty={trends.points.length === 0 ? 'No dated completions yet.' : null}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends.points} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={moneyAxis} tick={AXIS} axisLine={false} tickLine={false} width={56} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Line isAnimationActive={false} type="stepAfter" dataKey="cumulativePfEbitda" name="Completed PF EBITDA" stroke={BLUE} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            {(trends.undatedCreated > 0 || trends.undatedCompleted > 0 || trends.reversals > 0) && (
              <p className="text-xs text-ink-muted lg:col-span-2" data-testid="trend-coverage-note">
                Historical coverage is incomplete:
                {trends.undatedCreated > 0 && ` ${trends.undatedCreated} deals have no recorded creation date and are not in the created line.`}
                {trends.undatedCompleted > 0 && ` ${trends.undatedCompleted} completed deals have no recorded completion date and are not in the completed line or the running totals.`}
                {trends.reversals > 0 && ` ${trends.reversals} recorded reversal${trends.reversals === 1 ? '' : 's'} out of Completed ${trends.reversals === 1 ? 'is' : 'are'} subtracted on the reversal date.`}
                {' '}No dates are guessed.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
