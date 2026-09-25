import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  helpText?: string;
  emphasis?: boolean;
  active?: boolean;
  onClick?: () => void;
}

/**
 * A single executive summary metric. `emphasis` gives the "Needs Attention"
 * card a slightly warmer treatment without making the dashboard feel
 * alarming overall.
 */
export default function KPICard({ label, value, icon: Icon, helpText, emphasis, active, onClick }: KPICardProps) {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'card-shadow flex min-w-0 flex-1 basis-[200px] items-center gap-4 rounded-xl border p-4 text-left transition-all',
        emphasis
          ? 'border-amber-200 bg-amber-50/60'
          : 'border-slate-200 bg-white',
        onClick ? 'hover:card-shadow-lg hover:-translate-y-0.5 cursor-pointer' : '',
        active ? 'ring-2 ring-accent-400 ring-offset-1' : '',
      ].join(' ')}
    >
      <div
        className={[
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
          emphasis ? 'bg-amber-100 text-amber-600' : 'bg-navy-50 text-navy-700',
        ].join(' ')}
      >
        <Icon size={20} strokeWidth={1.9} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-navy-900">{value}</p>
        {helpText && <p className="mt-0.5 truncate text-xs text-slate-400">{helpText}</p>}
      </div>
    </Wrapper>
  );
}
