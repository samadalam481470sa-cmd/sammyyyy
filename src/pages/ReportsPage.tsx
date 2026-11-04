import { useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronLeft, ChevronRight, Clock, DatabaseBackup, Download, FileJson, Info, X } from 'lucide-react'
import { PageShell, PageTitleBar } from '@/components/shared/PageChrome'
import { PeriodFilterControl } from '@/components/shared/PeriodFilterControl'
import { STATUS_CHART_COLORS } from '@/utils/badges'
import { useAuth } from '@/auth/AuthContext'
import { useData } from '@/data/DataContext'
import { formatCurrency } from '@/utils/dashboard'
import { downloadDatabaseFile } from '@/lib/api'
import { opportunitiesCsv, opportunitiesJson, saveFile } from '@/lib/reportExport'
import { todayDateInput } from '@/lib/calendarDate'
import { COMPLETION_REPORT_DELAY_MS, completionConfirmedTime } from '@/lib/statusHistory'
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
const TEAL = '#2f8f83'
const SLATE = '#a3adbd'
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

function ChartCard({ title, scope, children, empty, table }: { title: string; scope: string; children: ReactNode; empty?: string | null; table: { head: string[]; rows: (string | number)[][] } }) {
  return (
    <figure className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-surface p-4 shadow-(--shadow-card)" aria-label={title}>
      <figcaption className="mb-2 shrink-0">
        <h2 className="font-brand text-lg leading-tight font-bold text-navy-900">{title}</h2>
        <p className="text-xs text-ink-muted">{scope}</p>
      </figcaption>
      {empty ? (
        <p className="flex min-h-[200px] flex-1 items-center justify-center rounded-lg bg-canvas px-4 text-center text-sm text-ink-muted">{empty}</p>
      ) : (
        <div className="min-h-[220px] flex-1">{children}</div>
      )}
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

/** Two large charts per view with arrows and page dots, inside each report tab. */
function ChartPager({ pages, page, onPage, testId }: { pages: ReactNode[][]; page: number; onPage: (n: number) => void; testId: string }) {
  const current = pages[Math.min(page, pages.length - 1)] ?? []
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2" data-testid={testId}>
      <div className={`grid min-h-0 flex-1 gap-4 ${current.length > 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>{current}</div>
      <div className="flex shrink-0 items-center justify-center gap-3">
        <button type="button" onClick={() => onPage(Math.max(0, page - 1))} disabled={page === 0} aria-label="Previous charts" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-ink hover:bg-canvas disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Chart views">
          {pages.map((_, i) => (
            <button key={i} type="button" role="tab" aria-selected={i === page} aria-label={`View ${i + 1} of ${pages.length}`} onClick={() => onPage(i)} className={`h-2.5 rounded-full transition-all ${i === page ? 'w-6 bg-navy-900' : 'w-2.5 bg-border-strong hover:bg-ink-subtle'}`} />
          ))}
        </div>
        <span className="text-xs text-ink-muted">
          View {page + 1} of {pages.length}
        </span>
        <button type="button" onClick={() => onPage(Math.min(pages.length - 1, page + 1))} disabled={page >= pages.length - 1} aria-label="Next charts" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-ink hover:bg-canvas disabled:opacity-40" data-testid="report-next">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

const ALL_TIME: PeriodFilter = { kind: 'all' }

export function ReportsPage() {
  const { user } = useAuth()
  const { opportunities, tasks, users } = useData()
  const [tab, setTab] = useState<Tab>('pipeline')
  const [filter, setFilter] = useState<PeriodFilter>(ALL_TIME)
  const [subpage, setSubpage] = useState(0)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const now = useMemo(() => new Date(), [opportunities, tasks]) // eslint-disable-line react-hooks/exhaustive-deps

  // Every switch of main tab starts again at All Time and the first view.
  const switchTab = (next: Tab) => {
    setTab(next)
    setFilter(ALL_TIME)
    setSubpage(0)
  }

  const period = useMemo(() => resolvePeriod(filter, now), [filter, now])
  const scoped = useMemo(() => scopeDeals(opportunities, period, now), [opportunities, period, now])
  const kpis = useMemo(() => reportKpis(scoped), [scoped])
  const leads = useMemo(() => users.map((u) => u.name), [users])
  const asOf = now.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

  const statusRows = useMemo(() => dealsByStatus(scoped.allStatuses).filter((r) => r.count > 0), [scoped])
  const statusTotal = statusRows.reduce((a, r) => a + r.count, 0)
  const stageRows = useMemo(() => pipelineByStage(scoped.pipeline), [scoped])
  const pipelineLeadRows = useMemo(() => countByLead(scoped.pipeline, leads), [scoped, leads])
  const completedLeadRows = useMemo(() => countByLead(scoped.completed, leads), [scoped, leads])
  const leadMix = useMemo(() => {
    const names = new Set([...leads, ...scoped.allStatuses.map((o) => o.dealLead?.trim() || 'Unassigned')])
    return [...names].sort((a, b) => (a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b))).map((lead) => {
      const mine = scoped.allStatuses.filter((o) => (o.dealLead?.trim() || 'Unassigned') === lead)
      return {
        lead,
        pipeline: mine.filter((o) => o.status === 'Active' || o.status === 'Pending').length,
        completed: mine.filter((o) => o.status === 'Completed').length,
        other: mine.filter((o) => !['Active', 'Pending', 'Completed'].includes(o.status)).length,
      }
    }).filter((r) => r.pipeline + r.completed + r.other > 0)
  }, [scoped, leads])
  const groups = useMemo(() => financialGroups(kpis), [kpis])
  const leadMoney = useMemo(() => leadFinancials(scoped, leads), [scoped, leads])
  const missed = useMemo(() => missedDeadlinesByOwner(tasks, period, leads, now), [tasks, period, leads, now])
  const trends = useMemo(() => buildTrends(opportunities, period, now), [opportunities, period, now])

  const createdScope = period.isAllTime ? 'all deals' : `deals created in ${period.label}`
  const completedScope = period.isAllTime ? 'all final completions' : `legally closed in ${period.label}`
  const provisional = scoped.provisional
  const provisionalNote = provisional.length
    ? provisional
        .map((o) => {
          const confirmed = completionConfirmedTime(o)
          const ready = confirmed ? new Date(new Date(confirmed).getTime() + COMPLETION_REPORT_DELAY_MS) : null
          return `${o.projectName}${ready ? ` (counts from ${ready.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })})` : ''}`
        })
        .join(', ')
    : ''

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
    { label: 'Completed Deals', value: String(kpis.completed.deals), note: provisional.length ? `+${provisional.length} provisional` : undefined },
    { label: 'Completed NWP', value: money(kpis.completed.nwp), exact: kpis.completed.nwp },
    { label: 'Completed PF EBITDA', value: money(kpis.completed.pfEbitda), exact: kpis.completed.pfEbitda },
  ]

  const labelMoney = (v: unknown) => (typeof v === 'number' && v > 0 ? formatCurrency(v) : '')

  const pipelineCharts = [
    [
      <ChartCard key="status" title="Deals by Status" scope={`All statuses · ${createdScope}`} table={{ head: ['Status', 'Deals'], rows: statusRows.map((r) => [r.status, r.count]) }} empty={statusTotal === 0 ? 'No deals created in this period.' : null}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={statusRows} dataKey="count" nameKey="status" cx="40%" innerRadius="55%" outerRadius="85%" paddingAngle={1.5} isAnimationActive={false}>
              {statusRows.map((r) => (
                <Cell key={r.status} fill={STATUS_CHART_COLORS[r.status] ?? SLATE} />
              ))}
            </Pie>
            <text x="40%" y="47%" textAnchor="middle" dominantBaseline="middle" className="fill-navy-900" style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-brand)' }}>
              {statusTotal}
            </text>
            <text x="40%" y="55%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fill: '#5a6577' }}>
              deals
            </text>
            <Tooltip content={<CountTooltip />} />
            <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={(value: string) => `${value} (${statusRows.find((r) => r.status === value)?.count ?? 0})`} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>,
      <ChartCard key="stage" title="Active + Pending Deals by Acquisition Stage" scope={`Active + Pending only · ${createdScope}`} table={{ head: ['Stage', 'Deals'], rows: stageRows.map((r) => [r.stage, r.count]) }} empty={scoped.pipeline.length === 0 ? 'No Active or Pending deals created in this period.' : null}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stageRows} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="stage" width={150} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip content={<CountTooltip />} cursor={{ fill: '#e8f1f8' }} />
            <Bar dataKey="count" name="Deals" fill={BLUE} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
              <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: '#1a2332' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>,
    ],
    [
      <ChartCard key="lead" title="Deals by Deal Lead" scope={`Each lead's deals split by status group · ${createdScope}`} table={{ head: ['Deal lead', 'Active + Pending', 'Completed', 'Other'], rows: leadMix.map((r) => [r.lead, r.pipeline, r.completed, r.other]) }} empty={leadMix.length === 0 ? 'No deals created in this period.' : null}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={leadMix} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="lead" width={120} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip content={<CountTooltip />} cursor={{ fill: '#e8f1f8' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="pipeline" stackId="a" name="Active + Pending" fill={NAVY} maxBarSize={28} isAnimationActive={false} />
            <Bar dataKey="completed" stackId="a" name="Completed" fill={TEAL} maxBarSize={28} isAnimationActive={false} />
            <Bar dataKey="other" stackId="a" name="Other statuses" fill={SLATE} radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>,
      <ChartCard
        key="money"
        title="NWP vs PF EBITDA"
        scope={`Active + Pending (${createdScope}) · Completed at legal closing (${completedScope}) · Combined = both`}
        table={{ head: ['Category', 'NWP', 'PF EBITDA'], rows: groups.map((g) => [g.category, formatCurrency(g.nwp, false), formatCurrency(g.pfEbitda, false)]) }}
        empty={groups.every((g) => g.nwp === 0 && g.pfEbitda === 0) ? 'No deal value in this period.' : null}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={groups} margin={{ top: 18, right: 8, left: 4, bottom: 0 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="category" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={moneyAxis} tick={AXIS} axisLine={false} tickLine={false} width={58} />
            <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#e8f1f8' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="nwp" name="NWP" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={46} isAnimationActive={false}>
              <LabelList dataKey="nwp" position="top" formatter={labelMoney} style={{ fontSize: 11, fill: '#1a2332' }} />
            </Bar>
            <Bar dataKey="pfEbitda" name="PF EBITDA" fill={BLUE_LIGHT} radius={[4, 4, 0, 0]} maxBarSize={46} isAnimationActive={false}>
              <LabelList dataKey="pfEbitda" position="top" formatter={labelMoney} style={{ fontSize: 11, fill: '#1a2332' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>,
    ],
  ]

  const countBars = (rows: { lead: string; count: number }[], name: string, fill: string) => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 18, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="lead" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip content={<CountTooltip />} cursor={{ fill: '#e8f1f8' }} />
        <Bar dataKey="count" name={name} fill={fill} radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false}>
          <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#1a2332' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )

  const leadCharts = [
    [
      <ChartCard key="ap" title="Active + Pending Deals by Lead" scope={`Current Active + Pending deals · ${createdScope}`} table={{ head: ['Deal lead', 'Deals'], rows: pipelineLeadRows.map((r) => [r.lead, r.count]) }} empty={scoped.pipeline.length === 0 ? 'No Active or Pending deals created in this period.' : null}>
        {countBars(pipelineLeadRows, 'Active + Pending deals', NAVY)}
      </ChartCard>,
      <ChartCard key="cd" title="Completed Deals by Lead" scope={`Final completions by legal closing date · ${completedScope}`} table={{ head: ['Deal lead', 'Deals'], rows: completedLeadRows.map((r) => [r.lead, r.count]) }} empty={scoped.completed.length === 0 ? 'No final completions in this period.' : null}>
        {countBars(completedLeadRows, 'Completed deals', TEAL)}
      </ChartCard>,
    ],
    [
      <ChartCard
        key="lm"
        title="NWP & PF EBITDA by Lead"
        scope="Each lead's Active + Pending value beside their Completed value (at legal closing). No combined total."
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
            <YAxis tickFormatter={moneyAxis} tick={AXIS} axisLine={false} tickLine={false} width={58} />
            <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#e8f1f8' }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="pipelineNwp" name="Active + Pending NWP" fill={NAVY} radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
            <Bar dataKey="pipelinePfEbitda" name="Active + Pending PF EBITDA" fill={NAVY_LIGHT} radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
            <Bar dataKey="completedNwp" name="Completed NWP" fill={TEAL} radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
            <Bar dataKey="completedPfEbitda" name="Completed PF EBITDA" fill={BLUE_LIGHT} radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>,
      <ChartCard
        key="missed"
        title="Missed Deadlines by Lead"
        scope={`Tasks whose ORIGINAL due date ${period.isAllTime ? '' : `in ${period.label} `}passed before they were completed (or are still open), by assigned owner. Later due-date changes do not erase a miss.`}
        table={{ head: ['Owner', 'Missed deadlines'], rows: missed.rows.map((r) => [r.owner, r.count]) }}
        empty={missed.total === 0 ? 'No missed deadlines in this period.' : null}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={missed.rows} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="owner" width={120} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip content={<CountTooltip />} cursor={{ fill: '#e8f1f8' }} />
            <Bar dataKey="count" name="Missed deadlines" fill="#b4554a" radius={[0, 4, 4, 0]} maxBarSize={26} isAnimationActive={false}>
              <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: '#1a2332' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>,
    ],
  ]

  const cumulative = (key: 'cumulativeNwp' | 'cumulativePfEbitda', name: string, color: string) => (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={trends.points} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={moneyAxis} tick={AXIS} axisLine={false} tickLine={false} width={58} />
        <Tooltip content={<MoneyTooltip />} />
        <Line isAnimationActive={false} type="stepAfter" dataKey={key} name={name} stroke={color} strokeWidth={2.25} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
  const trendCharts = [
    [
      <ChartCard
        key="cvc"
        title="New Opportunities Created vs Acquisitions Completed"
        scope="Per month. Created = creation date (any status now). Completed = final completions on the legal closing date."
        table={{ head: ['Month', 'Created', 'Completed'], rows: trends.points.map((p) => [p.label, p.created, p.completed]) }}
        empty={trends.points.length === 0 ? 'No dated records in this period.' : null}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trends.points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip content={<CountTooltip />} cursor={{ fill: '#e8f1f8' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="created" name="New opportunities created" fill={NAVY} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Bar dataKey="completed" name="Acquisitions completed" fill={TEAL} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>,
      <ChartCard key="cnwp" title="Cumulative Completed NWP" scope="Running total of NWP at legal closing, carrying forward everything closed before the period." table={{ head: ['Month', 'Cumulative NWP'], rows: trends.points.map((p) => [p.label, formatCurrency(p.cumulativeNwp, false)]) }} empty={trends.points.length === 0 ? 'No dated completions in this period.' : null}>
        {cumulative('cumulativeNwp', 'Completed NWP', NAVY)}
      </ChartCard>,
    ],
    [
      <ChartCard key="cpfe" title="Cumulative Completed PF EBITDA" scope="Running total of PF EBITDA at legal closing, on its own scale (separate from NWP)." table={{ head: ['Month', 'Cumulative PF EBITDA'], rows: trends.points.map((p) => [p.label, formatCurrency(p.cumulativePfEbitda, false)]) }} empty={trends.points.length === 0 ? 'No dated completions in this period.' : null}>
        {cumulative('cumulativePfEbitda', 'Completed PF EBITDA', TEAL)}
      </ChartCard>,
    ],
  ]

  const pages = tab === 'pipeline' ? pipelineCharts : tab === 'leads' ? leadCharts : trendCharts

  return (
    <PageShell testId="reports-page">
      <PageTitleBar title="Reports" subtitle={`Pipeline analytics from the saved CRM records, as of ${asOf}.`}>
        <button type="button" onClick={() => runExport('csv')} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-ink hover:bg-accent-soft">
          <Download className="h-4 w-4 text-accent" /> CSV (Excel)
        </button>
        <button type="button" onClick={() => runExport('json')} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-ink hover:bg-accent-soft">
          <FileJson className="h-4 w-4 text-accent" /> JSON
        </button>
        {user?.isManager && (
          <button type="button" onClick={() => void downloadDatabaseFile().then(() => setExportMsg('Database file downloaded.')).catch(() => setExportMsg('Database file could not be created. Try again.'))} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-navy-900 px-3 text-sm font-semibold text-white hover:bg-navy-800">
            <DatabaseBackup className="h-4 w-4" /> Full database
          </button>
        )}
      </PageTitleBar>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-4 lg:overflow-hidden lg:px-8">
        {exportMsg && (
          <p className="shrink-0 rounded-lg bg-accent-soft/60 px-3 py-1.5 text-sm text-navy-800" role="status">
            {exportMsg}
          </p>
        )}
        <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" data-testid="report-kpis">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="min-w-0 rounded-xl border border-border bg-surface px-4 py-3 shadow-(--shadow-card)" title={kpi.exact != null ? formatCurrency(kpi.exact, false) : undefined}>
              <p className="text-[10px] leading-tight font-semibold tracking-[0.06em] text-ink-muted uppercase">{kpi.label}</p>
              <p className="mt-1 truncate font-brand text-2xl font-bold text-navy-900">{kpi.value}</p>
              {kpi.note && <p className="text-[10px] font-semibold text-warning">{kpi.note}</p>}
            </div>
          ))}
        </div>

        {provisional.length > 0 && (
          <p className="flex shrink-0 items-start gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-1.5 text-xs text-warning" data-testid="provisional-note">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Provisional — not yet counted: {provisionalNote}. A deal set to Completed is included in completion reports 24 hours after it was confirmed, on its legal closing date. Dashboard and Opportunities already show it as Completed.
            </span>
          </p>
        )}

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border">
          <nav className="flex flex-wrap gap-1" role="tablist" aria-label="Report">
            {TABS.map((row) => (
              <button key={row.id} type="button" role="tab" aria-selected={tab === row.id} data-testid={`report-tab-${row.id}`} onClick={() => switchTab(row.id)} className={`border-b-2 px-3.5 py-2.5 text-sm font-semibold ${tab === row.id ? 'border-navy-900 text-navy-900' : 'border-transparent text-ink-muted hover:text-ink'}`}>
                {row.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 pb-1.5">
            <button type="button" onClick={() => setFilter(ALL_TIME)} disabled={period.isAllTime} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-40" data-testid="report-clear-period">
              <X className="h-3.5 w-3.5" /> Clear filter
            </button>
            <PeriodFilterControl value={filter} onChange={setFilter} testId="report-period" />
          </div>
        </div>

        <p className="flex shrink-0 items-start gap-2 text-[11px] text-ink-muted" data-testid="report-scope-note">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <span>
            {period.isAllTime
              ? 'All Time: every saved deal by its current status. '
              : `${period.label}: Active + Pending = current-status deals created in this period; Completed = final completions whose legal closing date is in this period. `}
            {!period.isAllTime && scoped.undatedCreated > 0 && `${scoped.undatedCreated} deals have no recorded creation date and appear only under All Time. `}
            {!period.isAllTime && scoped.undatedCompleted > 0 && `${scoped.undatedCompleted} completed deals have no legal closing date and appear only under All Time. `}
            Some fictional sample deals have filled-in demo dates.
          </span>
        </p>

        <ChartPager key={tab} pages={pages} page={subpage} onPage={setSubpage} testId={`report-${tab}`} />
      </div>
    </PageShell>
  )
}
