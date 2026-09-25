/**
 * Demo "This Week's Priorities" follow-ups shown on the dashboard.
 * Shaped as `PriorityTask[]` so a future task-management API can replace it.
 */
import type { PriorityTask } from '../types/opportunity';
import { isoDateOffset } from '../lib/dateUtils';

export const MOCK_PRIORITY_TASKS: PriorityTask[] = [
  {
    id: 'task-1',
    priority: 'A',
    action: 'Get LOI countersigned by seller',
    projectName: 'Project Summit',
    owner: 'Mary Sbaschnig',
    dueDate: isoDateOffset(2),
  },
  {
    id: 'task-2',
    priority: 'A',
    action: 'Resolve outstanding QoE findings',
    projectName: 'Project Beacon',
    owner: 'Dennis DiCapua',
    dueDate: isoDateOffset(1),
  },
  {
    id: 'task-3',
    priority: 'B',
    action: 'Prepare exclusivity extension memo',
    projectName: 'Project Atlas',
    owner: 'Dennis DiCapua',
    dueDate: isoDateOffset(4),
  },
  {
    id: 'task-4',
    priority: 'B',
    action: 'Confirm banker call for Orion Intermediaries',
    projectName: 'Project Jugular',
    owner: 'Mary Sbaschnig',
    dueDate: isoDateOffset(3),
  },
  {
    id: 'task-5',
    priority: 'C',
    action: 'Draft outreach note for target',
    projectName: 'Project Meridian',
    owner: 'Mary Sbaschnig',
    dueDate: isoDateOffset(6),
  },
];
