import { Info, X } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

export function ToastViewport() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-panel animate-fade-in"
        >
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
            <Info className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-navy-900">{toast.title}</p>
            {toast.description ? (
              <p className="mt-0.5 text-xs text-slate-500">{toast.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
