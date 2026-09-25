import { ChartColumn, ChartPie } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { OpportunityStatusId, PipelineStageId } from '../../config/picklists';
import { formatCurrencyCompact } from '../../lib/format';
import type { StageSummary, StatusSummary } from '../../lib/metrics';
import { Card, CardHeader } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

interface DashboardChartsProps {
  statusData: StatusSummary[];
  stageData: StageSummary[];
  selectedStatus: OpportunityStatusId | null;
  selectedStage: PipelineStageId | null;
  stageScopeLabel: string;
  onSelectStatus: (status: OpportunityStatusId) => void;
  onSelectStage: (stage: PipelineStageId) => void;
}

const STAGE_COLOR = '#1c90ec';
const STAGE_COLOR_MUTED = '#bcdcf8';

/** Recharts hands back the datum (or a wrapper holding it) on click. */
function extractId(entry: unknown): string | null {
  if (!entry || typeof entry !== 'object') return null;
  const record = entry as Record<string, unknown>;
  if (typeof record.id === 'string') return record.id;
  const payload = record.payload as Record<string, unknown> | undefined;
  return payload && typeof payload.id === 'string' ? payload.id : null;
}

interface TooltipEntry {
  payload?: { label?: string; count?: number; nwp?: number };
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  const datum = active ? payload?.[0]?.payload : undefined;
  if (!datum) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-card-hover">
      <p className="text-xs font-semibold text-navy-900">{datum.label}</p>
      <p className="numeric mt-0.5 text-xs text-slate-600">
        {datum.count} {datum.count === 1 ? 'opportunity' : 'opportunities'}
        {typeof datum.nwp === 'number' && datum.nwp > 0
          ? ` · ${formatCurrencyCompact(datum.nwp)} NWP`
          : ''}
      </p>
    </div>
  );
}

export function DashboardCharts({
  statusData,
  stageData,
  selectedStatus,
  selectedStage,
  stageScopeLabel,
  onSelectStatus,
  onSelectStage,
}: DashboardChartsProps) {
  const statusSlices = statusData.filter((item) => item.count > 0);
  const stageBars = stageData.filter((item) => item.count > 0);
  const statusTotal = statusSlices.reduce((total, item) => total + item.count, 0);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Card className="flex flex-col">
        <CardHeader
          title="Deals by Status"
          icon={<ChartPie className="size-4" />}
          subtitle="Condition of every opportunity in view"
        />

        {statusSlices.length === 0 ? (
          <EmptyState icon={<ChartPie className="size-5" />} title="No opportunities in view" />
        ) : (
          <div className="flex flex-1 flex-col items-center gap-4 px-5 py-4 sm:flex-row">
            <div className="relative h-[190px] w-[190px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusSlices}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={58}
                    outerRadius={86}
                    paddingAngle={2}
                    stroke="#ffffff"
                    strokeWidth={2}
                    isAnimationActive={false}
                    onClick={(entry: unknown) => {
                      const id = extractId(entry);
                      if (id) onSelectStatus(id as OpportunityStatusId);
                    }}
                  >
                    {statusSlices.map((slice) => (
                      <Cell
                        key={slice.id}
                        fill={slice.color}
                        cursor="pointer"
                        opacity={!selectedStatus || selectedStatus === slice.id ? 1 : 0.25}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="numeric text-2xl font-semibold text-navy-900">{statusTotal}</span>
                <span className="text-[11px] uppercase tracking-[0.1em] text-slate-400">
                  Deals
                </span>
              </div>
            </div>

            <ul className="grid w-full flex-1 grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {statusSlices.map((slice) => (
                <li key={slice.id}>
                  <button
                    type="button"
                    onClick={() => onSelectStatus(slice.id)}
                    aria-pressed={selectedStatus === slice.id}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-slate-50"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: slice.color,
                        opacity: !selectedStatus || selectedStatus === slice.id ? 1 : 0.3,
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-slate-600">
                      {slice.label}
                    </span>
                    <span className="numeric text-[13px] font-semibold text-navy-900">
                      {slice.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card className="flex flex-col">
        <CardHeader
          title={`${stageScopeLabel} Deals by Stage`}
          icon={<ChartColumn className="size-4" />}
          subtitle="Position in the acquisition process"
        />

        {stageBars.length === 0 ? (
          <EmptyState
            icon={<ChartColumn className="size-5" />}
            title={`No ${stageScopeLabel.toLowerCase()} deals in view`}
            description="Adjust the filters above to populate this chart."
          />
        ) : (
          <div className="flex-1 px-3 py-4">
            <ResponsiveContainer width="100%" height={Math.max(190, stageBars.length * 30)}>
              <BarChart
                data={stageBars}
                layout="vertical"
                margin={{ top: 4, right: 28, bottom: 0, left: 8 }}
              >
                <CartesianGrid horizontal={false} stroke="#eef2f7" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={116}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#475569' }}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar
                  dataKey="count"
                  barSize={14}
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                  onClick={(entry: unknown) => {
                    const id = extractId(entry);
                    if (id) onSelectStage(id as PipelineStageId);
                  }}
                >
                  {stageBars.map((bar) => (
                    <Cell
                      key={bar.id}
                      cursor="pointer"
                      fill={
                        !selectedStage || selectedStage === bar.id ? STAGE_COLOR : STAGE_COLOR_MUTED
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
