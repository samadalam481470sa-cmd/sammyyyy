import { STATUS_FILTER_OPTIONS, type StatusFilterValue } from '../../data/constants';

interface StatusFilterProps {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
}

/**
 * Broad lifecycle filter for opportunities. Deliberately separate from
 * "Stage" (see PipelineOverview) — status is the condition of the deal,
 * stage is where it sits within the acquisition process.
 */
export default function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
      {STATUS_FILTER_OPTIONS.map((option) => {
        const isActive = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={isActive}
            className={[
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-navy-900 text-white shadow-sm'
                : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-navy-800',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
