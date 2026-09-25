import type { CSSProperties } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { STAGES, STATUSES } from '../../config/picklists'
import type { EnrichedOpportunity } from '../../types'
import { Card } from '../common/Card'

/** Salesforce chart colors, with HubSpot orange for pending. */
const STATUS_COLORS: Record<string, string> = {
  active: '#0176d3',
  pending: '#ff7a59',
  inactive: '#939393',
  closed: '#706e6b',
  declined: '#ba0517',
  withdrew: '#c9c9c9',
  completed: '#2e844a',
}

const BAR_COLOR = '#0176d3'

interface DashboardChartsProps {
  /** The currently filtered set — charts respond to dashboard filters. */
  opportunities: EnrichedOpportunity[]
}

export function DashboardCharts({ opportunities }: DashboardChartsProps) {
  const byStatus = STATUSES.map((status) => ({
    name: status.label,
    id: status.id,
    value: opportunities.filter((o) => o.status === status.id).length,
  })).filter((d) => d.value > 0)

  const activeByStage = STAGES.map((stage) => ({
    name: stage.label,
    value: opportunities.filter((o) => o.status === 'active' && o.stage === stage.id).length,
  }))

  const hasActive = activeByStage.some((d) => d.value > 0)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Deals by Status" subtitle="All deals in the current view">
        {byStatus.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="flex items-center gap-4">
            <div className="h-52 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byStatus}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="88%"
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {byStatus.map((entry) => (
                      <Cell key={entry.id} fill={STATUS_COLORS[entry.id]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={formatDealCount} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-32 space-y-1.5">
              {byStatus.map((entry) => (
                <li key={entry.id} className="flex items-center gap-2 text-xs text-slate-600">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: STATUS_COLORS[entry.id] }}
                  />
                  <span className="flex-1 truncate">{entry.name}</span>
                  <span className="font-bold tabular-nums text-ink">{entry.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title="Active Deals by Stage" subtitle="Active deals in the current view">
        {!hasActive ? (
          <EmptyChart />
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeByStage} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9.5, fill: '#706e6b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e5e5' }}
                  interval={0}
                  angle={-32}
                  textAnchor="end"
                  height={58}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: '#706e6b' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: '#f3f3f3' }}
                  formatter={formatDealCount}
                />
                <Bar dataKey="value" fill={BAR_COLOR} radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  )
}

const formatDealCount = (value: unknown): [string] => {
  const count = typeof value === 'number' ? value : 0
  return [`${count} deal${count === 1 ? '' : 's'}`]
}

const tooltipStyle: CSSProperties = {
  fontSize: 12,
  borderRadius: 4,
  border: '1px solid #e5e5e5',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
}

function EmptyChart() {
  return (
    <div className="flex h-52 items-center justify-center text-sm text-slate-400">
      No deals match the current filters.
    </div>
  )
}
