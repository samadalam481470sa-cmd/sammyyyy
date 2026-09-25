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
      <ul className="divide-y divide-line">
        {activity.map((item) => {
          const Icon = KIND_ICONS[item.kind]
          return (
            <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <p className="min-w-0 flex-1 truncate text-[13px] text-ink">{item.message}</p>
              <span className="shrink-0 text-[11px] text-muted">
                {formatRelativeTime(item.timestamp)}
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
