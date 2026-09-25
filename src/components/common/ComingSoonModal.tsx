import { X } from 'lucide-react'

interface ComingSoonModalProps {
  featureName: string
  onClose: () => void
}

/** Salesforce-style modal for actions whose full workflow arrives in a later sprint. */
export function ComingSoonModal({ featureName, onClose }: ComingSoonModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={featureName}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-[4px] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-[15px] font-bold text-ink">{featureName}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] p-1 text-muted transition-colors hover:bg-canvas hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="px-4 py-4 text-[13px] text-[#444]">
          The full {featureName.toLowerCase()} workflow will be implemented in a future sprint.
        </p>
        <div className="flex justify-end border-t border-line bg-[#fafaf9] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] bg-brand-500 px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
