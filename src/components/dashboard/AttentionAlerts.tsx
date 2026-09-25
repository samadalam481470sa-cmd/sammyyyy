import clsx from 'clsx';
import { CheckCircle2, ChevronRight, TriangleAlert } from 'lucide-react';
import type { AttentionFlag, OpportunityView } from '../../types';
import { Button } from '../ui/Button';
import { Card, CardFooter, CardHeader } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

interface AttentionAlertsProps {
  opportunities: OpportunityView[];
  attentionOnly: boolean;
  onToggleAttentionOnly: () => void;
  onSelect: (opportunity: OpportunityView) => void;
}

const SEVERITY_STYLES: Record<AttentionFlag['severity'], string> = {
  high: 'bg-amber-100 text-amber-800 ring-amber-600/20',
  medium: 'bg-amber-50 text-amber-700 ring-amber-500/20',
  low: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

export function AttentionAlerts({
  opportunities,
  attentionOnly,
  onToggleAttentionOnly,
  onSelect,
}: AttentionAlertsProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Needs Attention"
        icon={<TriangleAlert className="size-4" />}
        subtitle="Overdue, unowned, stalled or deadline-driven"
        actions={
          opportunities.length > 0 ? (
            <Button
              size="sm"
              variant={attentionOnly ? 'primary' : 'subtle'}
              onClick={onToggleAttentionOnly}
              aria-pressed={attentionOnly}
            >
              {attentionOnly ? 'Showing only these' : 'Filter dashboard'}
            </Button>
          ) : null
        }
      />

      {opportunities.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="size-5" />}
          title="Nothing needs attention"
          description="Every opportunity in view has an owner and a scheduled next action."
        />
      ) : (
        <ul className="flex-1 divide-y divide-slate-100">
          {opportunities.map((opportunity) => (
            <li key={opportunity.id}>
              <button
                type="button"
                onClick={() => onSelect(opportunity)}
                className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-amber-50/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-navy-900">
                      {opportunity.projectName}
                    </span>
                    <span className="truncate text-xs text-slate-500">{opportunity.entityName}</span>
                  </span>

                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {opportunity.attentionFlags.map((flag) => (
                      <span
                        key={flag.reason}
                        title={flag.detail}
                        className={clsx(
                          'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                          SEVERITY_STYLES[flag.severity],
                        )}
                      >
                        {flag.label}
                      </span>
                    ))}
                  </span>
                </span>

                <ChevronRight className="mt-1 size-4 shrink-0 text-slate-300" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <CardFooter>
        Rules: overdue or missing next action, no activity in 30+ days, deadline within 7 days, or no
        deal lead.
      </CardFooter>
    </Card>
  );
}
