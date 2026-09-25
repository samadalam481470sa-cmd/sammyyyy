import { AlarmClock, CalendarClock, CircleAlert, UserX, TimerOff } from 'lucide-react'
import type { AttentionReasonKind, EnrichedOpportunity } from '../../types'
import { Card } from '../common/Card'

const REASON_ICONS: Record<AttentionReasonKind, typeof CircleAlert> = {
  'overdue-next-action': AlarmClock,
  'missing-next-action': CircleAlert,
  stalled: TimerOff,
  'upcoming-deadline': CalendarClock,
  'no-deal-lead': UserX,
}

interface AttentionAlertsProps {
  opportunities: EnrichedOpportunity[]
  onSelect: (opportunity: EnrichedOpportunity) => void
}

export function AttentionAlerts({ opportunities, onSelect }: AttentionAlertsProps) {
  const flagged = opportunities.filter((o) => o.needsAttention)

  return (
    <Card title="Needs Attention" subtitle="Deals requiring follow-up or review" flush>
      {flagged.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-muted">
          Nothing requires attention right now.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {flagged.map((opp) => {
            const Icon = REASON_ICONS[opp.attentionReasons[0]?.kind ?? 'missing-next-action']
            return (
              <li key={opp.id}>
                <button
                  type="button"
                  onClick={() => onSelect(opp)}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#fff6f3]"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fde8e2] text-hub-600">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-brand-500 hover:underline">
                      {opp.projectName}
                    </p>
                    <ul className="mt-0.5 space-y-0.5">
                      {opp.attentionReasons.map((reason) => (
                        <li key={reason.kind} className="text-[11px] text-muted">
                          {reason.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
