import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, FileText, Plus } from 'lucide-react'
import { useData } from '@/data/DataContext'
import { mockContacts, type ContactRecord, type TaskRecord } from '@/data/mockModules'
import { useResource } from '@/hooks/useResource'
import { primaryDealWarning } from '@/lib/attention'
import { statusStageConflict } from '@/lib/statusHistory'
import { dealIdFromOpportunity } from '@/lib/dealId'
import { customDocumentsForOpportunity, DOCUMENT_SLOT_META, hasAttachedFile, slotDocument } from '@/lib/documentSlots'
import { isDeletedTask, isHistoryTask, isUnfinishedTask } from '@/lib/taskLifecycle'
import { sortVisibleTasks } from '@/lib/taskSort'
import { taskWarning } from '@/lib/taskWarning'
import { badgeClass, stageBadge, statusBadge } from '@/utils/badges'
import { formatCurrency, formatDate, formatRelativeTime } from '@/utils/dashboard'
import { DocumentWorkspace } from '@/components/documents/DocumentWorkspace'
import { SlotPresenceIcon } from '@/components/documents/SlotPresenceIcon'
import { contactProjectIds, RelationshipEditor } from '@/components/relationships/RelationshipEditor'
import { NewRelationshipDrawer } from '@/components/relationships/NewRelationshipDrawer'
import type { OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'
import { OpportunityEditor } from '@/components/shared/OpportunityEditor'
import { WarningTriangle } from '@/components/shared/WarningTriangle'
import { NewTaskDrawer } from '@/components/tasks/NewTaskDrawer'
import { TaskEditor } from '@/components/tasks/TaskEditor'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'tasks', label: 'Tasks & Next Action' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'documents', label: 'Documents' },
  { id: 'activity', label: 'Activity' },
] as const
type TabId = (typeof TABS)[number]['id']

const PRIORITY_BADGES: Record<string, string> = {
  A: 'bg-navy-900 text-white',
  B: 'bg-accent-soft text-navy-800',
  C: 'bg-canvas text-ink-muted border border-border',
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface shadow-(--shadow-card)">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 className="font-brand text-lg font-bold text-navy-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center text-sm text-ink-muted">
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

const addButton = 'inline-flex h-9 items-center gap-1.5 rounded-lg bg-navy-900 px-3 text-sm font-semibold text-white hover:bg-navy-800'

/**
 * Full Opportunity Profile: one editable page per opportunity, keyed by its stable id.
 * Every edit goes through the same shared record services and editors as the module pages.
 */
export function OpportunityProfilePage() {
  const { opportunityId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const { opportunities, tasks, documents, activity, saveOpportunity, loading } = useData()
  const contactsApi = useResource<ContactRecord>('contacts', mockContacts)
  const opportunity = opportunities.find((row) => row.id === opportunityId) ?? null

  const tabParam = params.get('tab')
  const tab: TabId = TABS.some((row) => row.id === tabParam) ? (tabParam as TabId) : 'overview'
  const [taskId, setTaskId] = useState<string | null>(null)
  const [contactId, setContactId] = useState<string | null>(null)
  const [docId, setDocId] = useState<string | null>(null)
  const [docWorkspaceKey, setDocWorkspaceKey] = useState(0)
  const [newTask, setNewTask] = useState(false)
  const [newContact, setNewContact] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const panel = useRef<OpportunityEditorHandle>(null)
  const from = (location.state as { from?: string } | null)?.from

  const guarded = (run: () => void) => (panel.current ? panel.current.requestLeave(run) : run())

  const setTab = (next: TabId) =>
    guarded(() => {
      setTaskId(null)
      setContactId(null)
      setNotice(null)
      const nextParams = new URLSearchParams(params)
      if (next === 'overview') nextParams.delete('tab')
      else nextParams.set('tab', next)
      setParams(nextParams, { replace: true, state: location.state })
    })

  const goBack = () => guarded(() => (from ? navigate(from) : window.history.length > 1 ? navigate(-1) : navigate('/opportunities')))

  const linkedTasks = useMemo(
    () => sortVisibleTasks(tasks.filter((task) => task.opportunityId === opportunityId && !isDeletedTask(task))),
    [tasks, opportunityId],
  )
  const openTasks = linkedTasks.filter((task) => isUnfinishedTask(task) && !isHistoryTask(task))
  const doneTasks = linkedTasks.filter((task) => !isUnfinishedTask(task) || isHistoryTask(task))
  const contacts = useMemo(
    () => contactsApi.items.filter((contact) => contactProjectIds(contact).includes(opportunityId)),
    [contactsApi.items, opportunityId],
  )
  const relatedDocs = useMemo(() => documents.filter((doc) => doc.opportunityId === opportunityId), [documents, opportunityId])
  const customDocs = customDocumentsForOpportunity(relatedDocs, opportunityId)
  const taskIds = useMemo(() => new Set(linkedTasks.map((task) => task.id)), [linkedTasks])
  const docIds = useMemo(() => new Set(relatedDocs.map((doc) => doc.id)), [relatedDocs])
  const timeline = useMemo(
    () =>
      activity
        .filter((item) => item.projectId === opportunityId || (item.targetId && (item.targetId === opportunityId || taskIds.has(item.targetId) || docIds.has(item.targetId))))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [activity, opportunityId, taskIds, docIds],
  )

  if (!opportunity) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center" data-testid="profile-missing">
        <p className="font-brand text-2xl font-bold text-navy-900">{loading ? 'Loading opportunity…' : 'Opportunity not found'}</p>
        {!loading && <p className="mt-2 text-sm text-ink-muted">It may have been deleted, or the link is out of date.</p>}
        <button type="button" onClick={() => navigate('/opportunities')} className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-ink hover:bg-canvas">
          <ArrowLeft className="h-4 w-4" /> Go to Opportunities
        </button>
      </div>
    )
  }

  const dealId = dealIdFromOpportunity(opportunity)
  const warning = primaryDealWarning(opportunity, tasks)
  const selectedTask = taskId ? (linkedTasks.find((task) => task.id === taskId) ?? null) : null
  const selectedContact = contactId ? (contacts.find((contact) => contact.id === contactId) ?? null) : null

  const openActivity = (item: (typeof timeline)[number]) => {
    const type = item.targetType ?? (item.type === 'task' ? 'task' : item.type === 'document' ? 'document' : 'opportunity')
    const id = item.targetId
    if (type === 'task' && id) {
      if (!tasks.some((task) => task.id === id && !isDeletedTask(task))) return setNotice('That task was deleted and is no longer available.')
      setTab('tasks')
      setTaskId(id)
      return
    }
    if (type === 'document' && id) {
      if (!documents.some((doc) => doc.id === id)) return setNotice('That document was removed and is no longer available.')
      setTab('documents')
      setDocId(id)
      setDocWorkspaceKey((k) => k + 1)
      return
    }
    setTab('overview')
  }

  const sideGrid = (open: boolean) =>
    open ? 'grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[minmax(0,1fr)]' : 'grid h-full min-h-0 gap-4'
  const panel_ = 'h-full min-h-[420px] overflow-hidden rounded-xl border border-border bg-surface shadow-(--shadow-card) lg:min-h-0'
  const conflict = statusStageConflict(opportunity)

  return (
    <div className="custom-scroll flex h-dvh max-h-dvh min-h-0 flex-none flex-col overflow-y-auto" data-testid="opportunity-profile">
      <header className="shrink-0 border-b border-border bg-surface px-6 py-5 lg:px-8">
        <button type="button" onClick={goBack} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink" data-testid="profile-back">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">{dealId}</p>
            <h1 className="mt-1 flex items-center gap-2 font-brand text-2xl font-bold text-navy-900">
              {opportunity.projectName}
              <WarningTriangle warning={warning} className="mt-1" />
            </h1>
            <p className="mt-0.5 text-sm text-ink-muted">{opportunity.entityName}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className={badgeClass(statusBadge(opportunity.status))}>{opportunity.status}</span>
              <span className={badgeClass(stageBadge(opportunity.stage))}>{opportunity.stage}</span>
              <span className="text-ink-muted">Deal owner: <span className="font-semibold text-ink">{opportunity.dealLead || 'Unassigned'}</span></span>
              {conflict && (
                <span className="rounded-md border border-attention-border bg-attention-bg px-2 py-0.5 text-xs font-semibold text-attention" data-testid="profile-stage-conflict">
                  {conflict}
                </span>
              )}
            </div>
          </div>
          {(warning || opportunity.needsAttention) && (
            <div className={`max-w-sm rounded-lg border px-3 py-2 text-sm ${warning?.level === 'navy' ? 'border-accent-muted bg-accent-soft text-navy-900' : 'border-attention-border bg-attention-bg text-attention'}`} data-testid="profile-attention">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4" /> Needs Attention
              </p>
              <p className="mt-0.5 text-ink">{warning?.detail ?? opportunity.attentionReasons.join(', ')}</p>
            </div>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {[
            ['NWP', formatCurrency(opportunity.nwp)],
            ['Net Revenue', formatCurrency(opportunity.netRevenue)],
            ['PF EBITDA', formatCurrency(opportunity.pfEbitda)],
            ['Acquisition type', opportunity.type],
            ['Source', [opportunity.sourceType, opportunity.sourceName].filter(Boolean).join(' · ') || '—'],
            ['Geography', opportunity.geography || '—'],
            ['Specialty', opportunity.specialty || '—'],
          ].map(([term, value]) => (
            <div key={term} className="rounded-lg border border-border bg-canvas px-3 py-2">
              <dt className="text-[10px] font-semibold tracking-[0.06em] text-ink-subtle uppercase">{term}</dt>
              <dd className="mt-0.5 truncate text-sm font-semibold text-ink" title={value}>{value}</dd>
            </div>
          ))}
        </dl>
        <nav className="mt-5 -mb-5 flex flex-wrap gap-1" aria-label="Profile sections">
          {TABS.map((row) => (
            <button
              key={row.id}
              type="button"
              data-testid={`profile-tab-${row.id}`}
              aria-current={tab === row.id ? 'page' : undefined}
              onClick={() => setTab(row.id)}
              className={`rounded-t-lg border-b-2 px-3.5 py-2.5 text-sm font-semibold ${tab === row.id ? 'border-navy-900 text-navy-900' : 'border-transparent text-ink-muted hover:text-ink'}`}
            >
              {row.label}
              {row.id === 'tasks' && openTasks.length > 0 && <span className="ml-1.5 rounded-full bg-canvas px-1.5 text-xs">{openTasks.length}</span>}
              {row.id === 'relationships' && contacts.length > 0 && <span className="ml-1.5 rounded-full bg-canvas px-1.5 text-xs">{contacts.length}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex min-h-[460px] flex-1 flex-col px-6 py-5 lg:px-8">
        {notice && (
          <p role="status" className="mb-4 rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-ink-muted">
            {notice}
          </p>
        )}

        {tab === 'overview' && (
          <div className={`${panel_} flex-1`} data-testid="profile-overview">
            <OpportunityEditor
              ref={panel}
              opportunity={opportunity}
              onSave={(patch) => saveOpportunity(opportunity.id, patch).then(() => undefined)}
              onDeleted={() => navigate('/opportunities', { replace: true })}
              hideHeader
            />
          </div>
        )}

        {tab === 'tasks' && (
          <div className={`${sideGrid(Boolean(selectedTask))} flex-1`}>
            <div className="custom-scroll min-h-0 space-y-4 overflow-y-auto">
              <Card title="Next Action">
                <div className="px-5 py-4 text-sm">
                  {opportunity.nextAction ? (
                    <p>
                      <span className="font-semibold text-ink">{opportunity.nextAction}</span>
                      <span className="text-ink-muted"> · due {formatDate(opportunity.nextActionDate)} · priority {opportunity.priority}</span>
                    </p>
                  ) : (
                    <p className="text-ink-muted">No next action assigned. Add an unfinished task to set one.</p>
                  )}
                </div>
              </Card>
              <Card title={`Open tasks (${openTasks.length})`} action={<button type="button" className={addButton} onClick={() => guarded(() => setNewTask(true))} data-testid="profile-new-task"><Plus className="h-4 w-4" /> New Task</button>}>
                <TaskTable rows={openTasks} selectedId={taskId} onOpen={(id) => guarded(() => setTaskId(taskId === id ? null : id))} empty="No open tasks for this opportunity." />
              </Card>
              <Card title={`Completed (${doneTasks.length})`}>
                <TaskTable rows={doneTasks} selectedId={taskId} onOpen={(id) => guarded(() => setTaskId(taskId === id ? null : id))} empty="No completed tasks yet." />
              </Card>
            </div>
            {selectedTask && (
              <aside className={panel_}>
                <TaskEditor ref={panel} mode="existing" task={selectedTask} onClose={() => setTaskId(null)} onDeleted={() => setTaskId(null)} />
              </aside>
            )}
          </div>
        )}

        {tab === 'relationships' && (
          <div className={`${sideGrid(Boolean(selectedContact))} flex-1`}>
            <div className="custom-scroll min-h-0 overflow-y-auto">
            <Card title={`Contacts (${contacts.length})`} action={<button type="button" className={addButton} onClick={() => guarded(() => setNewContact(true))} data-testid="profile-new-relationship"><Plus className="h-4 w-4" /> New Relationship</button>}>
              {contacts.length === 0 ? (
                <Empty>No contacts are linked to {opportunity.projectName}. Add one, or link an existing contact from Relationships.</Empty>
              ) : (
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="bg-canvas text-[11px] tracking-[0.06em] text-ink-subtle uppercase">
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 font-semibold">Name</th>
                      <th className="px-3 py-3 font-semibold">Role</th>
                      <th className="px-3 py-3 font-semibold">Employer</th>
                      <th className="px-3 py-3 font-semibold">Email</th>
                      <th className="px-5 py-3 font-semibold">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => (
                      <tr
                        key={contact.id}
                        tabIndex={0}
                        aria-selected={contactId === contact.id}
                        onClick={() => guarded(() => setContactId(contactId === contact.id ? null : contact.id))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') guarded(() => setContactId(contact.id))
                        }}
                        className={`cursor-pointer border-b border-border/70 ${contactId === contact.id ? 'bg-accent-soft/60' : 'hover:bg-accent-soft/30'}`}
                      >
                        <td className="truncate px-5 py-3.5 font-semibold text-navy-900">{contact.name}</td>
                        <td className="truncate px-3 py-3.5 text-ink-muted">{[contact.title, contact.category].filter(Boolean).join(' · ') || '—'}</td>
                        <td className="truncate px-3 py-3.5 text-ink-muted">{contact.company || '—'}</td>
                        <td className="truncate px-3 py-3.5 text-ink-muted">{contact.email ? <button type="button" className="text-navy-900 hover:underline" title="Write an email in the CRM" onClick={(e) => { e.stopPropagation(); navigate(`/email?to=${encodeURIComponent(contact.email)}&subject=${encodeURIComponent(opportunity.projectName)}`) }}>{contact.email}</button> : '—'}</td>
                        <td className="truncate px-5 py-3.5 text-ink-muted">{contact.phone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            </div>
            {selectedContact && (
              <aside className={panel_}>
                <RelationshipEditor ref={panel} api={contactsApi} contact={selectedContact} onClose={() => setContactId(null)} onDeleted={() => setContactId(null)} />
              </aside>
            )}
          </div>
        )}

        {tab === 'documents' && (
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[minmax(0,1fr)]">
            <div className="custom-scroll min-h-0 overflow-y-auto">
            <Card title="Documents">
              <ul className="divide-y divide-border">
                {DOCUMENT_SLOT_META.map((slot) => {
                  const doc = slotDocument(relatedDocs, opportunityId, slot.id)
                  return (
                    <li key={slot.id}>
                      <button
                        type="button"
                        onClick={() => guarded(() => { setDocId(doc?.id ?? null); setDocWorkspaceKey((k) => k + 1) })}
                        className={`flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-accent-soft/30 ${doc && docId === doc.id ? 'bg-accent-soft/60' : ''}`}
                      >
                        <SlotPresenceIcon available={hasAttachedFile(doc)} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-navy-900">{slot.label}</span>
                          <span className="block truncate text-xs text-ink-muted">{doc ? `${doc.status}${doc.fileName ? ` · ${doc.fileName}` : ''}` : 'Empty slot'}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
                {customDocs.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => guarded(() => { setDocId(doc.id); setDocWorkspaceKey((k) => k + 1) })}
                      className={`flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-accent-soft/30 ${docId === doc.id ? 'bg-accent-soft/60' : ''}`}
                    >
                      <FileText className="h-4 w-4 text-navy-900" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-navy-900">{doc.name || doc.docType}</span>
                        <span className="block truncate text-xs text-ink-muted">{doc.docType} · {doc.status}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="border-t border-border px-5 py-3 text-xs text-ink-muted">Open, upload, or add documents in the workspace. Use “Add New Document” there for custom types.</p>
            </Card>
            </div>
            <aside className={panel_}>
              <DocumentWorkspace key={docWorkspaceKey} ref={panel} opportunity={opportunity} initialDocumentId={docId} hideClose onClose={() => { setDocId(null); setDocWorkspaceKey((k) => k + 1) }} />
            </aside>
          </div>
        )}

        {tab === 'activity' && (
          <div className="custom-scroll min-h-0 flex-1 overflow-y-auto">
          <Card title="Activity">
            {timeline.length === 0 ? (
              <Empty>No saved changes are recorded for this opportunity yet.</Empty>
            ) : (
              <ul className="divide-y divide-border" data-testid="profile-activity">
                {timeline.map((item) => {
                  const targetGone =
                    (item.targetType === 'task' && item.targetId && !tasks.some((task) => task.id === item.targetId && !isDeletedTask(task))) ||
                    (item.targetType === 'document' && item.targetId && !documents.some((doc) => doc.id === item.targetId))
                  return (
                    <li key={item.id}>
                      <button type="button" onClick={() => openActivity(item)} className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-accent-soft/30">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-ink">{item.message}</span>
                          <span className="block text-xs text-ink-muted">
                            {item.actor ?? 'Newport user'} · {formatRelativeTime(item.timestamp)}
                            {targetGone && ' · record no longer available'}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
          </div>
        )}
      </main>

      <NewTaskDrawer open={newTask} onClose={() => setNewTask(false)} seed={{ opportunityId }} onCreated={(task) => setTaskId(task.id)} />
      <NewRelationshipDrawer open={newContact} api={contactsApi} seedProjectIds={[opportunityId]} onClose={() => setNewContact(false)} onCreated={(contact) => setContactId(contact.id)} />
    </div>
  )
}

function TaskTable({ rows, selectedId, onOpen, empty }: { rows: TaskRecord[]; selectedId: string | null; onOpen: (id: string) => void; empty: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>
  return (
    <table className="w-full table-fixed text-left text-sm">
      <thead className="bg-canvas text-[11px] tracking-[0.06em] text-ink-subtle uppercase">
        <tr className="border-b border-border">
          <th className="w-[12%] px-5 py-3 font-semibold">Priority</th>
          <th className="w-[38%] px-3 py-3 font-semibold">Action</th>
          <th className="w-[20%] px-3 py-3 font-semibold">Owner</th>
          <th className="w-[15%] px-3 py-3 font-semibold">Due</th>
          <th className="w-[15%] px-5 py-3 font-semibold">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((task) => (
          <tr
            key={task.id}
            tabIndex={0}
            aria-selected={selectedId === task.id}
            onClick={() => onOpen(task.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onOpen(task.id)
            }}
            className={`cursor-pointer border-b border-border/70 ${selectedId === task.id ? 'bg-accent-soft/60' : 'hover:bg-accent-soft/30'}`}
          >
            <td className="px-5 py-3.5">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${PRIORITY_BADGES[task.priority] ?? PRIORITY_BADGES.C}`}>{task.priority}</span>
            </td>
            <td className="px-3 py-3.5 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="truncate">{task.action}</span>
                <WarningTriangle warning={taskWarning(task)} />
              </span>
            </td>
            <td className="truncate px-3 py-3.5 text-ink-muted">{task.owner || '—'}</td>
            <td className="px-3 py-3.5 text-ink-muted">{formatDate(task.dueDate)}</td>
            <td className="px-5 py-3.5 text-ink-muted">{task.archivedAt ? 'Archived' : task.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
