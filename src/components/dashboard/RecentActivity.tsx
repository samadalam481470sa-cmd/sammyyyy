import { FileUp, Flag, History, MoveRight, PhoneCall, RefreshCw, StickyNote } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatRelativeTime } from '../../lib/format';
import type { ActivityEvent, ActivityKind, OpportunityView } from '../../types';
import { Card, CardHeader } from '../ui/Card';

interface RecentActivityProps {
  events: ActivityEvent[];
  opportunitiesById: Map<string, OpportunityView>;
  onSelect: (opportunity: OpportunityView) => void;
}

const KIND_ICONS: Record<ActivityKind, LucideIcon> = {
  stage_change: MoveRight,
  status_change: RefreshCw,
  note: StickyNote,
  document: FileUp,
  meeting: PhoneCall,
  task: Flag,
};

export function RecentActivity({ events, opportunitiesById, onSelect }: RecentActivityProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Recent Activity"
        icon={<History className="size-4" />}
        subtitle="Across the Newport deal team"
      />

      <ol className="flex-1 px-5 py-4">
        {events.map((event, index) => {
          const Icon = KIND_ICONS[event.kind];
          const opportunity = opportunitiesById.get(event.opportunityId);
          const isLast = index === events.length - 1;

          return (
            <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
              {!isLast ? (
                <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-slate-200" />
              ) : null}

              <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                <Icon className="size-3.5" />
              </span>

              <span className="min-w-0 flex-1 pt-1">
                <button
                  type="button"
                  disabled={!opportunity}
                  onClick={() => opportunity && onSelect(opportunity)}
                  className="block w-full text-left text-[13.5px] leading-snug text-navy-900 transition-colors hover:text-accent-700 disabled:hover:text-navy-900"
                >
                  {event.description}
                </button>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {event.actor}
                  <span className="mx-1.5 text-slate-300">|</span>
                  {formatRelativeTime(event.timestamp)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
