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

/** Salesforce dashboard metric tile, with a HubSpot-orange bar when it needs attention. */
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
      className={`rounded-[4px] border bg-white px-4 pt-3 pb-3.5 text-left shadow-[0_2px_2px_rgba(0,0,0,0.05)] transition-colors ${
        selected ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line hover:border-[#c9c9c9]'
      }`}
    >
      <span className={`mb-2.5 block h-1 w-8 rounded-full ${attention ? 'bg-hub-500' : 'bg-brand-500'}`} />
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${attention ? 'text-hub-500' : 'text-brand-500'}`} />
        <p className="text-[11px] font-bold tracking-wide text-muted uppercase">{label}</p>
      </div>
      <p className="mt-1 text-[26px] leading-none font-bold tracking-tight text-ink">{value}</p>
      {caption && <p className="mt-1.5 text-[11px] text-muted">{caption}</p>}
    </button>
  )
}
