import React, { useState } from 'react'
import { X, Building2, Shield, Plus } from 'lucide-react'
import { ACQUISITION_STAGES, OPPORTUNITY_STATUSES, OPPORTUNITY_TYPES, SOURCE_TYPES } from '../../types/constants'
import { Opportunity, OpportunityStatus, OpportunityStage, OpportunityType, SourceType, PriorityLevel } from '../../types/crm'

interface NewOpportunityModalProps {
  isOpen: boolean
  onClose: () => void
  onSave?: (opp: Partial<Opportunity>) => void
}

export const NewOpportunityModal: React.FC<NewOpportunityModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [projectName, setProjectName] = useState('')
  const [entityName, setEntityName] = useState('')
  const [type, setType] = useState<OpportunityType>('Platform Acquisition')
  const [status, setStatus] = useState<OpportunityStatus>('Active')
  const [stage, setStage] = useState<OpportunityStage>('Target Identified')
  const [dealLead, setDealLead] = useState('Dennis DiCapua')
  const [sourceType, setSourceType] = useState<SourceType>('Investment Banker')
  const [sourceName, setSourceName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [geography, setGeography] = useState('')
  const [nwp, setNwp] = useState('')
  const [netRevenue, setNetRevenue] = useState('')
  const [pfEbitda, setPfEbitda] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [nextActionDate, setNextActionDate] = useState('')
  const [priority, setPriority] = useState<PriorityLevel>('A')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName.trim() || !entityName.trim()) return

    if (onSave) {
      onSave({
        projectName: projectName.startsWith('Project ') ? projectName : `Project ${projectName}`,
        entityName,
        type,
        status,
        stage,
        dealLead,
        sourceType,
        sourceName: sourceName || 'Direct Outreach',
        specialty: specialty || 'Specialty Lines',
        geography: geography || 'National',
        nwp: Number(nwp) || 15000000,
        netRevenue: Number(netRevenue) || 2800000,
        pfEbitda: Number(pfEbitda) || 2100000,
        nextAction: nextAction || 'Initial exploratory review',
        nextActionDate: nextActionDate || '2026-10-15',
        priority,
        lastActivityDate: '2026-09-25',
        needsAttention: false,
      })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      <div className="min-h-full flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 text-xs animate-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  New Acquisition Opportunity
                </h3>
                <p className="text-[11px] text-slate-500">
                  Initiate confidential M&A project file for an evaluated target
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Project Code Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Project Code Name *
                </label>
                <div className="relative">
                  <Shield className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Project Meridian"
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Entity / Company Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Entity / MGA Name *
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={entityName}
                    onChange={(e) => setEntityName(e.target.value)}
                    placeholder="e.g. Meridian Specialty Underwriters"
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Type */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Opportunity Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as OpportunityType)}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  {OPPORTUNITY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OpportunityStatus)}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  {OPPORTUNITY_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Stage */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Acquisition Stage
                </label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as OpportunityStage)}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  {ACQUISITION_STAGES.map((stg) => (
                    <option key={stg} value={stg}>{stg}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Deal Lead */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Deal Lead
                </label>
                <select
                  value={dealLead}
                  onChange={(e) => setDealLead(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  <option value="Dennis DiCapua">Dennis DiCapua</option>
                  <option value="Mary Sbaschnig">Mary Sbaschnig</option>
                  <option value="Alex Vance">Alex Vance</option>
                  <option value="Unassigned">Unassigned</option>
                </select>
              </div>

              {/* Source Type */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Source Type
                </label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as SourceType)}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  {SOURCE_TYPES.map((src) => (
                    <option key={src} value={src}>{src}</option>
                  ))}
                </select>
              </div>

              {/* Source Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Source / Banker Name
                </label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="e.g. Stonemark Partners"
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Specialty */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Specialty / Line of Business
                </label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="e.g. Commercial Excess Property"
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Geography & Priority */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Geography / HQ
                  </label>
                  <input
                    type="text"
                    value={geography}
                    onChange={(e) => setGeography(e.target.value)}
                    placeholder="e.g. Dallas, TX"
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  >
                    <option value="A">Priority A (High)</option>
                    <option value="B">Priority B (Medium)</option>
                    <option value="C">Priority C (Low)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Financial Estimates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Net Written Premium (USD)
                </label>
                <input
                  type="number"
                  value={nwp}
                  onChange={(e) => setNwp(e.target.value)}
                  placeholder="e.g. 25000000"
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Net Revenue (USD)
                </label>
                <input
                  type="number"
                  value={netRevenue}
                  onChange={(e) => setNetRevenue(e.target.value)}
                  placeholder="e.g. 4500000"
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  PF EBITDA (USD)
                </label>
                <input
                  type="number"
                  value={pfEbitda}
                  onChange={(e) => setPfEbitda(e.target.value)}
                  placeholder="e.g. 3200000"
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            {/* Next Action & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Next Action
                </label>
                <input
                  type="text"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="e.g. Request actuarial loss triangles from banker"
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Next Action Date
                </label>
                <input
                  type="date"
                  value={nextActionDate}
                  onChange={(e) => setNextActionDate(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-sm shadow-blue-600/20 transition-all"
              >
                Create Opportunity
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
