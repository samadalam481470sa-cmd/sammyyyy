import { cn } from "../../lib/cn.ts"
import type { ReactNode } from "react"

export function KPICard({
  label,
  value,
  detail,
  tone = "default",
  selected = false,
  onClick,
}: {
  label: string
  value: string
  detail: string
  tone?: "default" | "attention"
  selected?: boolean
  onClick?: () => void
}) {
  const className = cn(
    "card flex min-h-[118px] w-full flex-col px-4 py-4 text-left",
    tone === "attention" && "card-attention",
    onClick && "hover:border-navy-700/20",
    selected && tone === "attention" && "ring-2 ring-amber/40",
    selected && tone !== "attention" && "ring-2 ring-navy-800/25",
  )
  const body: ReactNode = (
    <>
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{label}</p>
      <p className={cn("mt-2 text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums", tone === "attention" ? "text-amber" : "text-ink")}>
        {value}
      </p>
      <p className="mt-3 text-xs text-muted">{detail}</p>
    </>
  )

  if (!onClick) return <div className={className}>{body}</div>

  return (
    <button type="button" className={className} onClick={onClick} aria-pressed={selected}>
      {body}
    </button>
  )
}
