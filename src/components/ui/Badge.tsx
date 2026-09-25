import clsx from 'clsx';
import type { ReactNode } from 'react';
import {
  getPriority,
  getStatus,
  stageLabel,
  type BadgeTone,
  type OpportunityStatusId,
  type PipelineStageId,
  type PriorityId,
} from '../../config/picklists';

const TONE_STYLES: Record<BadgeTone, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  accent: 'bg-accent-50 text-accent-700 ring-accent-600/20',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  stone: 'bg-stone-100 text-stone-600 ring-stone-500/20',
  teal: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  navy: 'bg-navy-50 text-navy-700 ring-navy-600/20',
};

const DOT_STYLES: Record<BadgeTone, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  slate: 'bg-slate-400',
  accent: 'bg-accent-500',
  rose: 'bg-rose-500',
  stone: 'bg-stone-400',
  teal: 'bg-teal-500',
  navy: 'bg-navy-700',
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  withDot?: boolean;
  className?: string;
}

export function Badge({ tone = 'slate', children, withDot = false, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONE_STYLES[tone],
        className,
      )}
    >
      {withDot ? <span className={clsx('size-1.5 rounded-full', DOT_STYLES[tone])} /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: OpportunityStatusId }) {
  const config = getStatus(status);
  return (
    <Badge tone={config?.tone ?? 'slate'} withDot>
      {config?.label ?? status}
    </Badge>
  );
}

/** Stage is a process position, so it is styled neutrally against Status. */
export function StageBadge({ stage }: { stage: PipelineStageId }) {
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50/80 px-2 py-0.5 text-xs font-medium text-slate-700">
      {stageLabel(stage)}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: PriorityId }) {
  const config = getPriority(priority);
  return (
    <span
      className={clsx(
        'inline-flex size-6 items-center justify-center rounded-md text-xs font-semibold ring-1 ring-inset',
        TONE_STYLES[config?.tone ?? 'slate'],
      )}
      title={config?.description}
    >
      {config?.label ?? priority}
    </span>
  );
}
