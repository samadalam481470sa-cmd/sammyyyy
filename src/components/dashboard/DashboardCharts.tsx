import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { ChartPoint } from "../../lib/dashboardModel.ts"
import { stageFromChartLabel, statusFromChartLabel } from "../../lib/dashboardModel.ts"
import { useCrm } from "../../context/useCrm.ts"

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value ?? 0
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-ink">{label}</p>
      <p className="text-muted">
        {value} {value === 1 ? "deal" : "deals"}
      </p>
    </div>
  )
}

function HorizontalBars({
  data,
  selectedLabel,
  onSelect,
  summary,
}: {
  data: ChartPoint[]
  selectedLabel: string | null
  onSelect: (label: string) => void
  summary: string
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">No deals in this view.</p>
  }

  const height = Math.max(220, data.length * 36)

  return (
    <div role="img" aria-label={summary} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 4, bottom: 4 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={148}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#5c6c7c", fontSize: 12 }}
          />
          <Tooltip cursor={{ fill: "rgba(20, 50, 77, 0.04)" }} content={<ChartTooltip />} />
          <Bar
            dataKey="count"
            barSize={12}
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(state: { label?: string }) => {
              if (state.label) onSelect(state.label)
            }}
          >
            {data.map((point) => (
              <Cell key={point.label} fill={point.label === selectedLabel ? "#0B1C2E" : "#7EABCB"} />
            ))}
            <LabelList dataKey="count" position="right" fill="#5c6c7c" fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DashboardCharts({
  statusData,
  stageData,
  stageTitle,
}: {
  statusData: ChartPoint[]
  stageData: ChartPoint[]
  stageTitle: string
}) {
  const { filters, setStatus, selectStage } = useCrm()
  const statusSummary = statusData.map((point) => `${point.label} ${point.count}`).join(", ") || "No deals"
  const stageSummary = stageData.map((point) => `${point.label} ${point.count}`).join(", ") || "No deals"

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="card p-5" aria-labelledby="status-chart-heading">
        <h2 id="status-chart-heading" className="text-[15px] font-semibold tracking-tight text-ink">
          Deals by Status
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted">Broad condition of the book. Status is separate from stage.</p>
        <HorizontalBars
          data={statusData}
          selectedLabel={filters.status === "All" ? null : filters.status}
          summary={`Deals by status. ${statusSummary}.`}
          onSelect={(label) => {
            const status = statusFromChartLabel(label)
            if (status) setStatus(status)
          }}
        />
      </section>
      <section className="card p-5" aria-labelledby="stage-chart-heading">
        <h2 id="stage-chart-heading" className="text-[15px] font-semibold tracking-tight text-ink">
          {stageTitle}
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted">Where work sits inside the acquisition process.</p>
        <HorizontalBars
          data={stageData}
          selectedLabel={filters.stage}
          summary={`${stageTitle}. ${stageSummary}.`}
          onSelect={(label) => {
            const stage = stageFromChartLabel(label)
            if (stage) selectStage(stage)
          }}
        />
      </section>
    </div>
  )
}
