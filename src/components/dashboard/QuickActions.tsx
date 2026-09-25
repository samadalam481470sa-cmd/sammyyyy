import { ClipboardPlus, MessageSquarePlus, Plus, Upload } from "lucide-react"
import { useCrm } from "../../context/useCrm.ts"

const ACTIONS = [
  { label: "New Opportunity", modal: "opportunity" as const, icon: Plus },
  { label: "Add Task", modal: "task" as const, icon: ClipboardPlus },
  { label: "Log Activity", modal: "activity" as const, icon: MessageSquarePlus },
  { label: "Import Excel", modal: "import" as const, icon: Upload },
]

export function QuickActions() {
  const { openModal } = useCrm()

  return (
    <section className="card h-full p-5" aria-labelledby="quick-actions-heading">
      <h2 id="quick-actions-heading" className="text-[15px] font-semibold tracking-tight text-ink">
        Quick Actions
      </h2>
      <p className="mt-1 text-sm text-muted">Update the working session without leaving the dashboard.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => openModal(action.modal)}
              className="flex items-center gap-2 rounded-xl border border-line px-3 py-3 text-left text-sm font-semibold text-navy-800 hover:bg-canvas"
            >
              <Icon className="size-4 shrink-0 text-navy-600" aria-hidden="true" />
              {action.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
