import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** Right-hand detail panel used for record previews across the CRM. */
export function Drawer({ open, onClose, title, subtitle, eyebrow, footer, children }: DrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-navy-950/35 backdrop-blur-[2px] animate-fade-in"
      />
      <aside className="relative flex h-full w-full max-w-[460px] flex-col bg-white shadow-panel animate-slide-in">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-navy-900 px-6 py-5 text-white">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-navy-200">
                {eyebrow}
              </p>
            ) : null}
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight">{title}</h2>
            {subtitle ? <p className="mt-1 truncate text-sm text-navy-200">{subtitle}</p> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-lg p-1.5 text-navy-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-slim px-6 py-5">{children}</div>

        {footer ? <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">{footer}</div> : null}
      </aside>
    </div>
  );
}
