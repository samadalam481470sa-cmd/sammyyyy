import { X } from 'lucide-react'

interface ComingSoonModalProps {
  featureName: string
  onClose: () => void
}

/** Lightweight modal for actions whose full workflow arrives in a later sprint. */
export function ComingSoonModal({ featureName, onClose }: ComingSoonModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={featureName}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-base font-semibold text-navy-900">{featureName}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          The full {featureName.toLowerCase()} workflow will be implemented in a future sprint.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-navy-900 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-800"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
