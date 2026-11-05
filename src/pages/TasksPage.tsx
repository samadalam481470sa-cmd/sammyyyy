import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Expand, History, Plus, X } from 'lucide-react'
import { useData } from '@/data/DataContext'
import { TASK_STATUSES } from '@/data/mockModules'
import { isDoneAwaitingArchive, isListedTask, isWorkingTask } from '@/lib/taskLifecycle'
import { isOnTrackTask, isOverdueUnfinishedTask, sortVisibleTasks } from '@/lib/taskSort'
import { taskWarning } from '@/lib/taskWarning'
import { priorityChipClass, PRIORITY_LEGEND } from '@/lib/priorityStyles'
import { NewTaskDrawer } from '@/components/tasks/NewTaskDrawer'
import { TaskHistoryList, useTaskHistoryRows } from '@/components/tasks/TaskHistoryList'
import { ProfileLinkButton } from '@/components/profile/ProfileLinkButton'
import { formatDate } from '@/utils/dashboard'
import { WarningTriangle } from '@/components/shared/WarningTriangle'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import type { OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'
import { DrawerHeader, SideDrawer } from '@/components/shared/Overlay'
import { ContentCard, FieldLabel, FilterPopover, PageShell, PageTitleBar, PageToolbar, PrimaryButton, RecordCount, SearchBox, SegmentButtons } from '@/components/shared/PageChrome'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { PeriodFilterControl } from '@/components/shared/PeriodFilterControl'
import { paginate } from '@/lib/paginate'
import { useFitRows } from '@/hooks/useFitRows'
import { useRestorableScroll, useRestorableSelection, useSessionState } from '@/hooks/useSessionState'
import { Pagination } from '@/components/shared/Pagination'
import { FilterChips, type ActiveFilterChip } from '@/components/shared/FilterChips'
import { isLast30, LAST_30_DAYS, type PeriodFilter } from '@/lib/reports'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

type TaskListFilter = 'all' | 'overdue' | 'on-track'
const KEY = 'tasks'

const STATUS_STYLE: Record<string, string> = {
  Open: 'border-[#f0d9a8] bg-warning-bg text-warning',
  'In Progress': 'border-accent-muted bg-accent-soft text-navy-800',
  Done: 'border-[#bfe0cf] bg-success-bg text-success',
}

export function TasksPage() {
  const navigate = useNavigate()
  const { tasks, opportunities, users, saveTask, archiveTask, loading } = useData()
  const [params, setParams] = useSearchParams()
  const [selectedId, setSelectedId] = useRestorableSelection(KEY)
  const [draftOpen, setDraftOpen] = useState(false)
  const [search, setSearch] = useSessionState(`${KEY}:search`, '')
  const [historyOpen, setHistoryOpen] = useSessionState(`${KEY}:historyOpen`, params.get('history') === '1')
  const [historyPeriod, setHistoryPeriod] = useSessionState<PeriodFilter>(`${KEY}:historyPeriod`, LAST_30_DAYS)
  const [archiveAsk, setArchiveAsk] = useState<{ id: string; action: string } | null>(null)
  const historyScroll = useRef<HTMLDivElement>(null)
  useRestorableScroll(`${KEY}:history`, historyScroll, historyOpen)
  const [listFilter, setListFilter] = useSessionState<TaskListFilter>(`${KEY}:pill`, 'all')
  const [projectFilter, setProjectFilter] = useSessionState(`${KEY}:project`, '')
  const [ownerFilter, setOwnerFilter] = useSessionState(`${KEY}:owner`, '')
  const [pageState, setPageState] = useSessionState(`${KEY}:page`, { key: '', page: 1 })
  const [notice, setNotice] = useState<string | null>(null)
  const editorRef = useRef<OpportunityEditorHandle>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const pageSize = useFitRows(tableRef, { rowHeight: 44, min: 4, stretchedRows: true })

  // Links such as the bell's "View all in Tasks" arrive with ?filter=overdue; ?new=1 and ?select=id too.
  useEffect(() => {
    const next = new URLSearchParams(params)
    let changed = false
    const value = params.get('filter')
    if (value === 'overdue' || value === 'on-track' || value === 'all') {
      setListFilter(value)
      next.delete('filter')
      changed = true
    }
    if (params.get('new') === '1') {
      setDraftOpen(true)
      next.delete('new')
      changed = true
    }
    const select = params.get('select')
    if (select) {
      setSelectedId(select)
      next.delete('select')
      changed = true
    }
    if (params.get('history') === '1') {
      setHistoryOpen(true)
      next.delete('history')
      changed = true
    }
    if (changed) setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  // Project filter lists real project names in Deal ID order.
  const projectOptions = useMemo(
    () =>
      [...opportunities]
        .filter((o) => o.projectName.trim())
        .sort((a, b) => (a.projectNumber ?? 0) - (b.projectNumber ?? 0))
        .map((o) => ({ id: o.id, label: o.projectName })),
    [opportunities],
  )
  const ownerOptions = useMemo(() => {
    const names = new Set<string>()
    users.forEach((u) => names.add(u.name))
    tasks.forEach((t) => {
      if (t.owner?.trim()) names.add(t.owner.trim())
    })
    return [...names].sort().map((n) => ({ id: n, label: n }))
  }, [users, tasks])

  // The working list: unfinished tasks of Active/Pending deals (shared with Dashboard and the bell).
  const working = useMemo(() => tasks.filter((task) => isWorkingTask(task, opportunities)), [tasks, opportunities])
  // The list adds Done tasks that are waiting for the X (or the seven-day auto archive).
  const listed = useMemo(() => tasks.filter((task) => isListedTask(task, opportunities)), [tasks, opportunities])
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = listed.filter((task) => {
      if (listFilter === 'overdue' && !isOverdueUnfinishedTask(task)) return false
      if (listFilter === 'on-track' && !isOnTrackTask(task)) return false
      if (projectFilter && task.opportunityId !== projectFilter) return false
      if (ownerFilter && (task.owner ?? '').trim() !== ownerFilter) return false
      if (!q) return true
      const entity = opportunities.find((o) => o.id === task.opportunityId)?.entityName ?? ''
      return `${task.action} ${task.projectName} ${task.owner} ${entity} ${task.notes}`.toLowerCase().includes(q)
    })
    return sortVisibleTasks(rows)
  }, [listed, search, opportunities, listFilter, projectFilter, ownerFilter])

  const filterKey = JSON.stringify([search, listFilter, projectFilter, ownerFilter])
  const page = pageState.key === filterKey ? pageState.page : 1
  const view = paginate(visible, page, pageSize)
  const counts = {
    all: listed.length,
    overdue: working.filter((t) => isOverdueUnfinishedTask(t)).length,
    onTrack: working.filter((t) => isOnTrackTask(t)).length,
  }

  const projectLabel = projectOptions.find((p) => p.id === projectFilter)?.label ?? ''
  const chips: ActiveFilterChip[] = [
    ...(projectFilter ? [{ key: 'project', label: `Project: ${projectLabel || 'Unknown'}`, onRemove: () => setProjectFilter('') }] : []),
    ...(ownerFilter ? [{ key: 'owner', label: `Owner: ${ownerFilter}`, onRemove: () => setOwnerFilter('') }] : []),
  ]
  const clearAll = () => {
    setProjectFilter('')
    setOwnerFilter('')
  }

  const selected = selectedId ? (tasks.find((t) => t.id === selectedId) ?? null) : null
  const closeEditor = () => setSelectedId(null)
  const requestClose = () => (editorRef.current ? editorRef.current.requestLeave(closeEditor) : closeEditor())
  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelectedId(id)
    }
  }

  const history = useTaskHistoryRows(historyPeriod)

  return (
    <PageShell testId="tasks-page">
      <PageTitleBar title="Tasks & Follow-Ups" subtitle={PRIORITY_LEGEND}>
        <button type="button" onClick={() => setHistoryOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-ink hover:bg-canvas" data-testid="task-history-button">
          <History className="h-4 w-4" /> Task History
        </button>
        <SearchBox value={search} onChange={setSearch} placeholder="Search tasks" testId="task-search" />
        <PrimaryButton onClick={() => setDraftOpen(true)} icon={<Plus className="h-4 w-4" />} testId="new-task">
          New Task
        </PrimaryButton>
      </PageTitleBar>

      <PageToolbar
        left={
          <SegmentButtons
            label="Task list"
            value={listFilter}
            onChange={setListFilter}
            options={[
              { id: 'all', label: 'All Tasks', count: counts.all },
              { id: 'overdue', label: 'Overdue', count: counts.overdue },
              { id: 'on-track', label: 'On Track', count: counts.onTrack },
            ]}
          />
        }
        right={
          <>
            <RecordCount count={visible.length} noun={['task', 'tasks']} />
            <FilterChips chips={chips} onClearAll={clearAll} />
            <FilterPopover active={Boolean(projectFilter || ownerFilter)} testId="task-filter">
              <div>
                <FieldLabel>Project</FieldLabel>
                <SearchSelect value={projectFilter || null} options={projectOptions} onChange={(v) => setProjectFilter(v ?? '')} placeholder="All projects" emptyText="No matching project" />
              </div>
              <div>
                <FieldLabel>Owner</FieldLabel>
                <SearchSelect value={ownerFilter || null} options={ownerOptions} onChange={(v) => setOwnerFilter(v ?? '')} placeholder="All owners" emptyText="No matching owner" />
              </div>
              <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink" onClick={clearAll}>
                <X className="h-3.5 w-3.5" /> Clear Filters
              </button>
            </FilterPopover>
          </>
        }
      />
      {notice && (
        <p className="mx-6 mb-2 flex items-center justify-between rounded-lg bg-success-bg px-3 py-1.5 text-sm text-success lg:mx-8" role="status">
          {notice}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="rounded p-0.5 hover:bg-white/60">
            <X className="h-3.5 w-3.5" />
          </button>
        </p>
      )}

      <ContentCard>
        <div ref={tableRef} className="custom-scroll min-h-0 w-full flex-1 overflow-auto">
          {loading && <p className="px-6 py-8 text-sm text-ink-muted">Loading records…</p>}
          <ul className="divide-y divide-border sm:hidden" aria-label="Tasks">
            {view.rows.map((task) => (
              <li key={task.id} data-card-row>
                <button type="button" onClick={() => setSelectedId(task.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                  <span className={priorityChipClass(task.priority)}>{task.priority}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">
                      <span className="truncate">{task.action}</span>
                      <WarningTriangle warning={taskWarning(task)} />
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {task.projectName || 'No project'} · {task.owner || 'Unassigned'}
                    </span>
                    <span className="block text-xs text-ink-muted">Due {formatDate(task.dueDate)} · {task.status}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <table className={`hidden w-full min-w-[880px] table-fixed text-left text-sm sm:table ${view.rows.length >= pageSize ? 'h-full' : ''}`} data-testid="tasks-table">
            <colgroup>
              <col className="w-[76px]" />
              <col />
              <col className="w-[14%]" />
              <col className="w-[13%]" />
              <col className="w-[14%]" />
              <col className="w-[104px]" />
              <col className="w-[30px]" />
              <col className="w-[164px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-surface text-[11px] tracking-[0.06em] text-ink-subtle uppercase shadow-[inset_0_-1px_0_var(--color-border)]">
              <tr>
                <th className="py-3 pl-5 font-semibold">Priority</th>
                <th className="px-3 py-3 font-semibold">Action</th>
                <th className="px-3 py-3 font-semibold">Project</th>
                <th className="px-3 py-3 font-semibold">Company</th>
                <th className="px-3 py-3 font-semibold">Owner</th>
                <th className="px-3 py-3 font-semibold">Due Date</th>
                <th className="p-0 font-semibold">
                  <span className="sr-only">Warning</span>
                </th>
                <th className="py-3 pr-5 pl-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((task) => {
                const entity = opportunities.find((o) => o.id === task.opportunityId)?.entityName ?? '—'
                const warning = taskWarning(task)
                const doneRow = isDoneAwaitingArchive(task)
                return (
                  <tr
                    key={task.id}
                    tabIndex={0}
                    data-testid={`task-row-${task.id}`}
                    aria-selected={selected?.id === task.id}
                    onClick={() => setSelectedId(task.id)}
                    onKeyDown={(event) => onRowKeyDown(event, task.id)}
                    className={`cursor-pointer border-b border-border/70 ${selected?.id === task.id ? 'bg-accent-soft/60' : 'hover:bg-accent-soft/30'}`}
                  >
                    <td className="py-2.5 pl-5">
                      <span className={priorityChipClass(task.priority)}>{task.priority}</span>
                    </td>
                    <td className="px-3 py-2.5 font-medium">
                      <span className="block truncate" title={task.action}>
                        {task.action}
                      </span>
                    </td>
                    <td className="truncate px-3 py-2.5 text-ink-muted">{task.projectName || '—'}</td>
                    <td className="truncate px-3 py-2.5 text-ink-muted">{entity}</td>
                    <td className="truncate px-3 py-2.5 text-ink-muted">{task.owner || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{formatDate(task.dueDate)}</td>
                    {/* Fixed column: every triangle lines up, whatever the length of the date. */}
                    <td className="p-0 text-center" data-testid={`task-warning-${task.id}`}>
                      <WarningTriangle warning={warning} />
                    </td>
                    <td className="py-2 pr-5 pl-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                      <select
                        aria-label={`Status of ${task.action}`}
                        value={task.status}
                        data-testid={`task-status-${task.id}`}
                        onChange={(e) => {
                          void saveTask(task.id, { status: e.target.value })
                        }}
                        className={`h-7 min-w-0 flex-1 rounded-md border px-1.5 text-[11px] font-semibold outline-none focus:ring-2 focus:ring-accent/30 ${STATUS_STYLE[task.status] ?? STATUS_STYLE.Open}`}
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      {doneRow && (
                        <button type="button" aria-label={`Move ${task.action} to Task History`} title="Move to Task History" onClick={() => setArchiveAsk({ id: task.id, action: task.action })} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#bfe0cf] text-success hover:bg-success-bg" data-testid={`task-archive-${task.id}`}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!loading && visible.length === 0 && <p className="px-6 py-8 text-sm text-ink-muted">No tasks match these filters.</p>}
        </div>
        <Pagination {...view} onPage={(next) => setPageState({ key: filterKey, page: next })} noun={visible.length === 1 ? 'task' : 'tasks'} testId="tasks-pagination" />
      </ContentCard>

      <SideDrawer open={Boolean(selected)} onRequestClose={requestClose} label="Edit task" testId="task-drawer">
        {selected && (
          <TaskEditor
            ref={editorRef}
            mode="existing"
            task={selected}
            onClose={closeEditor}
            onDeleted={closeEditor}
            footerExtra={<ProfileLinkButton opportunityId={opportunities.some((o) => o.id === selected.opportunityId) ? selected.opportunityId : null} missingText="This task is not linked to an opportunity." tab="tasks" focus={{ task: selected.id }} />}
          />
        )}
      </SideDrawer>

      <NewTaskDrawer open={draftOpen} onClose={() => setDraftOpen(false)} onCreated={(created) => setNotice(`Task “${created.action}” created.`)} />

      <SideDrawer open={historyOpen} onRequestClose={() => setHistoryOpen(false)} label="Task History" width="max-w-[520px]" testId="task-history-drawer">
        <DrawerHeader
          title="Task History"
          subtitle="Completed, archived and deleted tasks"
          onClose={() => setHistoryOpen(false)}
          closeLabel="Close task history"
          actions={
            <button type="button" onClick={() => navigate('/tasks/history')} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/25 px-2.5 text-xs font-semibold text-white hover:bg-white/10" data-testid="task-history-view-all">
              <Expand className="h-3.5 w-3.5" /> View All
            </button>
          }
        />
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilterControl value={historyPeriod} onChange={setHistoryPeriod} allowLast30 testId="task-history-period" />
            <button type="button" onClick={() => setHistoryPeriod(LAST_30_DAYS)} disabled={isLast30(historyPeriod)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-40" data-testid="task-history-clear-filter">
              <X className="h-3.5 w-3.5" /> Clear filter
            </button>
          </div>
          <span className="text-xs font-semibold text-ink-muted">{history.length} task{history.length === 1 ? '' : 's'}</span>
        </div>
        <div ref={historyScroll} className="custom-scroll min-h-0 flex-1 overflow-y-auto">
          <TaskHistoryList rows={history} />
        </div>
      </SideDrawer>
      <ConfirmDialog
        open={archiveAsk != null}
        title="Move this completed task to Task History?"
        message={archiveAsk?.action ?? ''}
        confirmLabel="Confirm"
        tone="default"
        onCancel={() => setArchiveAsk(null)}
        onConfirm={() => {
          const ask = archiveAsk
          setArchiveAsk(null)
          if (ask) void archiveTask(ask.id).then(() => setNotice(`“${ask.action}” moved to Task History.`))
        }}
      />
    </PageShell>
  )
}
