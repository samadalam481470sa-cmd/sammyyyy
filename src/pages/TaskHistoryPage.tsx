import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import { useData } from '@/data/DataContext'
import { HISTORY_KIND_STYLE, useTaskHistoryRows } from '@/components/tasks/TaskHistoryList'
import { ContentCard, PageShell, PageToolbar, RecordCount, SearchBox } from '@/components/shared/PageChrome'
import { PeriodFilterControl } from '@/components/shared/PeriodFilterControl'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { FilterChips, type ActiveFilterChip } from '@/components/shared/FilterChips'
import { Pagination } from '@/components/shared/Pagination'
import { useFitRows } from '@/hooks/useFitRows'
import { useSessionState } from '@/hooks/useSessionState'
import { paginate } from '@/lib/paginate'
import { priorityChipClass } from '@/lib/priorityStyles'
import { isLast30, LAST_30_DAYS, resolvePeriod, type PeriodFilter } from '@/lib/reports'
import { formatDate } from '@/utils/dashboard'

const KEY = 'task-history'

/** Every completed, archived and deleted task, newest first. No Add Task here: history is a record. */
export function TaskHistoryPage() {
  const navigate = useNavigate()
  const { opportunities, users, tasks } = useData()
  const [search, setSearch] = useSessionState(`${KEY}:search`, '')
  const [period, setPeriod] = useSessionState<PeriodFilter>(`${KEY}:period`, LAST_30_DAYS)
  const [project, setProject] = useSessionState(`${KEY}:project`, '')
  const [owner, setOwner] = useSessionState(`${KEY}:owner`, '')
  const [pageState, setPageState] = useSessionState(`${KEY}:page`, { key: '', page: 1 })
  const tableRef = useRef<HTMLDivElement>(null)
  const pageSize = useFitRows(tableRef, { rowHeight: 45, min: 4 })
  const all = useTaskHistoryRows(period)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter(({ task, entity }) => {
      if (project && task.opportunityId !== project) return false
      if (owner && (task.owner ?? '').trim() !== owner) return false
      if (!q) return true
      return `${task.action} ${task.projectName} ${entity} ${task.owner} ${task.notes}`.toLowerCase().includes(q)
    })
  }, [all, search, project, owner])

  const filterKey = JSON.stringify([search, period, project, owner])
  const page = pageState.key === filterKey ? pageState.page : 1
  const view = paginate(rows, page, pageSize)
  const projectOptions = useMemo(() => [...opportunities].sort((a, b) => (a.projectNumber ?? 0) - (b.projectNumber ?? 0)).map((o) => ({ id: o.id, label: o.projectName })), [opportunities])
  const ownerOptions = useMemo(() => [...new Set([...users.map((u) => u.name), ...tasks.map((t) => t.owner?.trim()).filter(Boolean) as string[]])].sort().map((n) => ({ id: n, label: n })), [users, tasks])
  const resolved = resolvePeriod(period)
  const chips: ActiveFilterChip[] = [
    ...(project ? [{ key: 'project', label: `Project: ${projectOptions.find((p) => p.id === project)?.label ?? ''}`, onRemove: () => setProject('') }] : []),
    ...(owner ? [{ key: 'owner', label: `Owner: ${owner}`, onRemove: () => setOwner('') }] : []),
  ]

  // One source of truth: Clear All and Clear filter both return to the defaults.
  const clearAll = () => {
    setPeriod(LAST_30_DAYS)
    setProject('')
    setOwner('')
    setSearch('')
    setPageState({ key: '', page: 1 })
  }
  const atDefaults = isLast30(period) && !project && !owner && !search

  return (
    <PageShell testId="task-history-page">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 pt-4 pb-3 lg:px-8">
        <div>
          <button type="button" onClick={() => navigate('/tasks', { state: { restore: true } })} className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink" data-testid="task-history-back">
            <ArrowLeft className="h-3.5 w-3.5" /> Tasks & Follow-Ups
          </button>
          <h1 className="font-brand text-2xl leading-tight font-bold text-navy-900">Task History</h1>
          <p className="text-sm text-ink-muted">Completed, archived and deleted tasks with their original due dates. Paused tasks of inactive deals are not history; they stay open on their profiles.</p>
        </div>
        <SearchBox value={search} onChange={setSearch} placeholder="Search task history" testId="task-history-search" />
      </header>
      <PageToolbar
        left={
          <>
            <PeriodFilterControl value={period} onChange={setPeriod} allowLast30 testId="task-history-page-period" />
            <div className="w-52">
              <SearchSelect value={project || null} options={projectOptions} onChange={(v) => setProject(v ?? '')} placeholder="All projects" />
            </div>
            <div className="w-44">
              <SearchSelect value={owner || null} options={ownerOptions} onChange={(v) => setOwner(v ?? '')} placeholder="All owners" />
            </div>
            <button type="button" onClick={clearAll} disabled={atDefaults} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-40" data-testid="task-history-page-clear-filter">
              <X className="h-3.5 w-3.5" /> Clear filter
            </button>
          </>
        }
        right={
          <>
            <FilterChips chips={chips} onClearAll={clearAll} />
            <RecordCount count={rows.length} noun={['task', 'tasks']} />
            <span className="text-xs text-ink-muted">{resolved.label}</span>
          </>
        }
      />
      <ContentCard>
        <div ref={tableRef} className="custom-scroll min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[900px] table-fixed text-left text-sm" data-testid="task-history-table">
            <colgroup>
              <col className="w-[76px]" />
              <col />
              <col className="w-[13%]" />
              <col className="w-[13%]" />
              <col className="w-[150px]" />
              <col className="w-[150px]" />
              <col className="w-[140px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-surface text-[11px] tracking-[0.06em] text-ink-subtle uppercase shadow-[inset_0_-1px_0_var(--color-border)]">
              <tr>
                <th className="py-3 pl-5 font-semibold">Priority</th>
                <th className="px-3 py-3 font-semibold">Action</th>
                <th className="px-3 py-3 font-semibold">Project</th>
                <th className="px-3 py-3 font-semibold">Owner</th>
                <th className="px-3 py-3 font-semibold">Original due</th>
                <th className="px-3 py-3 font-semibold">Closed on</th>
                <th className="py-3 pr-5 pl-3 font-semibold">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map(({ task, kind, at }) => (
                <tr key={task.id} className="border-b border-border/70">
                  <td className="py-2.5 pl-5">
                    <span className={priorityChipClass(task.priority)}>{task.priority}</span>
                  </td>
                  <td className="truncate px-3 py-2.5 font-medium text-ink" title={task.action}>{task.action}</td>
                  <td className="truncate px-3 py-2.5 text-ink-muted">{task.projectName || 'Unlinked'}</td>
                  <td className="truncate px-3 py-2.5 text-ink-muted">{task.owner || 'Unassigned'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted" title={task.dueDateHistory?.length ? `Moved ${task.dueDateHistory.length} time(s); last due ${formatDate(task.dueDate)}` : undefined}>
                    {formatDate(task.initialDueDate ?? task.dueDate)}
                    {task.initialDueDate && task.dueDate && task.initialDueDate !== task.dueDate && <span className="ml-1 text-[11px] text-ink-subtle">→ {formatDate(task.dueDate)}</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{formatDate(at)}</td>
                  <td className="py-2.5 pr-5 pl-3">
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${HISTORY_KIND_STYLE[kind]}`}>{kind}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-6 py-8 text-sm text-ink-muted">No task history in this period. Choose All Time or another date range to see older records.</p>}
        </div>
        <Pagination {...view} onPage={(next) => setPageState({ key: filterKey, page: next })} noun={rows.length === 1 ? 'task' : 'tasks'} testId="task-history-pagination" />
      </ContentCard>
    </PageShell>
  )
}
