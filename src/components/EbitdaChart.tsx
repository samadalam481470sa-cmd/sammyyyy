"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EbitdaRecord } from "@prisma/client";
import { formatUsd } from "@/lib/metrics";

export default function EbitdaChart({ records }: { records: EbitdaRecord[] }) {
  const data = [...records]
    .sort((a, b) => a.year - b.year)
    .map((r) => ({ year: r.year, EBITDA: r.ebitdaUsd, Revenue: r.revenueUsd ?? undefined }));

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        No historical EBITDA on file yet.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ebitdaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4267ee" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#4267ee" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
          <YAxis
            tickFormatter={(v) => formatUsd(v)}
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            formatter={(value: number) => formatUsd(value, false)}
            labelFormatter={(label) => `FY ${label}`}
            contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="EBITDA"
            stroke="#4267ee"
            strokeWidth={2}
            fill="url(#ebitdaFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
