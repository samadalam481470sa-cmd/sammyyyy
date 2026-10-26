import type { ActivityItem, AttentionAlert, PriorityTask } from '@/types'
import { anonymousProjectName } from '../lib/demoAliases'

/**
 * Mock supporting dashboard data.
 * Replace with API-backed feeds in a future sprint.
 * Labels are synthetic sample data for illustration only.
 */

export const mockPriorityTasks: PriorityTask[] = [
  {
    id: 'task-1',
    priority: 'A',
    action: 'Review sample materials',
    projectId: 'opp-a',
    projectName: anonymousProjectName('opp-a'),
    owner: 'Dennis DiCapua',
    dueDate: '2026-09-26',
  },
  {
    id: 'task-2',
    priority: 'A',
    action: 'Schedule follow-up with management',
    projectId: 'opp-b',
    projectName: anonymousProjectName('opp-b'),
    owner: 'Mary Sbaschnig',
    dueDate: '2026-09-24',
  },
  {
    id: 'task-3',
    priority: 'A',
    action: 'Finalize sample LOI term sheet',
    projectId: 'opp-c',
    projectName: anonymousProjectName('opp-c'),
    owner: 'Dennis DiCapua',
    dueDate: '2026-09-28',
  },
  {
    id: 'task-4',
    priority: 'B',
    action: 'Review sample diligence pack',
    projectId: 'opp-d',
    projectName: anonymousProjectName('opp-d'),
    owner: 'Mary Sbaschnig',
    dueDate: '2026-09-27',
  },
  {
    id: 'task-5',
    priority: 'B',
    action: 'Confirm sample exclusivity extension',
    projectId: 'opp-e',
    projectName: anonymousProjectName('opp-e'),
    owner: 'Dennis DiCapua',
    dueDate: '2026-09-30',
  },
]

export const mockActivity: ActivityItem[] = [
  {
    id: 'act-1',
    actor: 'Dennis DiCapua',
    message: `moved ${anonymousProjectName('opp-a')} to NDA`,
    projectName: anonymousProjectName('opp-a'),
    timestamp: '2026-09-25T14:00:00Z',
    type: 'stage_change',
  },
  {
    id: 'act-2',
    actor: 'Mary Sbaschnig',
    message: `added a note to ${anonymousProjectName('opp-c')}`,
    projectName: anonymousProjectName('opp-c'),
    timestamp: '2026-09-25T11:00:00Z',
    type: 'note',
  },
  {
    id: 'act-3',
    actor: null,
    message: `Initial materials uploaded for ${anonymousProjectName('opp-b')}`,
    projectName: anonymousProjectName('opp-b'),
    timestamp: '2026-09-24T18:00:00Z',
    type: 'document',
  },
  {
    id: 'act-4',
    actor: 'Mary Sbaschnig',
    message: `moved ${anonymousProjectName('opp-d')} from Pending to Active`,
    projectName: anonymousProjectName('opp-d'),
    timestamp: '2026-09-24T16:00:00Z',
    type: 'status_change',
  },
  {
    id: 'act-5',
    actor: 'Dennis DiCapua',
    message: `updated LOI for ${anonymousProjectName('opp-e')}`,
    projectName: anonymousProjectName('opp-e'),
    timestamp: '2026-09-23T15:00:00Z',
    type: 'update',
  },
  {
    id: 'act-6',
    actor: 'Dennis DiCapua',
    message: `logged a call on ${anonymousProjectName('opp-f')}`,
    projectName: anonymousProjectName('opp-f'),
    timestamp: '2026-09-20T12:00:00Z',
    type: 'note',
  },
]

export const mockAlerts: AttentionAlert[] = [
  {
    id: 'alert-1',
    reason: 'Next action overdue',
    projectId: 'opp-b',
    projectName: anonymousProjectName('opp-b'),
    detail: 'Schedule follow-up was due Sep 24',
  },
  {
    id: 'alert-2',
    reason: 'No next action assigned',
    projectId: 'opp-g',
    projectName: anonymousProjectName('opp-g'),
    detail: 'No next action on this active opportunity',
  },
  {
    id: 'alert-3',
    reason: 'No activity in 30+ days',
    projectId: 'opp-g',
    projectName: anonymousProjectName('opp-g'),
    detail: 'Last activity Aug 18',
  },
  {
    id: 'alert-4',
    reason: 'Upcoming deadline within 7 days',
    projectId: 'opp-d',
    projectName: anonymousProjectName('opp-d'),
    detail: 'Diligence findings review due Sep 27',
  },
  {
    id: 'alert-5',
    reason: 'No deal owner assigned',
    projectId: 'opp-h',
    projectName: anonymousProjectName('opp-h'),
    detail: 'Pending opportunity needs a deal lead',
  },
]
