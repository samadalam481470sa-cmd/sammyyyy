import clsx from 'clsx';
import { initialsFromName } from '../../lib/format';

interface AvatarProps {
  name: string | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const SIZE_STYLES = {
  xs: 'size-6 text-[10px]',
  sm: 'size-7 text-[11px]',
  md: 'size-9 text-xs',
} as const;

export function Avatar({ name, size = 'sm', className }: AvatarProps) {
  const unassigned = !name;

  return (
    <span
      title={name ?? 'Unassigned'}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight',
        SIZE_STYLES[size],
        unassigned
          ? 'border border-dashed border-slate-300 bg-white text-slate-400'
          : 'bg-navy-100 text-navy-800 ring-1 ring-inset ring-navy-200/70',
        className,
      )}
    >
      {unassigned ? '?' : initialsFromName(name)}
    </span>
  );
}

interface PersonProps {
  name: string | null;
  caption?: string;
  className?: string;
}

/** Avatar plus name, with an explicit unassigned state for ownership gaps. */
export function Person({ name, caption, className }: PersonProps) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <Avatar name={name} size="xs" />
      <span className="min-w-0">
        <span
          className={clsx(
            'block truncate text-sm',
            name ? 'text-navy-900' : 'font-medium text-amber-700',
          )}
        >
          {name ?? 'Unassigned'}
        </span>
        {caption ? <span className="block truncate text-xs text-slate-500">{caption}</span> : null}
      </span>
    </span>
  );
}
