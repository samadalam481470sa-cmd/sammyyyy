import { PRIORITY_LABELS } from "../../data/constants.ts"
import { useCrm } from "../../context/useCrm.ts"
import { formatDate } from "../../lib/format.ts"
import { isOverdue } from "../../lib/dates.ts"
import type { PriorityTask } from "../../types/crm.ts"
import { PriorityMark } from "../ui/Marks.tsx"
import { cn } from "../../lib/cn.ts"

export function PriorityTasks({ tasks }: { tasks: PriorityTask[] }) {
  const { snapshot, openOpportunity } = useCrm()

  return (
    <section className="card flex h-full flex-col p-5" aria-labelledby="priorities-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="priorities-heading" className="text-[15px] font-semibold tracking-tight text-ink">
            This Week&apos;s Priorities
          </h2>
          <p className="mt-1 text-sm text-muted">What has to move, and what can wait.</p>
        </div>
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {(["A", "B", "C"] as const).map((priority) => (
          <div key={priority} className="flex items-center gap-2">
            <PriorityMark priority={priority} />
            <dt className="sr-only">{priority}</dt>
            <dd>{PRIORITY_LABELS[priority]}</dd>
          </div>
        ))}
      </dl>
      {tasks.length === 0 ? (
        <p className="py-8 text-sm text-muted">No priorities in this view.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {tasks.map((task) => {
            const project = snapshot.opportunities.find((opportunity) => opportunity.id === task.projectId)
            const overdue = isOverdue(task.dueDate, snapshot.asOf)
            return (
              <li key={task.id} className="flex gap-3 py-3">
                <PriorityMark priority={task.priority} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{task.action}</p>
                  <p className="mt-1 text-sm text-muted">
                    {project ? (
                      <button
                        type="button"
                        className="font-medium text-navy-700 hover:underline"
                        onClick={() => openOpportunity(project.id)}
                      >
                        {project.projectName}
                      </button>
                    ) : (
                      "Unknown project"
                    )}
                    <span> · {task.owner}</span>
                  </p>
                  <p className={cn("mt-1 text-xs tabular-nums", overdue ? "font-semibold text-amber" : "text-muted")}>
                    Due {formatDate(task.dueDate, true)}
                    {overdue ? " · Overdue" : ""}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
