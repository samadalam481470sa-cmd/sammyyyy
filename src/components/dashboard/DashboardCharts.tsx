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

/** Executive palette: navy scale with one light-blue accent, no loud colors. */
const STATUS_COLORS: Record<string, string> = {
  active: '#2a5f90',
  pending: '#d9a441',
  inactive: '#94a3b8',
  closed: '#64748b',
  declined: '#b06767',
  withdrew: '#a8b3c2',
  completed: '#5d9bd6',
}

const BAR_COLOR = '#2a5f90'

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
    <div className="grid gap-5 lg:grid-cols-2">
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
                  <span className="font-semibold tabular-nums text-navy-900">{entry.value}</span>
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
                  tick={{ fontSize: 9.5, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  interval={0}
                  angle={-32}
                  textAnchor="end"
                  height={58}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: '#f1f5f9' }}
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
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 12px rgba(12, 30, 54, 0.08)',
}

function EmptyChart() {
  return (
    <div className="flex h-52 items-center justify-center text-sm text-slate-400">
      No deals match the current filters.
    </div>
  )
}
