import clsx from 'clsx';
import type { ReactNode } from 'react';

export type KPITone = 'default' | 'attention';

interface KPICardProps {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone?: KPITone;
  active?: boolean;
  onClick?: () => void;
  /** Expanded form of an abbreviation, shown on hover (NWP, PF EBITDA…). */
  title?: string;
}

export function KPICard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  active = false,
  onClick,
  title,
}: KPICardProps) {
  const attention = tone === 'attention';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      title={title}
      className={clsx(
        'group flex flex-col rounded-2xl border p-4 text-left shadow-card transition-all duration-150',
        attention ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200/80 bg-white',
        onClick && 'hover:-translate-y-px hover:shadow-card-hover',
        active && (attention ? 'ring-2 ring-amber-400/70' : 'ring-2 ring-accent-400/70'),
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {label}
        </span>
        <span
          className={clsx(
            'flex size-8 shrink-0 items-center justify-center rounded-lg',
            attention ? 'bg-amber-100 text-amber-700' : 'bg-navy-50 text-navy-700',
          )}
        >
          {icon}
        </span>
      </span>

      <span
        className={clsx(
          'numeric mt-3 text-[28px] font-semibold leading-none tracking-tight',
          attention ? 'text-amber-900' : 'text-navy-900',
        )}
      >
        {value}
      </span>

      <span className={clsx('mt-2 text-xs', attention ? 'text-amber-800/80' : 'text-slate-500')}>
        {hint}
      </span>
    </button>
  );
}
