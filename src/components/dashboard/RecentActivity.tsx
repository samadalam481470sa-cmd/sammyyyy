import {
  ArrowRightLeft,
  FileSignature,
  FileUp,
  StickyNote,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import type { ActivityItem, ActivityKind } from '../../types'
import { formatRelativeTime } from '../../lib/format'
import { Card } from '../common/Card'

const KIND_ICONS: Record<ActivityKind, LucideIcon> = {
  'stage-change': TrendingUp,
  'status-change': ArrowRightLeft,
  note: StickyNote,
  document: FileUp,
  loi: FileSignature,
}

interface RecentActivityProps {
  activity: ActivityItem[]
}

export function RecentActivity({ activity }: RecentActivityProps) {
  return (
    <Card title="Recent Activity" subtitle="Latest updates across the team" flush>
      <ul className="divide-y divide-slate-50">
        {activity.map((item) => {
          const Icon = KIND_ICONS[item.kind]
          return (
            <li key={item.id} className="flex items-center gap-3 px-5 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-50 text-navy-600">
                <Icon className="h-4 w-4" />
              </span>
              <p className="min-w-0 flex-1 truncate text-[13px] text-slate-700">{item.message}</p>
              <span className="shrink-0 text-xs text-slate-400">
                {formatRelativeTime(item.timestamp)}
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
