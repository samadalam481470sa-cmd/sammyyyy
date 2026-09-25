import { ChevronRight } from 'lucide-react';
import { STAGES } from '../../data/constants';
import { formatUsdCompact } from '../../lib/format';
import type { Opportunity, OpportunityStage } from '../../types/opportunity';

interface PipelineOverviewProps {
  /** Opportunities to summarize — expected to already be scoped to Active deals. */
  opportunities: Opportunity[];
  selectedStage: OpportunityStage | null;
  onSelectStage: (stage: OpportunityStage) => void;
}

interface StageSummary {
  stage: OpportunityStage;
  label: string;
  count: number;
  nwpTotal: number;
}

function summarizeByStage(opportunities: Opportunity[]): StageSummary[] {
  return STAGES.map((stage) => {
    const inStage = opportunities.filter((o) => o.stage === stage.id);
    return {
      stage: stage.id,
      label: stage.label,
      count: inStage.length,
      nwpTotal: inStage.reduce((sum, o) => sum + o.nwp, 0),
    };
  });
}

export default function PipelineOverview({ opportunities, selectedStage, onSelectStage }: PipelineOverviewProps) {
  const summaries = summarizeByStage(opportunities);
  const totalActive = opportunities.length;

  return (
    <section className="card-shadow rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-navy-900">Acquisition Pipeline</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Active opportunities by acquisition stage &middot; {totalActive} active
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-stretch gap-1.5 overflow-x-auto pb-1">
        {summaries.map((summary, index) => {
          const isSelected = selectedStage === summary.stage;
          const isEmpty = summary.count === 0;
          return (
            <div key={summary.stage} className="flex items-stretch">
              <button
                type="button"
                onClick={() => !isEmpty && onSelectStage(summary.stage)}
                disabled={isEmpty}
                title={`${summary.label}: ${summary.count} deal${summary.count === 1 ? '' : 's'}`}
                className={[
                  'flex w-[132px] shrink-0 flex-col gap-2 rounded-lg border px-3 py-3 text-left transition-all',
                  isSelected
                    ? 'border-navy-800 bg-navy-900 text-white shadow-md'
                    : isEmpty
                      ? 'border-slate-100 bg-slate-50/60 text-slate-300 cursor-default'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-accent-300 hover:bg-accent-50',
                ].join(' ')}
              >
                <span
                  className={[
                    'text-[11px] font-semibold uppercase tracking-wide',
                    isSelected ? 'text-accent-200' : isEmpty ? 'text-slate-300' : 'text-slate-500',
                  ].join(' ')}
                >
                  {summary.label}
                </span>
                <span className={['text-2xl font-bold tabular-nums', isSelected ? 'text-white' : 'text-navy-900'].join(' ')}>
                  {summary.count}
                </span>
                <span className={['text-xs font-medium tabular-nums', isSelected ? 'text-accent-200' : 'text-slate-400'].join(' ')}>
                  {summary.nwpTotal > 0 ? `${formatUsdCompact(summary.nwpTotal)} NWP` : '—'}
                </span>
              </button>
              {index < summaries.length - 1 && (
                <div className="flex items-center px-0.5 text-slate-300">
                  <ChevronRight size={16} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
