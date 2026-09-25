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
        <p className="px-5 py-8 text-center text-sm text-slate-400">
          Nothing requires attention right now.
        </p>
      ) : (
        <ul className="divide-y divide-slate-50">
          {flagged.map((opp) => (
            <li key={opp.id}>
              <button
                type="button"
                onClick={() => onSelect(opp)}
                className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-amber-50/40"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  {(() => {
                    const Icon = REASON_ICONS[opp.attentionReasons[0]?.kind ?? 'missing-next-action']
                    return <Icon className="h-4 w-4" />
                  })()}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-navy-900">{opp.projectName}</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {opp.attentionReasons.map((reason) => (
                      <li key={reason.kind} className="text-xs text-slate-500">
                        {reason.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
