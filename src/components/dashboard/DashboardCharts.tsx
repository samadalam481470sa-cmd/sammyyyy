import React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie
} from 'recharts'
import { Opportunity } from '../../types/crm'
import { OPPORTUNITY_STATUSES, ACQUISITION_STAGES } from '../../types/constants'
import { formatCurrency } from '../../utils/formatters'

interface DashboardChartsProps {
  opportunities: Opportunity[]
  onSelectStatus?: (status: string) => void
  onSelectStage?: (stage: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  Active: '#2563EB',
  Pending: '#F59E0B',
  Inactive: '#64748B',
  Closed: '#3B82F6',
  Declined: '#EF4444',
  Withdrew: '#A855F7',
  Completed: '#10B981',
}

const STAGE_BAR_COLORS = [
  '#94A3B8',
  '#64748B',
  '#0284C7',
  '#2563EB',
  '#4F46E5',
  '#7C3AED',
  '#9333EA',
  '#C026D3',
  '#059669',
]

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: { name: string; count: number; nwp: number } }>
}

const CustomBarTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-lg border border-slate-800">
        <div className="font-bold">{data.name}</div>
        <div className="text-slate-300 mt-1">Opportunities: <strong className="text-white">{data.count}</strong></div>
        {data.nwp > 0 && (
          <div className="text-slate-300">Aggregate NWP: <strong className="text-blue-300">{formatCurrency(data.nwp)}</strong></div>
        )}
      </div>
    )
  }
  return null
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  opportunities,
  onSelectStatus,
  onSelectStage,
}) => {
  // Chart 1 Data: Deals by Status
  const statusData = OPPORTUNITY_STATUSES.map((status) => {
    const matching = opportunities.filter((o) => o.status === status)
    return {
      name: status,
      count: matching.length,
      nwp: matching.reduce((sum, o) => sum + o.nwp, 0),
      color: STATUS_COLORS[status] || '#64748B'
    }
  }).filter((item) => item.count > 0)

  // Chart 2 Data: Active Deals by Stage
  const activeOpportunities = opportunities.filter((o) => o.status === 'Active')
  const stageData = ACQUISITION_STAGES.map((stage, idx) => {
    const matching = activeOpportunities.filter((o) => o.stage === stage)
    return {
      name: stage,
      shortName: stage.length > 12 ? stage.split(' ')[0] : stage,
      count: matching.length,
      nwp: matching.reduce((sum, o) => sum + o.nwp, 0),
      color: STAGE_BAR_COLORS[idx % STAGE_BAR_COLORS.length]
    }
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* CHART 1: Deals by Status */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-subtle flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Deals by Status
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Portfolio distribution across all qualification & deal stages
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {opportunities.length} Total Targets
          </span>
        </div>

        <div className="mt-4 flex-1 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-1/2 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  cursor="pointer"
                  onClick={(entry) => {
                    const name = (entry as { name?: string })?.name
                    if (name && onSelectStatus) onSelectStatus(name)
                  }}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomBarTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="w-full sm:w-1/2 space-y-1.5 text-xs">
            {statusData.map((item) => (
              <button
                key={item.name}
                onClick={() => onSelectStatus && onSelectStatus(item.name)}
                className="w-full flex items-center justify-between p-1.5 rounded hover:bg-slate-50 transition-colors text-left group"
              >
                <div className="flex items-center space-x-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-slate-700 group-hover:text-slate-900">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-900">{item.count}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({formatCurrency(item.nwp)})
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CHART 2: Active Deals by Stage */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-subtle flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Active Deals by Stage
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Live progression of evaluated MGA acquisitions
            </p>
          </div>
          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-full">
            {activeOpportunities.length} In Progress
          </span>
        </div>

        <div className="mt-4 flex-1 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stageData}
              margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
            >
              <XAxis
                dataKey="shortName"
                angle={-30}
                textAnchor="end"
                interval={0}
                tick={{ fontSize: 9, fill: '#64748B' }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: '#64748B' }}
              />
              <Tooltip content={<CustomBarTooltip />} />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(entry) => {
                  const name = (entry as { name?: string })?.name
                  if (name && onSelectStage) onSelectStage(name)
                }}
              >
                {stageData.map((entry, index) => (
                  <Cell
                    key={`bar-${index}`}
                    fill={entry.count > 0 ? '#2563EB' : '#E2E8F0'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
