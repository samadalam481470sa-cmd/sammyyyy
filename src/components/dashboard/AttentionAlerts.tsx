import { AlertTriangle, ArrowRight } from 'lucide-react';
import { getAttentionReasons } from '../../lib/attention';
import type { Opportunity } from '../../types/opportunity';

interface AttentionAlertsProps {
  opportunities: Opportunity[];
  attentionOnly: boolean;
  onToggleAttentionOnly: () => void;
  onSelectOpportunity: (opportunity: Opportunity) => void;
}

export default function AttentionAlerts({
  opportunities,
  attentionOnly,
  onToggleAttentionOnly,
  onSelectOpportunity,
}: AttentionAlertsProps) {
  const flagged = opportunities
    .map((o) => ({ opportunity: o, reasons: getAttentionReasons(o) }))
    .filter((entry) => entry.reasons.length > 0);

  return (
    <section className="card-shadow flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={17} className="text-amber-500" />
          <h2 className="text-base font-semibold text-navy-900">Needs Attention</h2>
        </div>
        {flagged.length > 0 && (
          <button
            type="button"
            onClick={onToggleAttentionOnly}
            className={[
              'flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium transition-colors',
              attentionOnly ? 'bg-navy-900 text-white' : 'text-accent-700 hover:bg-accent-50',
            ].join(' ')}
          >
            {attentionOnly ? 'Showing only these' : 'View in pipeline'}
            <ArrowRight size={12} />
          </button>
        )}
      </div>
      <p className="mt-0.5 text-sm text-slate-500">Overdue actions, stalled deals, and coverage gaps</p>

      {flagged.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-8 text-center">
          <p className="text-sm font-medium text-slate-500">Nothing needs attention right now</p>
          <p className="text-xs text-slate-400">Active and pending deals are all on track.</p>
        </div>
      ) : (
        <ul className="mt-4 flex-1 space-y-2">
          {flagged.map(({ opportunity, reasons }) => (
            <li key={opportunity.id}>
              <button
                type="button"
                onClick={() => onSelectOpportunity(opportunity)}
                className="flex w-full items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-left transition-colors hover:border-amber-200 hover:bg-amber-50"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <AlertTriangle size={13} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-900">{opportunity.projectName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {reasons.map((r) => r.label).join(' · ')}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
