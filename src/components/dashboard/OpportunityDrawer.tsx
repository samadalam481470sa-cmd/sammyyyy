import { useEffect } from 'react';
import { X, ArrowRight, Sparkles } from 'lucide-react';
import type { Opportunity } from '../../types/opportunity';
import StatusBadge from '../common/StatusBadge';
import StageBadge from '../common/StageBadge';
import { formatUsdFull } from '../../lib/format';
import { formatNextActionDate } from '../../lib/dateUtils';

interface OpportunityDrawerProps {
  opportunity: Opportunity | null;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-navy-900">{value}</p>
    </div>
  );
}

export default function OpportunityDrawer({ opportunity, onClose }: OpportunityDrawerProps) {
  useEffect(() => {
    if (!opportunity) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [opportunity, onClose]);

  const open = opportunity !== null;

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-navy-950/40 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={opportunity ? `${opportunity.projectName} details` : 'Opportunity details'}
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {opportunity && (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Acquisition Opportunity</p>
                <h2 className="mt-1 text-xl font-bold text-navy-900">{opportunity.projectName}</h2>
                <p className="mt-0.5 text-sm text-slate-500">{opportunity.entityName}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={opportunity.status} />
                <StageBadge stage={opportunity.stage} />
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {opportunity.type}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-y-5">
                <Field label="Deal Lead" value={opportunity.dealLead || 'Unassigned'} />
                <Field label="Geography" value={opportunity.geography} />
                <Field label="Specialty" value={opportunity.specialty} />
                <Field
                  label="Source"
                  value={`${opportunity.sourceType}${opportunity.sourceName ? ` · ${opportunity.sourceName}` : ''}`}
                />
              </div>

              <div className="mt-6 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Financial Snapshot</p>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[11px] text-slate-400">NWP</p>
                    <p className="mt-0.5 text-sm font-bold text-navy-900">{formatUsdFull(opportunity.nwp)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Net Revenue</p>
                    <p className="mt-0.5 text-sm font-bold text-navy-900">{formatUsdFull(opportunity.netRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">PF EBITDA</p>
                    <p className="mt-0.5 text-sm font-bold text-navy-900">{formatUsdFull(opportunity.pfEbitda)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next Action</p>
                <div className="mt-2 flex items-start gap-2 rounded-xl border border-slate-100 p-3">
                  <ArrowRight size={15} className="mt-0.5 shrink-0 text-accent-600" />
                  <div>
                    <p className="text-sm font-medium text-navy-900">{opportunity.nextAction ?? 'No next action assigned'}</p>
                    {opportunity.nextActionDate && (
                      <p className="mt-0.5 text-xs text-slate-500">{formatNextActionDate(opportunity.nextActionDate)}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 p-5">
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-500">
                <Sparkles size={15} className="shrink-0 text-accent-500" />
                Full Opportunity Profile — Coming in next sprint
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
