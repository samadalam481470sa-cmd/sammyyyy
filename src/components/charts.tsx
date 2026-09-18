"use client";

import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  formatPercent,
  formatSignedPercent,
  formatUsd,
  formatUsdCompact,
} from "@/lib/format";

export type EbitdaChartPoint = {
  fiscalYear: number;
  ebitdaUsd: number;
  revenueUsd: number;
  yoyGrowth: number | null;
  isProjected: boolean;
  isAudited: boolean;
};

const ACTUAL_FILL = "#245c92";
const PROJECTED_FILL = "#92badf";
const GROWTH_STROKE = "#c9851d";

/**
 * EBITDA history for a single MGA: bars for the dollars, a line for the
 * year-over-year rate. Projected years are drawn in a lighter fill and labelled
 * in the tooltip so a forecast is never mistaken for an actual.
 */
export function EbitdaTrendChart({ data }: { data: EbitdaChartPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="fiscalYear"
            tickLine={false}
            axisLine={{ stroke: "#cbd5e1" }}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <YAxis
            yAxisId="dollars"
            tickFormatter={(value: number) => formatUsdCompact(value)}
            tickLine={false}
            axisLine={false}
            width={62}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <YAxis
            yAxisId="rate"
            orientation="right"
            tickFormatter={(value: number) => formatPercent(value, 0)}
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 12, fill: "#a66518" }}
          />
          <Tooltip content={<EbitdaTooltip />} />
          <Bar
            yAxisId="dollars"
            dataKey="ebitdaUsd"
            name="EBITDA"
            radius={[3, 3, 0, 0]}
            maxBarSize={56}
          >
            {data.map((point) => (
              <Cell
                key={point.fiscalYear}
                fill={point.isProjected ? PROJECTED_FILL : ACTUAL_FILL}
              />
            ))}
          </Bar>
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="yoyGrowth"
            name="YoY growth"
            stroke={GROWTH_STROKE}
            strokeWidth={2}
            dot={{ r: 3, fill: GROWTH_STROKE }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

type TooltipPayload = {
  payload?: EbitdaChartPoint;
};

function EbitdaTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">
        FY{point.fiscalYear}
        {point.isProjected && (
          <span className="ml-2 rounded bg-navy-100 px-1.5 py-0.5 text-[10px] font-semibold text-navy-700">
            Projected
          </span>
        )}
        {!point.isProjected && point.isAudited && (
          <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            Audited
          </span>
        )}
      </p>
      <dl className="mt-1.5 space-y-0.5 tabular">
        <div className="flex justify-between gap-6">
          <dt className="text-slate-500">EBITDA</dt>
          <dd className="font-medium text-slate-900">
            {formatUsd(point.ebitdaUsd)}
          </dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-slate-500">Revenue</dt>
          <dd className="font-medium text-slate-900">
            {formatUsd(point.revenueUsd)}
          </dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-slate-500">YoY growth</dt>
          <dd className="font-medium text-slate-900">
            {formatSignedPercent(point.yoyGrowth)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export type PlatformChartPoint = {
  fiscalYear: number;
  ebitdaUsd: number;
  writtenPremiumUsd: number;
  contributingMgaCount: number;
  yoyGrowth: number | null;
};

/**
 * Aggregate EBITDA across acquired MGAs. The tooltip names how many MGAs
 * contributed to each year, because a step up on this chart can be an
 * acquisition rather than organic growth.
 */
export function PlatformEbitdaChart({ data }: { data: PlatformChartPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="platformEbitda" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#245c92" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#245c92" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="fiscalYear"
            tickLine={false}
            axisLine={{ stroke: "#cbd5e1" }}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <YAxis
            tickFormatter={(value: number) => formatUsdCompact(value)}
            tickLine={false}
            axisLine={false}
            width={62}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <Tooltip content={<PlatformTooltip />} />
          <Area
            type="monotone"
            dataKey="ebitdaUsd"
            name="Platform EBITDA"
            stroke="#245c92"
            strokeWidth={2}
            fill="url(#platformEbitda)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function PlatformTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: PlatformChartPoint }[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">FY{point.fiscalYear}</p>
      <dl className="mt-1.5 space-y-0.5 tabular">
        <div className="flex justify-between gap-6">
          <dt className="text-slate-500">Aggregate EBITDA</dt>
          <dd className="font-medium text-slate-900">
            {formatUsd(point.ebitdaUsd)}
          </dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-slate-500">Written premium</dt>
          <dd className="font-medium text-slate-900">
            {formatUsd(point.writtenPremiumUsd)}
          </dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-slate-500">YoY growth</dt>
          <dd className="font-medium text-slate-900">
            {formatSignedPercent(point.yoyGrowth)}
          </dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-slate-500">MGAs reporting</dt>
          <dd className="font-medium text-slate-900">
            {point.contributingMgaCount}
          </dd>
        </div>
      </dl>
    </div>
  );
}
