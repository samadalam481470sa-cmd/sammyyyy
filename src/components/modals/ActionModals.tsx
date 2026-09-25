import { useState, type FormEvent } from "react"
import { ACTIVITY_KIND_LABELS, CURRENT_USER, PRIORITY_LABELS } from "../../data/constants.ts"
import { useCrm } from "../../context/useCrm.ts"
import { isoDate } from "../../lib/dates.ts"
import {
  ACTIVITY_KINDS,
  ACQUISITION_STAGES,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  PRIORITIES,
  type ActivityKind,
  type AcquisitionStage,
  type NewActivityInput,
  type NewOpportunityInput,
  type NewTaskInput,
  type OpportunityStatus,
  type OpportunityType,
  type Priority,
} from "../../types/crm.ts"
import { Modal } from "../ui/Modal.tsx"

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-muted">
      {children}
    </label>
  )
}

function NewOpportunityModal({ onClose }: { onClose: () => void }) {
  const { addOpportunity, snapshot } = useCrm()
  const today = isoDate(new Date(snapshot.asOf), 0)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    projectName: "",
    entityName: "",
    type: "Platform Acquisition" as OpportunityType,
    status: "Active" as OpportunityStatus,
    stage: "Target Identified" as AcquisitionStage,
    priority: "B" as Priority,
    dealLead: CURRENT_USER.name,
    nwpMillions: "",
    netRevenueMillions: "",
    pfEbitdaMillions: "",
    nextAction: "",
    nextActionDate: "",
  })

  function update(partial: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...partial }))
  }

  function readMillions(value: string): number | null {
    if (!value.trim()) return 0
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) return null
    return parsed
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.projectName.trim() || !form.entityName.trim()) {
      setError("Project name and entity are required.")
      return
    }
    const nwpMillions = readMillions(form.nwpMillions)
    const netRevenueMillions = readMillions(form.netRevenueMillions)
    const pfEbitdaMillions = readMillions(form.pfEbitdaMillions)
    if (nwpMillions === null || netRevenueMillions === null || pfEbitdaMillions === null) {
      setError("Financial fields must be zero or a positive number of millions.")
      return
    }
    const input: NewOpportunityInput = {
      projectName: form.projectName,
      entityName: form.entityName,
      type: form.type,
      status: form.status,
      stage: form.stage,
      priority: form.priority,
      dealLead: form.dealLead,
      nwpMillions,
      netRevenueMillions,
      pfEbitdaMillions,
      nextAction: form.nextAction,
      nextActionDate: form.nextActionDate,
    }
    addOpportunity(input)
  }

  return (
    <Modal
      title="New Opportunity"
      subtitle="Adds a working record to this session. A full intake workflow will follow in a later sprint."
      onClose={onClose}
      wide
    >
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="project-name">Project name</FieldLabel>
          <input id="project-name" className="field" value={form.projectName} onChange={(event) => update({ projectName: event.target.value })} autoFocus />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="entity-name">Entity</FieldLabel>
          <input id="entity-name" className="field" value={form.entityName} onChange={(event) => update({ entityName: event.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="opp-type">Type</FieldLabel>
          <select id="opp-type" className="field" value={form.type} onChange={(event) => update({ type: event.target.value as OpportunityType })}>
            {OPPORTUNITY_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="opp-status">Status</FieldLabel>
          <select id="opp-status" className="field" value={form.status} onChange={(event) => update({ status: event.target.value as OpportunityStatus })}>
            {OPPORTUNITY_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="opp-stage">Stage</FieldLabel>
          <select id="opp-stage" className="field" value={form.stage} onChange={(event) => update({ stage: event.target.value as AcquisitionStage })}>
            {ACQUISITION_STAGES.map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="opp-priority">Priority</FieldLabel>
          <select id="opp-priority" className="field" value={form.priority} onChange={(event) => update({ priority: event.target.value as Priority })}>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority} — {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="deal-lead">Deal lead</FieldLabel>
          <input id="deal-lead" className="field" value={form.dealLead} onChange={(event) => update({ dealLead: event.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="nwp">NWP ($ millions)</FieldLabel>
          <input id="nwp" inputMode="decimal" className="field" value={form.nwpMillions} onChange={(event) => update({ nwpMillions: event.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="net-revenue">Net revenue ($ millions)</FieldLabel>
          <input id="net-revenue" inputMode="decimal" className="field" value={form.netRevenueMillions} onChange={(event) => update({ netRevenueMillions: event.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="ebitda">PF EBITDA ($ millions)</FieldLabel>
          <input id="ebitda" inputMode="decimal" className="field" value={form.pfEbitdaMillions} onChange={(event) => update({ pfEbitdaMillions: event.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="next-action">Next action</FieldLabel>
          <input id="next-action" className="field" value={form.nextAction} onChange={(event) => update({ nextAction: event.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="next-action-date">Next action date</FieldLabel>
          <input id="next-action-date" type="date" min={today} className="field" value={form.nextActionDate} onChange={(event) => update({ nextActionDate: event.target.value })} />
        </div>
        {error ? <p className="text-sm text-danger sm:col-span-2">{error}</p> : null}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-canvas">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-navy-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-navy-800">
            Add opportunity
          </button>
        </div>
      </form>
    </Modal>
  )
}

function AddTaskModal({ onClose }: { onClose: () => void }) {
  const { snapshot, addTask } = useCrm()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    action: "",
    projectId: snapshot.opportunities[0]?.id ?? "",
    owner: CURRENT_USER.name,
    priority: "A" as Priority,
    dueDate: isoDate(new Date(snapshot.asOf), 1),
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.action.trim() || !form.projectId || !form.owner.trim() || !form.dueDate) {
      setError("Action, project, owner, and due date are required.")
      return
    }
    const input: NewTaskInput = { ...form }
    addTask(input)
  }

  return (
    <Modal title="Add Task" subtitle="Adds an item to this week's priorities." onClose={onClose}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <div>
          <FieldLabel htmlFor="task-action">Action</FieldLabel>
          <input id="task-action" className="field" value={form.action} autoFocus onChange={(event) => setForm({ ...form, action: event.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="task-project">Project</FieldLabel>
          <select id="task-project" className="field" value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}>
            {snapshot.opportunities.map((opportunity) => (
              <option key={opportunity.id} value={opportunity.id}>
                {opportunity.projectName}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="task-priority">Priority</FieldLabel>
            <select id="task-priority" className="field" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority} — {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="task-due">Due date</FieldLabel>
            <input id="task-due" type="date" className="field" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="task-owner">Owner</FieldLabel>
          <input id="task-owner" className="field" value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-canvas">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-navy-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-navy-800">
            Add task
          </button>
        </div>
      </form>
    </Modal>
  )
}

function LogActivityModal({ onClose }: { onClose: () => void }) {
  const { snapshot, addActivity } = useCrm()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    projectId: snapshot.opportunities[0]?.id ?? "",
    message: "",
    kind: "note" as ActivityKind,
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.projectId || !form.message.trim()) {
      setError("Project and activity note are required.")
      return
    }
    const input: NewActivityInput = { ...form }
    addActivity(input)
  }

  return (
    <Modal title="Log Activity" subtitle="Adds an entry to recent activity." onClose={onClose}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <div>
          <FieldLabel htmlFor="activity-project">Project</FieldLabel>
          <select id="activity-project" className="field" value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}>
            {snapshot.opportunities.map((opportunity) => (
              <option key={opportunity.id} value={opportunity.id}>
                {opportunity.projectName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="activity-kind">Type</FieldLabel>
          <select id="activity-kind" className="field" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as ActivityKind })}>
            {ACTIVITY_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {ACTIVITY_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="activity-message">What happened</FieldLabel>
          <textarea id="activity-message" className="field min-h-24" value={form.message} autoFocus onChange={(event) => setForm({ ...form, message: event.target.value })} />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-canvas">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-navy-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-navy-800">
            Log activity
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ImportModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Import Excel" subtitle="Workbook import will be connected in a later sprint." onClose={onClose}>
      <p className="text-sm leading-6 text-muted">
        A future import will map columns for project, entity, status, stage, deal lead, NWP, net revenue, pro forma EBITDA, and next action.
      </p>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className="rounded-lg bg-navy-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-navy-800">
          Close
        </button>
      </div>
    </Modal>
  )
}

export function ActionModals() {
  const { modal, closeModal } = useCrm()
  if (modal === "opportunity") return <NewOpportunityModal onClose={closeModal} />
  if (modal === "task") return <AddTaskModal onClose={closeModal} />
  if (modal === "activity") return <LogActivityModal onClose={closeModal} />
  if (modal === "import") return <ImportModal onClose={closeModal} />
  return null
}
