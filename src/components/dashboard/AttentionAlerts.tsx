import React from 'react'
import { AttentionAlert } from '../../types/crm'
import {
  AlertTriangle,
  Clock,
  UserX,
  Calendar,
  AlertCircle,
  ArrowRight
} from 'lucide-react'

interface AttentionAlertsProps {
  alerts: AttentionAlert[]
  onSelectProject: (projectId: string) => void
}

export const AttentionAlerts: React.FC<AttentionAlertsProps> = ({
  alerts,
  onSelectProject,
}) => {
  const getIcon = (type: AttentionAlert['type']) => {
    switch (type) {
      case 'overdue_action':
        return <AlertCircle className="w-4 h-4 text-rose-600" />
      case 'upcoming_deadline':
        return <Calendar className="w-4 h-4 text-amber-600" />
      case 'stalled_activity':
        return <Clock className="w-4 h-4 text-orange-600" />
      case 'no_owner':
        return <UserX className="w-4 h-4 text-purple-600" />
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-600" />
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-subtle flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Needs Attention
            </h2>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-full">
              {alerts.length} Action Items
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Overdue tasks, upcoming deadlines, stalled diligence & unassigned deals
          </p>
        </div>
      </div>

      {/* Alert items */}
      <div className="mt-3 space-y-2.5 flex-1 overflow-y-auto">
        {alerts.map((alert) => {
          const isHigh = alert.severity === 'high'

          return (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border transition-all ${
                isHigh
                  ? 'bg-rose-50/40 border-rose-200/80 hover:border-rose-300'
                  : 'bg-amber-50/40 border-amber-200/80 hover:border-amber-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <div className="p-1 rounded-md bg-white shadow-xs">
                    {getIcon(alert.type)}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      {alert.title}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => onSelectProject(alert.projectId)}
                  className="inline-flex items-center space-x-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <span>{alert.projectName}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {alert.description}
              </p>

              <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">
                  Lead: <strong className="text-slate-700 font-semibold">{alert.dealLead}</strong>
                </span>
                <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200/60">
                  Req: {alert.actionNeeded}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
