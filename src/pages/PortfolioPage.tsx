import { useMemo, useState } from 'react';
import { useDashboard } from '../hooks/useDashboard';
import { formatCurrencyCompact } from '../lib/format';
import type { OpportunityView } from '../types';
import { OpportunityDrawer } from '../components/dashboard/OpportunityDrawer';
import { Avatar } from '../components/ui/Avatar';
import { StatusBadge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ModuleSearch } from '../components/ui/ModuleSearch';
import { PageHeader } from '../components/ui/PageHeader';

export function PortfolioPage() {
  const { opportunities } = useDashboard();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<OpportunityView | null>(null);

  const portfolio = useMemo(
    () =>
      opportunities.filter(
        (item) => item.status === 'closed' || item.status === 'completed',
      ),
    [opportunities],
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return portfolio.filter((item) => {
      if (!query) return true;
      return [item.projectName, item.entityName, item.specialty, item.dealLead]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [portfolio, search]);

  const totals = useMemo(
    () => ({
      nwp: portfolio.reduce((sum, item) => sum + item.nwp, 0),
      ebitda: portfolio.reduce((sum, item) => sum + item.pfEbitda, 0),
    }),
    [portfolio],
  );

  return (
    <div className="mx-auto w-full max-w-[1760px] space-y-5 px-4 py-5 lg:px-8 lg:py-6">
      <PageHeader
        title="Portfolio Companies"
        subtitle="Closed and completed acquisitions — demo figures only."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Summary label="Portfolio companies" value={String(portfolio.length)} />
        <Summary label="Portfolio NWP" value={formatCurrencyCompact(totals.nwp)} />
        <Summary label="Portfolio PF EBITDA" value={formatCurrencyCompact(totals.ebitda)} />
      </div>

      <ModuleSearch value={search} onChange={setSearch} placeholder="Search portfolio companies..." />

      <Card>
        <div className="scrollbar-slim overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <th className="px-5 py-2.5">Project</th>
                <th className="px-3 py-2.5">Entity</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Specialty</th>
                <th className="px-3 py-2.5">Deal Lead</th>
                <th className="px-3 py-2.5 text-right">NWP</th>
                <th className="px-5 py-2.5 text-right">PF EBITDA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((deal) => (
                <tr
                  key={deal.id}
                  className="cursor-pointer border-b border-slate-100 hover:bg-navy-50/50"
                  onClick={() => setSelected(deal)}
                >
                  <td className="px-5 py-3 font-semibold text-navy-900">{deal.projectName}</td>
                  <td className="px-3 py-3 text-slate-600">{deal.entityName}</td>
                  <td className="px-3 py-3"><StatusBadge status={deal.status} /></td>
                  <td className="px-3 py-3 text-slate-600">{deal.specialty}</td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-2">
                      <Avatar name={deal.dealLead} size="xs" />
                      {deal.dealLead ?? '—'}
                    </span>
                  </td>
                  <td className="numeric px-3 py-3 text-right font-medium">{formatCurrencyCompact(deal.nwp)}</td>
                  <td className="numeric px-5 py-3 text-right text-slate-600">
                    {formatCurrencyCompact(deal.pfEbitda)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <OpportunityDrawer opportunity={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="numeric mt-2 text-2xl font-semibold text-navy-900">{value}</p>
    </div>
  );
}
