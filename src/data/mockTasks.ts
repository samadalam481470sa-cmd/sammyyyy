import type { ActivityItem, AttentionAlert, PriorityTask } from '@/types'

/**
 * Mock supporting dashboard data.
 * Replace with API-backed feeds in a future sprint.
 */

export const mockPriorityTasks: PriorityTask[] = [
  {
    id: 'task-1',
    priority: 'A',
    action: 'Review initial materials',
    projectId: 'opp-guardian',
    projectName: 'Project Guardian',
    owner: 'Dennis DiCapua',
    dueDate: '2026-09-26',
  },
  {
    id: 'task-2',
    priority: 'A',
    action: 'Schedule follow-up with management',
    projectId: 'opp-jugular',
    projectName: 'Project Jugular',
    owner: 'Mary Sbaschnig',
    dueDate: '2026-09-24',
  },
  {
    id: 'task-3',
    priority: 'A',
    action: 'Finalize LOI term sheet',
    projectId: 'opp-beacon',
    projectName: 'Project Beacon',
    owner: 'Dennis DiCapua',
    dueDate: '2026-09-28',
  },
  {
    id: 'task-4',
    priority: 'B',
    action: 'Review diligence findings pack',
    projectId: 'opp-summit',
    projectName: 'Project Summit',
    owner: 'Mary Sbaschnig',
    dueDate: '2026-09-27',
  },
  {
    id: 'task-5',
    priority: 'B',
    action: 'Confirm exclusivity extension',
    projectId: 'opp-atlas',
    projectName: 'Project Atlas',
    owner: 'Dennis DiCapua',
    dueDate: '2026-09-30',
  },
]

export const mockActivity: ActivityItem[] = [
  {
    id: 'act-1',
    actor: 'Dennis DiCapua',
    message: 'moved Project Guardian to NDA',
    projectName: 'Project Guardian',
    timestamp: '2026-09-25T14:00:00Z',
    type: 'stage_change',
  },
  {
    id: 'act-2',
    actor: 'Mary Sbaschnig',
    message: 'added a note to Project Beacon',
    projectName: 'Project Beacon',
    timestamp: '2026-09-25T11:00:00Z',
    type: 'note',
  },
  {
    id: 'act-3',
    actor: null,
    message: 'Initial materials uploaded for Project Jugular',
    projectName: 'Project Jugular',
    timestamp: '2026-09-24T18:00:00Z',
    type: 'document',
  },
  {
    id: 'act-4',
    actor: 'Mary Sbaschnig',
    message: 'moved Project Summit from Pending to Active',
    projectName: 'Project Summit',
    timestamp: '2026-09-24T16:00:00Z',
    type: 'status_change',
  },
  {
    id: 'act-5',
    actor: 'Dennis DiCapua',
    message: 'updated LOI for Project Atlas',
    projectName: 'Project Atlas',
    timestamp: '2026-09-23T15:00:00Z',
    type: 'update',
  },
  {
    id: 'act-6',
    actor: 'Dennis DiCapua',
    message: 'logged a call on Project Harbor',
    projectName: 'Project Harbor',
    timestamp: '2026-09-20T12:00:00Z',
    type: 'note',
  },
]

export const mockAlerts: AttentionAlert[] = [
  {
    id: 'alert-1',
    reason: 'Next action overdue',
    projectId: 'opp-jugular',
    projectName: 'Project Jugular',
    detail: 'Schedule follow-up was due Sep 24',
  },
  {
    id: 'alert-2',
    reason: 'No next action assigned',
    projectId: 'opp-vertex',
    projectName: 'Project Vertex',
    detail: 'No next action on this active opportunity',
  },
  {
    id: 'alert-3',
    reason: 'No activity in 30+ days',
    projectId: 'opp-vertex',
    projectName: 'Project Vertex',
    detail: 'Last activity Aug 18',
  },
  {
    id: 'alert-4',
    reason: 'Upcoming deadline within 7 days',
    projectId: 'opp-summit',
    projectName: 'Project Summit',
    detail: 'Diligence findings review due Sep 27',
  },
  {
    id: 'alert-5',
    reason: 'No deal owner assigned',
    projectId: 'opp-cipher',
    projectName: 'Project Cipher',
    detail: 'Pending opportunity needs a deal lead',
  },
]
