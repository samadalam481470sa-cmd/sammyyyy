import clsx from 'clsx';
import { ChevronRight, GitBranch, X } from 'lucide-react';
import type { PipelineStageId } from '../../config/picklists';
import { formatCurrencyCompact } from '../../lib/format';
import type { StageSummary } from '../../lib/metrics';
import { Button } from '../ui/Button';
import { Card, CardFooter, CardHeader } from '../ui/Card';

interface PipelineOverviewProps {
  stages: StageSummary[];
  selectedStage: PipelineStageId | null;
  onSelectStage: (stage: PipelineStageId) => void;
  onClearStage: () => void;
  /** Status the pipeline is describing, e.g. "Active". */
  scopeLabel: string;
  totalCount: number;
  totalNwp: number;
}

/**
 * Horizontal view of the acquisition process. Selecting a stage filters the
 * Priority Deals table below.
 */
export function PipelineOverview({
  stages,
  selectedStage,
  onSelectStage,
  onClearStage,
  scopeLabel,
  totalCount,
  totalNwp,
}: PipelineOverviewProps) {
  return (
    <Card>
      <CardHeader
        title="Acquisition Pipeline"
        icon={<GitBranch className="size-4" />}
        subtitle={
          <>
            {totalCount} {scopeLabel.toLowerCase()} {totalCount === 1 ? 'opportunity' : 'opportunities'}
            <span className="mx-1.5 text-slate-300">|</span>
            {formatCurrencyCompact(totalNwp)} NWP in process
          </>
        }
        actions={
          selectedStage ? (
            <Button size="sm" variant="subtle" icon={<X className="size-3.5" />} onClick={onClearStage}>
              Clear stage
            </Button>
          ) : null
        }
      />

      <div className="scrollbar-slim overflow-x-auto px-5 py-5">
        <ol className="flex min-w-[860px] items-stretch gap-1">
          {stages.map((stage, index) => {
            const selected = stage.id === selectedStage;
            const empty = stage.count === 0;

            return (
              <li key={stage.id} className="flex min-w-0 flex-1 items-stretch">
                <button
                  type="button"
                  onClick={() => onSelectStage(stage.id)}
                  aria-pressed={selected}
                  className={clsx(
                    'flex w-full min-w-0 flex-col rounded-xl border px-3 py-3 text-left transition-all duration-150',
                    selected
                      ? 'border-navy-900 bg-navy-900 text-white shadow-card-hover'
                      : empty
                        ? 'border-dashed border-slate-200 bg-slate-50/60 hover:border-slate-300'
                        : 'border-slate-200 bg-white hover:-translate-y-px hover:border-navy-300 hover:shadow-card',
                  )}
                >
                  <span
                    className={clsx(
                      'truncate text-[10.5px] font-semibold uppercase tracking-[0.08em]',
                      selected ? 'text-navy-200' : empty ? 'text-slate-400' : 'text-slate-500',
                    )}
                    title={stage.label}
                  >
                    {stage.label}
                  </span>

                  <span
                    className={clsx(
                      'numeric mt-2 text-2xl font-semibold leading-none tracking-tight',
                      selected ? 'text-white' : empty ? 'text-slate-300' : 'text-navy-900',
                    )}
                  >
                    {stage.count}
                  </span>

                  <span
                    className={clsx(
                      'numeric mt-1 text-[11px]',
                      selected ? 'text-navy-200' : 'text-slate-500',
                    )}
                  >
                    {stage.count > 0 ? `${formatCurrencyCompact(stage.nwp)} NWP` : 'No deals'}
                  </span>

                  <span
                    className={clsx(
                      'mt-3 h-1 w-full overflow-hidden rounded-full',
                      selected ? 'bg-white/20' : 'bg-slate-100',
                    )}
                  >
                    <span
                      className={clsx(
                        'block h-full rounded-full transition-all duration-300',
                        selected ? 'bg-accent-300' : 'bg-accent-500/70',
                      )}
                      style={{ width: `${Math.max(stage.intensity * 100, stage.count > 0 ? 12 : 0)}%` }}
                    />
                  </span>
                </button>

                {index < stages.length - 1 ? (
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 self-center text-slate-300"
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      <CardFooter className="flex flex-wrap items-center justify-between gap-2">
        <span>Select a stage to filter the Priority Deals table below.</span>
        <span className="text-slate-400">
          Stage is the position in the acquisition process — separate from status.
        </span>
      </CardFooter>
    </Card>
  );
}
