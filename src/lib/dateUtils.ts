/**
 * Small date helpers used to build realistic, always-fresh mock data and to
 * present dates/timestamps consistently across the dashboard.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO date string (YYYY-MM-DD) offset from today by `days` (negative = past). */
export function isoDateOffset(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Full ISO timestamp offset from now by `hours` (negative = past). */
export function isoTimestampHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

/** Full ISO timestamp offset from now by `days` (negative = past). */
export function isoTimestampDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

/** Number of whole days between an ISO date/timestamp and now (positive = future). */
export function daysUntil(isoDate: string): number {
  const target = new Date(isoDate).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((target - today) / DAY_MS);
}

/** Number of whole days since an ISO date/timestamp (positive = past). */
export function daysSince(isoDate: string): number {
  return -daysUntil(isoDate);
}

/** Formats an ISO date as e.g. "Oct 3" for compact table/card display. */
export function formatShortDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Formats an ISO timestamp as a friendly relative string ("2 hours ago", "Yesterday"). */
export function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = Math.max(0, now - then);
  const diffMinutes = Math.round(diffMs / (60 * 1000));
  const diffHours = Math.round(diffMs / (60 * 60 * 1000));
  const diffDays = Math.round(diffMs / DAY_MS);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return `${diffDays} days ago`;
}

/** Human-friendly relative label for a next-action date, with overdue framing. */
export function formatNextActionDate(isoDate: string | null): string {
  if (!isoDate) return 'Not scheduled';
  const diff = daysUntil(isoDate);
  if (diff < 0) return `${formatShortDate(isoDate)} (overdue)`;
  if (diff === 0) return `${formatShortDate(isoDate)} (today)`;
  if (diff === 1) return `${formatShortDate(isoDate)} (tomorrow)`;
  return formatShortDate(isoDate);
}
