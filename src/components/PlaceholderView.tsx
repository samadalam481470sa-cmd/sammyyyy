import React from 'react'
import { Sparkles, ArrowLeft, Building2 } from 'lucide-react'

interface PlaceholderViewProps {
  moduleName: string
  onBackToDashboard: () => void
}

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({
  moduleName,
  onBackToDashboard,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-2xl mx-auto shadow-subtle my-8">
      <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
        <Building2 className="w-6 h-6" />
      </div>

      <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 mb-3">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Module Scheduled for Sprint 2</span>
      </div>

      <h2 className="text-xl font-bold text-slate-900 mb-2">
        {moduleName} Module
      </h2>

      <p className="text-xs text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
        The application shell and navigation have been prepared for {moduleName}. In this sprint, development is focused exclusively on the primary executive M&A Dashboard.
      </p>

      <button
        onClick={onBackToDashboard}
        className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Dashboard</span>
      </button>
    </div>
  )
}
