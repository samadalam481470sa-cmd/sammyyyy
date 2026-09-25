import type { LucideIcon } from 'lucide-react'

interface KPICardProps {
  label: string
  value: string
  caption?: string
  icon: LucideIcon
  /** Slightly emphasized styling for the Needs Attention card. */
  emphasis?: 'default' | 'attention'
  selected?: boolean
  onClick?: () => void
}

export function KPICard({
  label,
  value,
  caption,
  icon: Icon,
  emphasis = 'default',
  selected = false,
  onClick,
}: KPICardProps) {
  const attention = emphasis === 'attention'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md ${
        selected
          ? 'border-navy-500 ring-2 ring-navy-100'
          : attention
            ? 'border-amber-200 hover:border-amber-300'
            : 'border-slate-200 hover:border-navy-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            attention ? 'bg-amber-50 text-amber-600' : 'bg-navy-50 text-navy-600'
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p
        className={`mt-2 text-2xl font-semibold tracking-tight ${
          attention ? 'text-amber-700' : 'text-navy-900'
        }`}
      >
        {value}
      </p>
      {caption && <p className="mt-1 text-[11px] text-slate-400">{caption}</p>}
    </button>
  )
}
