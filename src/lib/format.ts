/** Formatting helpers shared across the CRM. */

const CURRENCY_PREFIX = '$';

/**
 * Compact USD formatting tuned for deal figures: `$184M`, `$26.4M`, `$1.2B`.
 * Values of $100M and above drop the decimal to keep executive cards clean.
 */
export function formatCurrencyCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}${CURRENCY_PREFIX}${trimZero(abs / 1_000_000_000, 1)}B`;
  }
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    return `${sign}${CURRENCY_PREFIX}${trimZero(millions, millions >= 100 ? 0 : 1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${CURRENCY_PREFIX}${trimZero(abs / 1_000, 0)}K`;
  }
  return `${sign}${CURRENCY_PREFIX}${Math.round(abs)}`;
}

function trimZero(value: number, fractionDigits: number): string {
  return value.toFixed(fractionDigits);
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Whole calendar days from `now` to `iso`. Negative when in the past. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const target = startOfDay(new Date(iso)).getTime();
  const today = startOfDay(now).getTime();
  return Math.round((target - today) / 86_400_000);
}

/** Whole calendar days since `iso`. */
export function daysSince(iso: string, now: Date = new Date()): number {
  return -daysUntil(iso, now);
}

export function formatDateShort(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "Just now", "3 hours ago", "Yesterday", "4 days ago", "Mar 12". */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMinutes = Math.round((now.getTime() - then) / 60_000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  const calendarDays = daysSince(iso, now);

  if (calendarDays === 0) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (calendarDays === 1) return 'Yesterday';
  if (calendarDays < 7) return `${calendarDays} days ago`;
  return formatDateShort(iso, now);
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'scheduled' | 'none';

export interface DueLabel {
  text: string;
  tone: DueTone;
}

/** Short due-date chip copy used in tables and task lists. */
export function formatDueLabel(iso: string | null | undefined, now: Date = new Date()): DueLabel {
  if (!iso) return { text: 'Not scheduled', tone: 'none' };

  const days = daysUntil(iso, now);
  if (days < 0) {
    const overdue = Math.abs(days);
    return { text: `${overdue} day${overdue === 1 ? '' : 's'} overdue`, tone: 'overdue' };
  }
  if (days === 0) return { text: 'Due today', tone: 'today' };
  if (days === 1) return { text: 'Due tomorrow', tone: 'soon' };
  if (days <= 7) return { text: `In ${days} days`, tone: 'soon' };
  return { text: `In ${days} days`, tone: 'scheduled' };
}

export function initialsFromName(name: string | null | undefined): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function formatCount(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}
