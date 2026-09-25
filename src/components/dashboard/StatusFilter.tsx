import clsx from 'clsx';
import { OPPORTUNITY_STATUSES } from '../../config/picklists';
import { ALL_STATUSES, type StatusFilterValue } from '../../lib/filtering';

interface StatusFilterProps {
  value: StatusFilterValue;
  counts: Record<string, number>;
  totalCount: number;
  onChange: (value: StatusFilterValue) => void;
}

/**
 * Status is the broad condition of an opportunity — distinct from the stage it
 * sits at inside the acquisition process.
 */
export function StatusFilter({ value, counts, totalCount, onChange }: StatusFilterProps) {
  const options: { id: StatusFilterValue; label: string; count: number }[] = [
    { id: ALL_STATUSES, label: 'All Deals', count: totalCount },
    ...OPPORTUNITY_STATUSES.map((status) => ({
      id: status.id as StatusFilterValue,
      label: status.label,
      count: counts[status.id] ?? 0,
    })),
  ];

  return (
    <div
      role="group"
      aria-label="Filter by status"
      className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-card"
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-150',
              selected
                ? 'bg-navy-900 text-white shadow-card'
                : 'text-slate-600 hover:bg-slate-100 hover:text-navy-900',
            )}
          >
            {option.label}
            <span
              className={clsx(
                'numeric rounded px-1.5 py-0.5 text-[11px] font-semibold',
                selected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500',
              )}
            >
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
