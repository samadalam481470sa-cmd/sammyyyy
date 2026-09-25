import React from 'react'
import {
  TrendingUp,
  Clock,
  DollarSign,
  PieChart,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'

interface KPICardsRowProps {
  activeDealsCount: number
  pendingDealsCount: number
  activeNwpTotal: number
  activePfEbitdaTotal: number
  needsAttentionCount: number
  selectedStatus: string
  needsAttentionActive: boolean
  onSelectActiveDeals: () => void
  onSelectPendingDeals: () => void
  onSelectNeedsAttention: () => void
}

export const KPICardsRow: React.FC<KPICardsRowProps> = ({
  activeDealsCount,
  pendingDealsCount,
  activeNwpTotal,
  activePfEbitdaTotal,
  needsAttentionCount,
  selectedStatus,
  needsAttentionActive,
  onSelectActiveDeals,
  onSelectPendingDeals,
  onSelectNeedsAttention,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Active Deals */}
      <button
        onClick={onSelectActiveDeals}
        className={`text-left p-4 rounded-xl bg-white border transition-all duration-200 group relative overflow-hidden ${
          selectedStatus === 'Active' && !needsAttentionActive
            ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md shadow-blue-500/5'
            : 'border-slate-200/90 hover:border-slate-300 shadow-subtle hover:shadow-card'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Active Deals
          </span>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">
            {activeDealsCount}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium flex items-center">
            <ArrowUpRight className="w-3 h-3 mr-0.5" />
            Live Pipeline
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400 truncate">
          Active acquisition evaluation
        </p>
      </button>

      {/* 2. Pending Deals */}
      <button
        onClick={onSelectPendingDeals}
        className={`text-left p-4 rounded-xl bg-white border transition-all duration-200 group relative overflow-hidden ${
          selectedStatus === 'Pending' && !needsAttentionActive
            ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md shadow-amber-500/5'
            : 'border-slate-200/90 hover:border-slate-300 shadow-subtle hover:shadow-card'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Pending Deals
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">
            {pendingDealsCount}
          </span>
          <span className="text-[11px] text-amber-600 font-medium">
            In Qualification
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400 truncate">
          Teasers & early outreach
        </p>
      </button>

      {/* 3. Active NWP */}
      <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-subtle relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active NWP
            </span>
            <span
              className="text-[10px] text-slate-400 cursor-help"
              title="Net Written Premium of active acquisition targets"
            >
              ⓘ
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">
            {formatCurrency(activeNwpTotal)}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400 truncate">
          Net Written Premium
        </p>
      </div>

      {/* 4. Active PF EBITDA */}
      <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-subtle relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active PF EBITDA
            </span>
            <span
              className="text-[10px] text-slate-400 cursor-help"
              title="Pro Forma EBITDA under active diligence"
            >
              ⓘ
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <PieChart className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">
            {formatCurrency(activePfEbitdaTotal)}
          </span>
          <span className="text-[11px] text-teal-600 font-medium">
            ~14.3% Margin
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400 truncate">
          Pro Forma EBITDA
        </p>
      </div>

      {/* 5. Needs Attention (Visually distinguished) */}
      <button
        onClick={onSelectNeedsAttention}
        className={`text-left p-4 rounded-xl border transition-all duration-200 group relative overflow-hidden ${
          needsAttentionActive
            ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-500/30 shadow-md'
            : 'bg-gradient-to-br from-amber-50/50 to-orange-50/30 border-amber-200/80 hover:border-amber-300 shadow-subtle hover:shadow-card'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center">
            <ShieldAlert className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Needs Attention
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-amber-950 tracking-tight">
            {needsAttentionCount}
          </span>
          <span className="text-[11px] font-semibold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded">
            Action Req.
          </span>
        </div>
        <p className="mt-1 text-[11px] text-amber-700/80 truncate">
          Overdue, deadlines & stalled
        </p>
      </button>
    </div>
  )
}
