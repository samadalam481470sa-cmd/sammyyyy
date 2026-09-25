/**
 * Demo "Recent Activity" feed. Shaped as `ActivityItem[]` so a future
 * activity/audit-log API can replace it without changing the component.
 */
import type { ActivityItem } from '../types/opportunity';
import { isoTimestampHoursAgo, isoTimestampDaysAgo } from '../lib/dateUtils';

export const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: 'activity-1',
    type: 'stage_change',
    actor: 'Dennis DiCapua',
    message: 'moved Project Guardian to NDA',
    projectName: 'Project Guardian',
    timestamp: isoTimestampHoursAgo(2),
  },
  {
    id: 'activity-2',
    type: 'note',
    actor: 'Mary Sbaschnig',
    message: 'added a note to Project Beacon',
    projectName: 'Project Beacon',
    timestamp: isoTimestampHoursAgo(5),
  },
  {
    id: 'activity-3',
    type: 'document',
    actor: 'Mary Sbaschnig',
    message: 'uploaded initial materials for Project Jugular',
    projectName: 'Project Jugular',
    timestamp: isoTimestampDaysAgo(1),
  },
  {
    id: 'activity-4',
    type: 'status_change',
    actor: 'Dennis DiCapua',
    message: 'moved Project Summit from Pending to Active',
    projectName: 'Project Summit',
    timestamp: isoTimestampDaysAgo(1),
  },
  {
    id: 'activity-5',
    type: 'diligence',
    actor: 'Dennis DiCapua',
    message: 'updated the LOI for Project Atlas',
    projectName: 'Project Atlas',
    timestamp: isoTimestampDaysAgo(2),
  },
  {
    id: 'activity-6',
    type: 'task',
    actor: 'Dennis DiCapua',
    message: 'logged a call with Beacon Underwriting Group',
    projectName: 'Project Beacon',
    timestamp: isoTimestampDaysAgo(3),
  },
  {
    id: 'activity-7',
    type: 'task',
    actor: 'Mary Sbaschnig',
    message: 'scheduled a diligence kickoff for Project Sentinel',
    projectName: 'Project Sentinel',
    timestamp: isoTimestampDaysAgo(4),
  },
  {
    id: 'activity-8',
    type: 'note',
    actor: 'Dennis DiCapua',
    message: 'added Project Redwood to the pipeline',
    projectName: 'Project Redwood',
    timestamp: isoTimestampDaysAgo(5),
  },
];
