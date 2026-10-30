import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Filter, History, Plus, Search, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useData } from '@/data/DataContext'
import type { TaskRecord } from '@/data/mockModules'
import { isActiveListTask, isHistoryTask } from '@/lib/taskLifecycle'
import {
  isOnTrackTask,
  isOverdueUnfinishedTask,
  sortVisibleTasks,
} from '@/lib/taskSort'
import { taskWarning } from '@/lib/taskWarning'
import { NewTaskDrawer } from '@/components/tasks/NewTaskDrawer'
import { ProfileLinkButton } from '@/components/profile/ProfileLinkButton'
import { formatDate } from '@/utils/dashboard'
import { WarningTriangle } from '@/components/shared/WarningTriangle'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import type { OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'
import { paginate } from '@/lib/paginate'
import { usePageFor } from '@/hooks/usePageFor'
import { useFitRows } from '@/hooks/useFitRows'
import { Pagination } from '@/components/shared/Pagination'
import { FilterChips, type ActiveFilterChip } from '@/components/shared/FilterChips'

const PRIORITY_BADGES: Record<string, string> = {
  A: 'bg-navy-900 text-white',
  B: 'bg-accent-soft text-navy-800',
  C: 'bg-canvas text-ink-muted border border-border',
}

type TaskListFilter = 'all' | 'overdue' | 'on-track'

export function TasksPage() {
  const { tasks, opportunities, users, archiveTask, loading } = useData()
  const [params, setParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftOpen, setDraftOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<TaskRecord | null>(null)
  const [listFilter, setListFilter] = useState<TaskListFilter>(() => {
    const value = params.get('filter')
    return value === 'overdue' || value === 'on-track' ? value : 'all'
  })
  const [projectFilter, setProjectFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [page, setPage] = usePageFor(JSON.stringify([search, listFilter, projectFilter, ownerFilter]))
  const editorRef = useRef<OpportunityEditorHandle>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const pageSize = useFitRows(tableRef, { rowHeight: 49 })

  // Links such as the bell's "View all in Tasks" arrive with ?filter=overdue.
  useEffect(() => {
    const value = params.get('filter')
    if (value === 'overdue' || value === 'on-track' || value === 'all') {
      setListFilter(value)
      setPage(1)
    }
  }, [params])

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const projectOptions = useMemo(
    () =>
      [...opportunities]
        .filter((o) => o.projectName.trim())
        .sort((a, b) => a.projectName.localeCompare(b.projectName, undefined, { numeric: true }))
        .map((o) => ({ id: o.id, name: o.projectName })),
    [opportunities],
  )
  const ownerOptions = useMemo(() => {
    const names = new Set<string>()
    users.forEach((u) => names.add(u.name))
    tasks.forEach((t) => {
      if (t.owner?.trim()) names.add(t.owner.trim())
    })
    return [...names].sort()
  }, [users, tasks])

  useEffect(() => {
    const next = new URLSearchParams(params)
    let changed = false
    if (params.get('new') === '1') {
      setDraftOpen(true)
      setSelectedId(null)
      next.delete('new')
      changed = true
    }
    const select = params.get('select')
    if (select) {
      setDraftOpen(false)
      setSelectedId(select)
      next.delete('select')
      changed = true
    }
    if (changed) setParams(next, { replace: true })
  }, [params, setParams])

  const activeTasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = tasks.filter((task) => {
      if (!isActiveListTask(task)) return false
      if (listFilter === 'overdue' && !isOverdueUnfinishedTask(task)) return false
      if (listFilter === 'on-track' && !isOnTrackTask(task)) return false
      if (projectFilter && task.opportunityId !== projectFilter) return false
      if (ownerFilter && (task.owner ?? '').trim() !== ownerFilter) return false
      if (!q) return true
      const entity = opportunities.find((o) => o.id === task.opportunityId)?.entityName ?? ''
      return `${task.action} ${task.projectName} ${task.owner} ${entity}`.toLowerCase().includes(q)
    })
    return sortVisibleTasks(rows)
  }, [tasks, search, opportunities, listFilter, projectFilter, ownerFilter])

  const view = paginate(activeTasks, page, pageSize)

  const setPill = (value: TaskListFilter) => {
    setListFilter(value)
    if (params.get('filter')) {
      const next = new URLSearchParams(params)
      next.delete('filter')
      setParams(next, { replace: true })
    }
  }
  const projectLabel = projectOptions.find((p) => p.id === projectFilter)?.name ?? ''
  const chips: ActiveFilterChip[] = [
    ...(projectFilter ? [{ key: 'project', label: `Project: ${projectLabel || 'Unknown'}`, onRemove: () => setProjectFilter('') }] : []),
    ...(ownerFilter ? [{ key: 'owner', label: `Task Owner: ${ownerFilter}`, onRemove: () => setOwnerFilter('') }] : []),
    ...(search.trim() ? [{ key: 'search', label: `Search: ${search.trim()}`, onRemove: () => setSearch('') }] : []),
  ]
  const clearAll = () => {
    setProjectFilter('')
    setOwnerFilter('')
    setSearch('')
  }

  const historyTasks = useMemo(
    () => tasks.filter((task) => isHistoryTask(task)),
    [tasks],
  )

  const selected = selectedId ? (tasks.find((t) => t.id === selectedId) ?? null) : null
  // New tasks open in the dimmed creation drawer; only editing an existing task uses the side panel.
  const editorOpen = Boolean(selected)

  const closeEditor = () => {
    setSelectedId(null)
    setDraftOpen(false)
  }

  const openDraft = () => {
    const startFresh = () => {
      setSelectedId(null)
      setDraftOpen(true)
    }
    if (editorRef.current?.isDirty()) editorRef.current.requestLeave(startFresh)
    else startFresh()
  }

  const onRowActivate = (id: string) => {
    if (selectedId === id) {
      if (editorRef.current) editorRef.current.requestLeave(closeEditor)
      else closeEditor()
      return
    }
    if (editorRef.current) editorRef.current.requestLeave(() => setSelectedId(id))
    else setSelectedId(id)
  }

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onRowActivate(id)
    }
  }

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-none flex-col overflow-hidden">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-surface px-6 py-5 lg:px-8">
        <div>
          <h1 className="font-brand text-2xl font-bold text-navy-900">Tasks & Follow-Ups</h1>
          <p className="mt-1 text-sm text-ink-muted">
            A = must move this week · B = important but can wait · C = monitor only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-ink hover:bg-canvas"
          >
            <History className="h-4 w-4" />
            Task History
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="h-10 w-full rounded-lg border border-border bg-canvas pr-3 pl-9 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:w-56"
            />
          </div>
          <button
            type="button"
            onClick={openDraft}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-navy-900 px-3.5 text-sm font-semibold text-white hover:bg-navy-800"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-canvas px-6 py-3 lg:px-8">
        {(
          [
            ['all', 'All Tasks'],
            ['overdue', 'Overdue'],
            ['on-track', 'On Track'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPill(id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              listFilter === id
                ? 'border-navy-900 bg-navy-900 text-white'
                : 'border-border bg-surface text-ink-muted'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              aria-expanded={filterOpen}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold ${
                projectFilter || ownerFilter ? 'border-navy-900 bg-navy-900 text-white' : 'border-border bg-surface text-ink'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filter
            </button>
            {filterOpen && (
              <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-border bg-surface p-4 shadow-(--shadow-elevated)">
                <label className="block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase" htmlFor="task-filter-project">
                  Project
                </label>
                <select
                  id="task-filter-project"
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                >
                  <option value="">All projects</option>
                  {projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <label className="mt-3 block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase" htmlFor="task-filter-owner">
                  Task Owner (assigned)
                </label>
                <select
                  id="task-filter-owner"
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm"
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                >
                  <option value="">All task owners</option>
                  {ownerOptions.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
      {chips.length > 0 && (
        <div className="border-b border-border bg-canvas px-6 py-2 lg:px-8">
          <FilterChips chips={chips} onClearAll={clearAll} />
        </div>
      )}

      <div
        className={
          editorOpen
            ? 'grid min-h-0 w-full flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[minmax(0,1fr)]'
            : 'flex min-h-0 w-full flex-1 flex-col'
        }
      >
        <div className={`flex min-h-0 min-w-0 w-full flex-1 flex-col ${editorOpen ? 'border-r border-border' : ''}`}>
        <div ref={tableRef} className="custom-scroll min-h-0 w-full flex-1 overflow-auto">
          {loading && <p className="px-6 py-8 text-sm text-ink-muted">Loading records…</p>}
          <ul className="divide-y divide-border sm:hidden" aria-label="Tasks">
            {view.rows.map((task) => {
              const warning = taskWarning(task)
              return (
                <li key={task.id} data-card-row>
                  <button type="button" onClick={() => onRowActivate(task.id)} className={`flex w-full items-start gap-3 px-4 py-3 text-left ${selected?.id === task.id ? 'bg-accent-soft/60' : ''}`}>
                    <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${PRIORITY_BADGES[task.priority] ?? PRIORITY_BADGES.C}`}>{task.priority}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">
                        <span className="truncate">{task.action}</span>
                        <WarningTriangle warning={warning} />
                      </span>
                      <span className="block truncate text-xs text-ink-muted">{task.projectName || 'No project'} · {task.owner || 'Unassigned'}</span>
                      <span className="block text-xs text-ink-muted">Due {formatDate(task.dueDate)} · {task.status}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <table className="hidden w-full min-w-[760px] table-fixed text-left text-sm sm:table">
            <colgroup>
              <col className="w-[8%]" />
              <col className="w-[22%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="sticky top-0 bg-canvas text-[11px] tracking-[0.06em] text-ink-subtle uppercase">
              <tr className="border-b border-border">
                <th className="px-5 py-3 font-semibold">Priority</th>
                <th className="px-3 py-3 font-semibold">Action</th>
                <th className="px-3 py-3 font-semibold">Project Name</th>
                <th className="px-3 py-3 font-semibold">Company Name</th>
                <th className="px-3 py-3 font-semibold">Owner</th>
                <th className="px-3 py-3 font-semibold">Due Date</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((task) => {
                const active = selected?.id === task.id
                const entity =
                  opportunities.find((o) => o.id === task.opportunityId)?.entityName ?? '—'
                const warning = taskWarning(task)
                return (
                  <tr
                    key={task.id}
                    tabIndex={0}
                    data-testid={`task-row-${task.id}`}
                    aria-selected={active}
                    onClick={() => onRowActivate(task.id)}
                    onKeyDown={(event) => onRowKeyDown(event, task.id)}
                    className={`cursor-pointer border-b border-border/70 ${
                      active ? 'bg-accent-soft/60' : 'hover:bg-accent-soft/30'
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${PRIORITY_BADGES[task.priority] ?? PRIORITY_BADGES.C}`}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 font-medium">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate">{task.action}</span>
                        <WarningTriangle warning={warning} />
                      </span>
                    </td>
                    <td className="truncate px-3 py-3.5 text-ink-muted">{task.projectName || '—'}</td>
                    <td className="truncate px-3 py-3.5 text-ink-muted">{entity}</td>
                    <td className="truncate px-3 py-3.5 text-ink-muted">{task.owner || '—'}</td>
                    <td className="px-3 py-3.5 whitespace-nowrap text-ink-muted">{formatDate(task.dueDate)}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            task.status === 'Done'
                              ? 'bg-success-bg text-success'
                              : task.status === 'In Progress'
                                ? 'bg-accent-soft text-navy-800'
                                : 'bg-warning-bg text-warning'
                          }`}
                        >
                          {task.status}
                        </span>
                        {task.status === 'Done' && (
                          <button
                            type="button"
                            className="rounded p-0.5 text-ink-subtle hover:bg-canvas hover:text-ink"
                            aria-label="Archive completed task"
                            onClick={(e) => {
                              e.stopPropagation()
                              setArchiveTarget(task)
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!loading && activeTasks.length === 0 && (
            <p className="px-6 py-8 text-sm text-ink-muted">No tasks match these filters.</p>
          )}
        </div>
        <Pagination {...view} onPage={setPage} noun={activeTasks.length === 1 ? 'task' : 'tasks'} testId="tasks-pagination" />
        </div>

        {editorOpen && selected && (
          <aside className="min-h-0 overflow-hidden bg-surface">
            <TaskEditor
              ref={editorRef}
              mode="existing"
              task={selected}
              onClose={closeEditor}
              onDeleted={closeEditor}
              footerExtra={
                <ProfileLinkButton
                  opportunityId={opportunities.some((o) => o.id === selected.opportunityId) ? selected.opportunityId : null}
                  missingText="This task is not linked to an opportunity."
                />
              }
            />
          </aside>
        )}
      </div>

      <NewTaskDrawer
        open={draftOpen}
        onClose={() => setDraftOpen(false)}
        onCreated={(created) => setSelectedId(created.id)}
      />

      {archiveTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-navy-950/45"
            onClick={() => setArchiveTarget(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-5">
            <h3 className="font-brand text-xl font-bold text-navy-900">Is this task completed?</h3>
            <p className="mt-2 text-sm text-ink-muted">
              Yes archives it immediately (hides it from the active list and shows it in Task
              History). No cancels.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                className="h-10 rounded-lg bg-navy-900 text-sm font-semibold text-white"
                onClick={() => {
                  void archiveTask(archiveTarget.id)
                  setArchiveTarget(null)
                }}
              >
                Yes
              </button>
              <button
                type="button"
                className="h-10 rounded-lg text-sm font-semibold text-ink-muted"
                onClick={() => setArchiveTarget(null)}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-[80] flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-navy-950/40"
            onClick={() => setHistoryOpen(false)}
          />
          <aside className="relative flex h-full w-full max-w-lg flex-col bg-surface shadow-(--shadow-drawer)">
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-brand text-xl font-bold text-navy-900">Task History</h2>
                <p className="text-sm text-ink-muted">Completed and archived tasks only</p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas"
                onClick={() => setHistoryOpen(false)}
                aria-label="Close task history"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="custom-scroll flex-1 overflow-auto">
              {historyTasks.length === 0 && (
                <p className="px-5 py-8 text-sm text-ink-muted">No archived tasks yet.</p>
              )}
              <ul className="divide-y divide-border">
                {historyTasks.map((task) => {
                  const entity =
                    opportunities.find((o) => o.id === task.opportunityId)?.entityName ?? '—'
                  return (
                    <li key={task.id} className="px-5 py-4">
                      <p className="font-semibold text-navy-900">{task.action}</p>
                      <p className="mt-1 text-sm text-ink-muted">
                        {task.projectName || 'Unlinked'} · {entity}
                      </p>
                      <p className="mt-1 text-xs text-ink-subtle">
                        {task.owner || 'Unassigned'} · Priority {task.priority} · Due{' '}
                        {formatDate(task.dueDate)}
                      </p>
                      <p className="mt-1 text-xs text-ink-subtle">
                        Completed {formatDate(task.completedAt ?? null)} · Archived{' '}
                        {formatDate(task.archivedAt ?? null)}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </div>
          </aside>
        </div>
      )}

    </div>
  )
}
