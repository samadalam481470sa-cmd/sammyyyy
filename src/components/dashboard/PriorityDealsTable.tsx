import React, { useState } from 'react'
import { Opportunity } from '../../types/crm'
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../types/constants'
import { formatCurrency, formatDate } from '../../utils/formatters'
import {
  ArrowUpDown,
  AlertTriangle,
  ChevronRight,
  Shield,
  Layers,
  Calendar,
  UserCheck,
  CheckCircle2
} from 'lucide-react'

interface PriorityDealsTableProps {
  deals: Opportunity[]
  onSelectDeal: (deal: Opportunity) => void
  totalCount: number
}

type SortField = 'projectName' | 'entityName' | 'status' | 'stage' | 'dealLead' | 'nwp' | 'netRevenue' | 'pfEbitda' | 'nextActionDate'

export const PriorityDealsTable: React.FC<PriorityDealsTableProps> = ({
  deals,
  onSelectDeal,
  totalCount,
}) => {
  const [sortField, setSortField] = useState<SortField>('nwp')
  const [sortAsc, setSortAsc] = useState(false)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false) // default descending for metrics
    }
  }

  const sortedDeals = [...deals].sort((a, b) => {
    let aVal = a[sortField] ?? ''
    let bVal = b[sortField] ?? ''

    if (typeof aVal === 'string') {
      const cmp = aVal.localeCompare(bVal as string)
      return sortAsc ? cmp : -cmp
    }

    if (typeof aVal === 'number') {
      return sortAsc ? (aVal - (bVal as number)) : ((bVal as number) - aVal)
    }

    return 0
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-subtle overflow-hidden">
      {/* Table Header Controls */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Priority Deals
            </h2>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Showing {sortedDeals.length} of {totalCount}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Confidential acquisition targets, financial metrics, ownership and next milestone actions
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <span className="flex items-center text-[11px]">
            <Shield className="w-3.5 h-3.5 text-blue-600 mr-1" />
            Confidential Code Names Active
          </span>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200/80 font-semibold text-[11px] uppercase tracking-wider">
              {/* Project Code Name */}
              <th
                onClick={() => handleSort('projectName')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Project</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Entity / Company */}
              <th
                onClick={() => handleSort('entityName')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Entity / MGA</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Status */}
              <th
                onClick={() => handleSort('status')}
                className="py-3 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors text-center"
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>Status</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Stage */}
              <th
                onClick={() => handleSort('stage')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Stage</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Deal Lead */}
              <th
                onClick={() => handleSort('dealLead')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Deal Lead</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* NWP */}
              <th
                onClick={() => handleSort('nwp')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors text-right"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>NWP</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Net Revenue */}
              <th
                onClick={() => handleSort('netRevenue')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors text-right"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Net Rev</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* PF EBITDA */}
              <th
                onClick={() => handleSort('pfEbitda')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors text-right"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>PF EBITDA</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Next Action */}
              <th className="py-3 px-4 min-w-[240px]">
                <span>Next Action</span>
              </th>

              {/* Next Action Date */}
              <th
                onClick={() => handleSort('nextActionDate')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors text-right"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Action Date</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th className="py-3 px-3 text-center"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {sortedDeals.length > 0 ? (
              sortedDeals.map((deal) => {
                const statusConf = STATUS_CONFIG[deal.status] || STATUS_CONFIG.Active
                const priorityConf = PRIORITY_CONFIG[deal.priority]

                // Check if date is overdue relative to Sep 25, 2026
                const isOverdue = deal.nextActionDate < '2026-09-25' && deal.status === 'Active'

                return (
                  <tr
                    key={deal.id}
                    onClick={() => onSelectDeal(deal)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                  >
                    {/* Project Code Name */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                          {deal.projectName}
                        </span>
                        {deal.needsAttention && (
                          <span
                            title="Requires attention: deadline, overdue or stalled"
                            className="inline-flex items-center p-1 rounded-full bg-amber-100 text-amber-700"
                          >
                            <AlertTriangle className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {deal.type}
                      </span>
                    </td>

                    {/* Entity / Company Name (Secondary prominence) */}
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      <div className="truncate max-w-[170px] text-slate-700">
                        {deal.entityName}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {deal.specialty}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusConf.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusConf.dotClass}`} />
                        {deal.status}
                      </span>
                    </td>

                    {/* Stage */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                        <Layers className="w-3 h-3 mr-1 text-slate-500" />
                        {deal.stage}
                      </span>
                    </td>

                    {/* Deal Lead */}
                    <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
                      {deal.dealLead === 'Unassigned' ? (
                        <span className="text-rose-600 font-semibold text-[11px] bg-rose-50 px-2 py-0.5 rounded">
                          Unassigned
                        </span>
                      ) : (
                        <div className="flex items-center space-x-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                          <span>{deal.dealLead}</span>
                        </div>
                      )}
                    </td>

                    {/* NWP */}
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">
                      {formatCurrency(deal.nwp)}
                    </td>

                    {/* Net Revenue */}
                    <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                      {formatCurrency(deal.netRevenue)}
                    </td>

                    {/* PF EBITDA */}
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">
                      {formatCurrency(deal.pfEbitda)}
                    </td>

                    {/* Next Action */}
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="flex items-start space-x-1.5">
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                            priorityConf?.dotClass || 'bg-slate-400'
                          }`}
                        />
                        <span className="line-clamp-2 text-[11px] text-slate-600 leading-snug">
                          {deal.nextAction}
                        </span>
                      </div>
                    </td>

                    {/* Next Action Date */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span
                          className={`font-medium ${
                            isOverdue
                              ? 'text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded'
                              : 'text-slate-600'
                          }`}
                        >
                          {formatDate(deal.nextActionDate)}
                        </span>
                      </div>
                      {isOverdue && (
                        <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                          Overdue
                        </div>
                      )}
                    </td>

                    {/* Chevron trigger */}
                    <td className="py-3.5 px-3 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors inline" />
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-slate-300" />
                    <span className="text-sm font-medium text-slate-600">No opportunities match the selected filters</span>
                    <span className="text-xs text-slate-400">Try adjusting your status or stage filters above</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
