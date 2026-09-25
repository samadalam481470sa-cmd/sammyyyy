import React, { useEffect } from 'react'
import { Opportunity } from '../../types/crm'
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../types/constants'
import { formatFullCurrency, formatDate } from '../../utils/formatters'
import {
  X,
  Shield,
  Building2,
  Calendar,
  Layers,
  MapPin,
  Briefcase,
  AlertTriangle,
  Sparkles
} from 'lucide-react'

interface OpportunityDrawerProps {
  deal: Opportunity | null
  isOpen: boolean
  onClose: () => void
}

export const OpportunityDrawer: React.FC<OpportunityDrawerProps> = ({
  deal,
  isOpen,
  onClose,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !deal) return null

  const statusConf = STATUS_CONFIG[deal.status] || STATUS_CONFIG.Active
  const priorityConf = PRIORITY_CONFIG[deal.priority]

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col justify-between animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded">
                    <Shield className="w-3 h-3 mr-1" />
                    Confidential M&A Project
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusConf.badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full mr-1 ${statusConf.dotClass}`} />
                    {deal.status}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  {deal.projectName}
                </h2>
                <div className="flex items-center space-x-2 text-xs text-slate-600 mt-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-800">{deal.entityName}</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body Content */}
          <div className="p-6 flex-1 overflow-y-auto space-y-6 text-xs">
            {/* Attention Alert Banner if required */}
            {deal.needsAttention && deal.attentionReasons && deal.attentionReasons.length > 0 && (
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200/80 space-y-1.5">
                <div className="flex items-center space-x-1.5 text-amber-900 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Opportunity Requires Attention</span>
                </div>
                {deal.attentionReasons.map((reason, idx) => (
                  <div key={idx} className="text-amber-800 leading-snug pl-5 text-[11px]">
                    <strong>{reason.label}:</strong> {reason.description}
                  </div>
                ))}
              </div>
            )}

            {/* Core Deal Attributes */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Deal Metadata & Ownership
              </h3>
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                <div>
                  <div className="text-[11px] text-slate-500">Deal Lead</div>
                  <div className="font-semibold text-slate-900 mt-0.5">{deal.dealLead}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Acquisition Stage</div>
                  <div className="font-semibold text-slate-900 mt-0.5 flex items-center">
                    <Layers className="w-3 h-3 mr-1 text-blue-600" />
                    {deal.stage}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Opportunity Type</div>
                  <div className="font-semibold text-slate-900 mt-0.5">{deal.type}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Priority Level</div>
                  <div className="font-semibold text-slate-900 mt-0.5 flex items-center">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${priorityConf?.badgeClass}`}
                    >
                      Tier {deal.priority}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Deal Source</div>
                  <div className="font-semibold text-slate-900 mt-0.5">{deal.sourceType}</div>
                  <div className="text-[10px] text-slate-400">{deal.sourceName}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Headquarters / Geography</div>
                  <div className="font-semibold text-slate-900 mt-0.5 flex items-center">
                    <MapPin className="w-3 h-3 mr-1 text-slate-400" />
                    {deal.geography}
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Overview (Confidential PE Metrics) */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Key Financial Metrics (Confidential)
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                  <div className="text-[10px] uppercase font-semibold text-blue-700">Net Written Premium</div>
                  <div className="text-base font-bold text-slate-900 font-mono mt-1">
                    {formatFullCurrency(deal.nwp)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Annual Underwritten</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                  <div className="text-[10px] uppercase font-semibold text-slate-600">Net Revenue</div>
                  <div className="text-base font-bold text-slate-900 font-mono mt-1">
                    {formatFullCurrency(deal.netRevenue)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Commission & Fees</div>
                </div>

                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <div className="text-[10px] uppercase font-semibold text-indigo-700">PF EBITDA</div>
                  <div className="text-base font-bold text-slate-900 font-mono mt-1">
                    {formatFullCurrency(deal.pfEbitda)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {((deal.pfEbitda / deal.netRevenue) * 100).toFixed(1)}% EBITDA Margin
                  </div>
                </div>
              </div>
            </div>

            {/* Next Action & Milestones */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Next Action & Deliverables
              </h3>
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                  <span className="font-semibold text-slate-700">Assigned Action:</span>
                  <span className="flex items-center text-slate-600 font-medium">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    Target Date: <strong className="ml-1 text-slate-900">{formatDate(deal.nextActionDate)}</strong>
                  </span>
                </div>
                <p className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                  {deal.nextAction}
                </p>
              </div>
            </div>

            {/* Notes & Carrier Partners */}
            {deal.notes && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Diligence & Strategic Summary
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                  {deal.notes}
                </p>
              </div>
            )}

            {deal.carrierPartners && deal.carrierPartners.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Fronting / Carrier Capacity Relationships
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {deal.carrierPartners.map((carrier, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                    >
                      <Briefcase className="w-3 h-3 mr-1 text-slate-400" />
                      {carrier}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Drawer Footer Notice (Strict Requirement) */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-500 text-xs">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-slate-800">
                Full Opportunity Profile — Coming in next sprint
              </span>
            </div>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium rounded-lg text-xs shadow-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
