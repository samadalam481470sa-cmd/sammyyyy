import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { STAGES, STATUSES } from '../../data/constants';
import type { Opportunity } from '../../types/opportunity';

interface DashboardChartsProps {
  /** Opportunities already scoped by the dashboard's active filters. */
  opportunities: Opportunity[];
}

const STATUS_BAR_COLORS: Record<string, string> = {
  Active: '#10b981',
  Pending: '#f59e0b',
  Inactive: '#94a3b8',
  Closed: '#1e3d61',
  Declined: '#f43f5e',
  Withdrew: '#fb923c',
  Completed: '#3d92bd',
};

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; value: number } }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const { label, value } = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-navy-900">{label}</p>
      <p className="text-slate-500">{value} deal{value === 1 ? '' : 's'}</p>
    </div>
  );
}

export default function DashboardCharts({ opportunities }: DashboardChartsProps) {
  const statusData = STATUSES.map((s) => ({
    label: s.label,
    value: opportunities.filter((o) => o.status === s.id).length,
  }));

  const activeOnly = opportunities.filter((o) => o.status === 'Active');
  const stageData = STAGES.map((s) => ({
    label: s.shortLabel,
    value: activeOnly.filter((o) => o.stage === s.id).length,
  }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="card-shadow rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-navy-900">Deals by Status</h2>
        <p className="mt-0.5 text-sm text-slate-500">Distribution across the current filter</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#eef2f7" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={44}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15, 35, 64, 0.04)' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                {statusData.map((entry) => (
                  <Cell key={entry.label} fill={STATUS_BAR_COLORS[entry.label] ?? '#2c5378'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card-shadow rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-navy-900">Active Deals by Stage</h2>
        <p className="mt-0.5 text-sm text-slate-500">Where active opportunities sit in the process</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stageData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#eef2f7" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10.5, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={50}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15, 35, 64, 0.04)' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40} fill="#3d92bd" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
