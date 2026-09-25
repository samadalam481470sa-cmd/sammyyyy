import { FileText, MessageSquare, RefreshCcw, ShieldCheck, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ActivityItem, ActivityType } from '../../types/opportunity';
import { formatRelativeTime } from '../../lib/dateUtils';

interface RecentActivityProps {
  activity: ActivityItem[];
}

const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  stage_change: ArrowUpRight,
  status_change: RefreshCcw,
  note: MessageSquare,
  document: FileText,
  diligence: ShieldCheck,
  task: CheckCircle2,
};

const ACTIVITY_ICON_STYLE: Record<ActivityType, string> = {
  stage_change: 'bg-accent-100 text-accent-700',
  status_change: 'bg-emerald-100 text-emerald-700',
  note: 'bg-slate-100 text-slate-600',
  document: 'bg-navy-50 text-navy-700',
  diligence: 'bg-amber-100 text-amber-700',
  task: 'bg-accent-100 text-accent-700',
};

export default function RecentActivity({ activity }: RecentActivityProps) {
  return (
    <section className="card-shadow flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-navy-900">Recent Activity</h2>
      <p className="mt-0.5 text-sm text-slate-500">Latest updates across the deal team</p>

      <ol className="mt-4 flex-1 space-y-4">
        {activity.map((item) => {
          const Icon = ACTIVITY_ICON[item.type];
          return (
            <li key={item.id} className="flex gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ACTIVITY_ICON_STYLE[item.type]}`}
              >
                <Icon size={15} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-navy-900">{item.actor.split(' ')[0]}</span> {item.message}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{formatRelativeTime(item.timestamp)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
