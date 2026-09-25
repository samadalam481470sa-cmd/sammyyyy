import React from 'react'
import { ActivityItem } from '../../types/crm'
import {
  FileText,
  MessageSquare,
  ArrowRightLeft,
  FileCheck2,
  CalendarCheck,
  TrendingUp
} from 'lucide-react'

interface RecentActivityProps {
  activities: ActivityItem[]
  onSelectProject: (projectId: string) => void
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  activities,
  onSelectProject,
}) => {
  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'stage_change':
        return <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
      case 'note':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
      case 'document':
        return <FileText className="w-3.5 h-3.5 text-indigo-600" />
      case 'status_change':
        return <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
      case 'loi_update':
        return <FileCheck2 className="w-3.5 h-3.5 text-amber-600" />
      default:
        return <CalendarCheck className="w-3.5 h-3.5 text-slate-600" />
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-subtle flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            Recent Activity
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Audit trail of pipeline events, notes and stage advancements
          </p>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">
          Live Feed
        </span>
      </div>

      {/* Activity Timeline */}
      <div className="mt-3 space-y-3 flex-1 overflow-y-auto">
        {activities.map((act) => {
          return (
            <div
              key={act.id}
              className="flex items-start space-x-3 text-xs group"
            >
              {/* User Avatar */}
              <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-semibold text-[10px] flex items-center justify-center flex-shrink-0 ring-2 ring-slate-100 mt-0.5">
                {act.avatar || act.user.split(' ').map(n => n[0]).join('')}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-slate-700 leading-snug">
                  <strong className="text-slate-900 font-semibold">{act.user}</strong>{' '}
                  <span className="text-slate-600">{act.actionText}</span>
                </div>
                <div className="mt-1 flex items-center space-x-2 text-[10px] text-slate-400">
                  <span className="flex items-center space-x-1">
                    {getActivityIcon(act.type)}
                    <button
                      onClick={() => onSelectProject(act.projectId)}
                      className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                    >
                      {act.projectName}
                    </button>
                  </span>
                  <span>•</span>
                  <span>{act.timestamp}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
