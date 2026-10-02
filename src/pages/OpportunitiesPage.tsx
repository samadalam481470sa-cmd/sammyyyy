import { Plus, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { OPPORTUNITY_STATUSES } from '../config/picklists';
import { useDashboard } from '../hooks/useDashboard';
import { formatCurrencyCompact, formatDateShort } from '../lib/format';
import type { OpportunityView } from '../types';
import { OpportunityDrawer } from '../components/dashboard/OpportunityDrawer';
import { Avatar } from '../components/ui/Avatar';
import { StageBadge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ModuleSearch } from '../components/ui/ModuleSearch';
import { PageHeader } from '../components/ui/PageHeader';

export function OpportunitiesPage() {
  const { opportunities, openModal } = useDashboard();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [selected, setSelected] = useState<OpportunityView | null>(null);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return opportunities.filter((item) => {
      if (status !== 'all' && item.status !== status) return false;
      if (!query) return true;
      return [item.projectName, item.entityName, item.dealLead, item.specialty]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [opportunities, search, status]);

  return (
    <div className="mx-auto w-full max-w-[1760px] space-y-5 px-4 py-5 lg:px-8 lg:py-6">
      <PageHeader
        title="Opportunities"
        subtitle="Full acquisition register — project code names stay primary for confidentiality."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => openModal('opportunity')}>
            New Opportunity
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ModuleSearch value={search} onChange={setSearch} placeholder="Search projects, entities, leads..." />
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-card">
          <FilterChip active={status === 'all'} onClick={() => setStatus('all')} label={`All (${opportunities.length})`} />
          {OPPORTUNITY_STATUSES.map((option) => {
            const count = opportunities.filter((item) => item.status === option.id).length;
            return (
              <FilterChip
                key={option.id}
                active={status === option.id}
                onClick={() => setStatus(option.id)}
                label={`${option.label} (${count})`}
              />
            );
          })}
        </div>
      </div>

      <Card>
        <div className="scrollbar-slim overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <th className="px-5 py-2.5">Project</th>
                <th className="px-3 py-2.5">Entity</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Stage</th>
                <th className="px-3 py-2.5">Deal Lead</th>
                <th className="px-3 py-2.5 text-right">NWP</th>
                <th className="px-3 py-2.5 text-right">PF EBITDA</th>
                <th className="px-3 py-2.5">Next Action</th>
                <th className="px-5 py-2.5">Due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((deal) => (
                <tr
                  key={deal.id}
                  className="cursor-pointer border-b border-slate-100 hover:bg-navy-50/50"
                  onClick={() => setSelected(deal)}
                >
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1.5 font-semibold text-navy-900">
                      {deal.needsAttention ? <TriangleAlert className="size-3.5 text-amber-500" /> : null}
                      {deal.projectName}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{deal.entityName}</td>
                  <td className="px-3 py-3"><StatusBadge status={deal.status} /></td>
                  <td className="px-3 py-3"><StageBadge stage={deal.stage} /></td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-2">
                      <Avatar name={deal.dealLead} size="xs" />
                      <span className="text-[13px]">{deal.dealLead ?? 'Unassigned'}</span>
                    </span>
                  </td>
                  <td className="numeric px-3 py-3 text-right font-medium">{formatCurrencyCompact(deal.nwp)}</td>
                  <td className="numeric px-3 py-3 text-right text-slate-600">{formatCurrencyCompact(deal.pfEbitda)}</td>
                  <td className="px-3 py-3 text-slate-700">{deal.nextAction ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-600">{formatDateShort(deal.nextActionDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          Showing {rows.length} of {opportunities.length} opportunities
        </p>
      </Card>

      <OpportunityDrawer opportunity={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  );
}
