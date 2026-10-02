import { useMemo, useState, type FormEvent } from 'react';
import { CURRENT_USER } from '../../config/app';
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  PIPELINE_STAGES,
  PRIORITY_LEVELS,
  SOURCE_TYPES,
} from '../../config/picklists';
import { useDashboard } from '../../hooks/useDashboard';
import { useToast } from '../../hooks/useToast';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

const fieldClass =
  'mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-navy-900 focus:border-accent-400 focus:outline-none';
const labelClass = 'block text-xs font-medium text-slate-600';

export function CrmActionModals() {
  const {
    activeModal,
    closeModal,
    addOpportunity,
    addTask,
    addActivity,
    opportunities,
    snapshot,
  } = useDashboard();
  const { notify } = useToast();

  if (!activeModal) return null;

  if (activeModal === 'import') {
    return (
      <Modal
        open
        onClose={closeModal}
        title="Import Excel"
        subtitle="Bring an existing pipeline tracker into Newport CRM."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                notify('Import queued', 'Excel import will connect to the tracker migration next.');
                closeModal();
              }}
            >
              Simulate import
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Drop a workbook with project code names, entities, status, stage and financial columns.
          For this prototype the import is simulated and does not overwrite live records.
        </p>
      </Modal>
    );
  }

  if (activeModal === 'opportunity') {
    return (
      <NewOpportunityForm
        onCancel={closeModal}
        onSave={(input) => {
          const created = addOpportunity(input);
          notify('Opportunity created', `${created.projectName} is now in the pipeline.`);
          closeModal();
        }}
        owners={(snapshot?.team ?? []).map((member) => member.name)}
      />
    );
  }

  if (activeModal === 'task') {
    return (
      <NewTaskForm
        opportunities={opportunities}
        owners={(snapshot?.team ?? []).map((member) => member.name)}
        onCancel={closeModal}
        onSave={(input) => {
          const created = addTask(input);
          notify('Task added', created.action);
          closeModal();
        }}
      />
    );
  }

  return (
    <NewActivityForm
      opportunities={opportunities}
      onCancel={closeModal}
      onSave={(input) => {
        const created = addActivity(input);
        notify('Activity logged', created.description);
        closeModal();
      }}
    />
  );
}

function NewOpportunityForm({
  owners,
  onCancel,
  onSave,
}: {
  owners: string[];
  onCancel: () => void;
  onSave: Parameters<ReturnType<typeof useDashboard>['addOpportunity']>[0] extends infer T
    ? (input: T) => void
    : never;
}) {
  const [projectName, setProjectName] = useState('');
  const [entityName, setEntityName] = useState('');
  const [type, setType] = useState(OPPORTUNITY_TYPES[0].id);
  const [status, setStatus] = useState(OPPORTUNITY_STATUSES[0].id);
  const [stage, setStage] = useState(PIPELINE_STAGES[0].id);
  const [dealLead, setDealLead] = useState(CURRENT_USER.firstName + ' ' + CURRENT_USER.lastName);
  const [specialty, setSpecialty] = useState('');
  const [geography, setGeography] = useState('National');
  const [nwp, setNwp] = useState('10');
  const [netRevenue, setNetRevenue] = useState('3');
  const [pfEbitda, setPfEbitda] = useState('1.5');
  const [nextAction, setNextAction] = useState('Schedule intro call');
  const [nextActionDate, setNextActionDate] = useState('');
  const [priority, setPriority] = useState(PRIORITY_LEVELS[1].id);
  const [sourceType, setSourceType] = useState(SOURCE_TYPES[0].id);
  const [sourceName, setSourceName] = useState('');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!projectName.trim() || !entityName.trim()) return;
    const millions = (value: string) => Math.round(Number(value || 0) * 1_000_000);
    onSave({
      projectName,
      entityName,
      type,
      status,
      stage,
      dealLead,
      specialty,
      geography,
      nwp: millions(nwp),
      netRevenue: millions(netRevenue),
      pfEbitda: millions(pfEbitda),
      nextAction,
      nextActionDate: nextActionDate ? new Date(`${nextActionDate}T16:00:00`).toISOString() : '',
      priority,
      sourceType,
      sourceName,
    });
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title="New Opportunity"
      subtitle="Create a confidential project in the acquisition pipeline."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-opportunity-form">
            Create opportunity
          </Button>
        </div>
      }
    >
      <form id="new-opportunity-form" className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
        <Field label="Project code name" className="sm:col-span-2">
          <input className={fieldClass} value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project Harbor" required />
        </Field>
        <Field label="Entity" className="sm:col-span-2">
          <input className={fieldClass} value={entityName} onChange={(e) => setEntityName(e.target.value)} placeholder="Legal / trading name" required />
        </Field>
        <Field label="Type">
          <select className={fieldClass} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {OPPORTUNITY_TYPES.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select className={fieldClass} value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
            {PRIORITY_LEVELS.map((option) => (
              <option key={option.id} value={option.id}>{option.label} — {option.description}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {OPPORTUNITY_STATUSES.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Stage">
          <select className={fieldClass} value={stage} onChange={(e) => setStage(e.target.value as typeof stage)}>
            {PIPELINE_STAGES.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Deal lead">
          <select className={fieldClass} value={dealLead} onChange={(e) => setDealLead(e.target.value)}>
            <option value="">Unassigned</option>
            {owners.map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
        </Field>
        <Field label="Next action date">
          <input type="date" className={fieldClass} value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} />
        </Field>
        <Field label="Specialty">
          <input className={fieldClass} value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Commercial Auto" />
        </Field>
        <Field label="Geography">
          <input className={fieldClass} value={geography} onChange={(e) => setGeography(e.target.value)} />
        </Field>
        <Field label="NWP ($M)">
          <input type="number" step="0.1" min="0" className={fieldClass} value={nwp} onChange={(e) => setNwp(e.target.value)} />
        </Field>
        <Field label="Net revenue ($M)">
          <input type="number" step="0.1" min="0" className={fieldClass} value={netRevenue} onChange={(e) => setNetRevenue(e.target.value)} />
        </Field>
        <Field label="PF EBITDA ($M)">
          <input type="number" step="0.1" min="0" className={fieldClass} value={pfEbitda} onChange={(e) => setPfEbitda(e.target.value)} />
        </Field>
        <Field label="Source type">
          <select className={fieldClass} value={sourceType} onChange={(e) => setSourceType(e.target.value as typeof sourceType)}>
            {SOURCE_TYPES.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Source name" className="sm:col-span-2">
          <input className={fieldClass} value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Banker / intermediary / intro" />
        </Field>
        <Field label="Next action" className="sm:col-span-2">
          <input className={fieldClass} value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

function NewTaskForm({
  opportunities,
  owners,
  onCancel,
  onSave,
}: {
  opportunities: { id: string; projectName: string }[];
  owners: string[];
  onCancel: () => void;
  onSave: (input: Parameters<ReturnType<typeof useDashboard>['addTask']>[0]) => void;
}) {
  const [priority, setPriority] = useState(PRIORITY_LEVELS[0].id);
  const [action, setAction] = useState('');
  const [opportunityId, setOpportunityId] = useState(opportunities[0]?.id ?? '');
  const [owner, setOwner] = useState(`${CURRENT_USER.firstName} ${CURRENT_USER.lastName}`);
  const [dueDate, setDueDate] = useState('');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!action.trim() || !opportunityId || !dueDate) return;
    onSave({
      priority,
      action,
      opportunityId,
      owner,
      dueDate: new Date(`${dueDate}T16:00:00`).toISOString(),
    });
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title="Add Task"
      subtitle="Schedule a next action against a project."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" type="submit" form="new-task-form">Add task</Button>
        </div>
      }
    >
      <form id="new-task-form" className="space-y-3" onSubmit={onSubmit}>
        <Field label="Action">
          <input className={fieldClass} value={action} onChange={(e) => setAction(e.target.value)} required />
        </Field>
        <Field label="Project">
          <select className={fieldClass} value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)} required>
            {opportunities.map((item) => (
              <option key={item.id} value={item.id}>{item.projectName}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <select className={fieldClass} value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
              {PRIORITY_LEVELS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <input type="date" className={fieldClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </Field>
        </div>
        <Field label="Owner">
          <select className={fieldClass} value={owner} onChange={(e) => setOwner(e.target.value)}>
            {owners.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  );
}

function NewActivityForm({
  opportunities,
  onCancel,
  onSave,
}: {
  opportunities: { id: string; projectName: string }[];
  onCancel: () => void;
  onSave: (input: Parameters<ReturnType<typeof useDashboard>['addActivity']>[0]) => void;
}) {
  const kinds = useMemo(
    () => [
      { id: 'note', label: 'Note' },
      { id: 'meeting', label: 'Meeting' },
      { id: 'document', label: 'Document' },
      { id: 'stage_change', label: 'Stage change' },
      { id: 'status_change', label: 'Status change' },
      { id: 'task', label: 'Task' },
    ] as const,
    [],
  );
  const [kind, setKind] = useState<(typeof kinds)[number]['id']>('note');
  const [description, setDescription] = useState('');
  const [opportunityId, setOpportunityId] = useState(opportunities[0]?.id ?? '');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!description.trim() || !opportunityId) return;
    onSave({
      kind,
      description,
      opportunityId,
      actor: `${CURRENT_USER.firstName} ${CURRENT_USER.lastName}`,
    });
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title="Log Activity"
      subtitle="Capture a note or event against a project."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" type="submit" form="new-activity-form">Log activity</Button>
        </div>
      }
    >
      <form id="new-activity-form" className="space-y-3" onSubmit={onSubmit}>
        <Field label="Project">
          <select className={fieldClass} value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)} required>
            {opportunities.map((item) => (
              <option key={item.id} value={item.id}>{item.projectName}</option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select className={fieldClass} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {kinds.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Summary">
          <textarea
            className="mt-1 min-h-[96px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-navy-900 focus:border-accent-400 focus:outline-none"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </Field>
      </form>
    </Modal>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}
