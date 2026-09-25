import clsx from 'clsx';

/** Placeholder Newport mark — swap for the supplied brand asset when available. */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-accent-400 to-accent-700 shadow-[0_2px_8px_rgba(8,23,41,0.45)]',
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="size-5 text-white" fill="none">
        <path
          d="M8 24V8h4.4l7.2 10.1V8H24v16h-4.4L12.4 13.9V24H8Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
