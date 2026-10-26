import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { History, Plus, Search, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useData } from '@/data/DataContext'
import type { TaskRecord } from '@/data/mockModules'
import { isActiveListTask, isHistoryTask } from '@/lib/taskLifecycle'
import {
  isOnTrackTask,
  isOverdueUnfinishedTask,
  sortVisibleTasks,
} from '@/lib/taskSort'
import { formatDate } from '@/utils/dashboard'
import { WarningTriangle } from '@/components/shared/WarningTriangle'
import {
  emptyTaskDraft,
  TaskEditor,
} from '@/components/tasks/TaskEditor'
import type { OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'

const PRIORITY_BADGES: Record<string, string> = {
  A: 'bg-navy-900 text-white',
  B: 'bg-accent-soft text-navy-800',
  C: 'bg-canvas text-ink-muted border border-border',
}

type TaskListFilter = 'all' | 'overdue' | 'on-track'

export function TasksPage() {
  const { tasks, opportunities, archiveTask, loading } = useData()
  const [params, setParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftOpen, setDraftOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<TaskRecord | null>(null)
  const [draftKey, setDraftKey] = useState(0)
  const [listFilter, setListFilter] = useState<TaskListFilter>('all')
  const editorRef = useRef<OpportunityEditorHandle>(null)

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
      if (!q) return true
      const entity = opportunities.find((o) => o.id === task.opportunityId)?.entityName ?? ''
      return `${task.action} ${task.projectName} ${task.owner} ${entity}`.toLowerCase().includes(q)
    })
    return sortVisibleTasks(rows)
  }, [tasks, search, opportunities, listFilter])

  const historyTasks = useMemo(
    () => tasks.filter((task) => isHistoryTask(task)),
    [tasks],
  )

  const selected = selectedId ? (tasks.find((t) => t.id === selectedId) ?? null) : null
  const editorOpen = draftOpen || Boolean(selected)

  const closeEditor = () => {
    setSelectedId(null)
    setDraftOpen(false)
  }

  const openDraft = () => {
    const startFresh = () => {
      setSelectedId(null)
      setDraftOpen(true)
      setDraftKey((k) => k + 1)
    }
    if (editorRef.current?.isDirty()) editorRef.current.requestLeave(startFresh)
    else startFresh()
  }

  const onRowActivate = (id: string) => {
    if (draftOpen) {
      const go = () => {
        setDraftOpen(false)
        setSelectedId(id)
      }
      if (editorRef.current) editorRef.current.requestLeave(go)
      else go()
      return
    }
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
    <div className="flex min-h-0 flex-1 flex-col">
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
              className="h-10 w-56 rounded-lg border border-border bg-canvas pr-3 pl-9 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
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
            onClick={() => setListFilter(id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              listFilter === id
                ? 'border-navy-900 bg-navy-900 text-white'
                : 'border-border bg-surface text-ink-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className={
          editorOpen
            ? 'grid min-h-0 w-full flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]'
            : 'flex min-h-0 w-full flex-1 flex-col'
        }
      >
        <div
          className={`custom-scroll min-h-0 min-w-0 w-full flex-1 overflow-auto ${
            editorOpen ? 'border-r border-border' : ''
          }`}
        >
          {loading && <p className="px-6 py-8 text-sm text-ink-muted">Loading records…</p>}
          <table className="w-full table-fixed text-left text-sm">
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
              {activeTasks.map((task) => {
                const active = !draftOpen && selected?.id === task.id
                const entity =
                  opportunities.find((o) => o.id === task.opportunityId)?.entityName ?? '—'
                const overdue = isOverdueUnfinishedTask(task)
                return (
                  <tr
                    key={task.id}
                    tabIndex={0}
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
                        {overdue && (
                          <WarningTriangle
                            warning={{
                              level: 'red',
                              reason: 'Next action overdue',
                              detail: `${task.action} is overdue`,
                            }}
                          />
                        )}
                      </span>
                    </td>
                    <td className="truncate px-3 py-3.5 text-ink-muted">{task.projectName || '—'}</td>
                    <td className="truncate px-3 py-3.5 text-ink-muted">{entity}</td>
                    <td className="truncate px-3 py-3.5 text-ink-muted">{task.owner || '—'}</td>
                    <td className="px-3 py-3.5 text-ink-muted">{formatDate(task.dueDate)}</td>
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
        </div>

        {editorOpen && (
          <aside className="min-h-[480px] bg-surface lg:h-[calc(100vh-11rem)]">
            {draftOpen ? (
              <TaskEditor
                key={draftKey}
                ref={editorRef}
                mode="draft"
                draftSeed={emptyTaskDraft()}
                onClose={closeEditor}
                onSaved={(created) => {
                  setDraftOpen(false)
                  setSelectedId(created.id)
                }}
                onDeleted={closeEditor}
              />
            ) : (
              selected && (
                <TaskEditor
                  ref={editorRef}
                  mode="existing"
                  task={selected}
                  onClose={closeEditor}
                  onDeleted={closeEditor}
                />
              )
            )}
          </aside>
        )}
      </div>

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
