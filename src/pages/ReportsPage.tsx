import { useMemo } from 'react';
import { DashboardCharts } from '../components/dashboard/DashboardCharts';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { useDashboard } from '../hooks/useDashboard';
import { formatCurrencyCompact } from '../lib/format';
import { buildStageSummary, buildStatusSummary, summarizeOpportunities } from '../lib/metrics';

export function ReportsPage() {
  const { opportunities } = useDashboard();
  const metrics = useMemo(() => summarizeOpportunities(opportunities), [opportunities]);
  const statusData = useMemo(() => buildStatusSummary(opportunities), [opportunities]);
  const active = useMemo(
    () => opportunities.filter((item) => item.status === 'active'),
    [opportunities],
  );
  const stageData = useMemo(() => buildStageSummary(active), [active]);

  const byLead = useMemo(() => {
    const map = new Map<string, { count: number; nwp: number }>();
    for (const opportunity of opportunities.filter((item) => item.status === 'active' || item.status === 'pending')) {
      const lead = opportunity.dealLead ?? 'Unassigned';
      const current = map.get(lead) ?? { count: 0, nwp: 0 };
      current.count += 1;
      current.nwp += opportunity.nwp;
      map.set(lead, current);
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.nwp - a.nwp);
  }, [opportunities]);

  return (
    <div className="mx-auto w-full max-w-[1760px] space-y-5 px-4 py-5 lg:px-8 lg:py-6">
      <PageHeader
        title="Reports"
        subtitle="Executive pipeline and portfolio summaries for investment committee review."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active deals" value={String(metrics.activeCount)} />
        <Stat label="Pending deals" value={String(metrics.pendingCount)} />
        <Stat label="Active NWP" value={formatCurrencyCompact(metrics.activeNwp)} />
        <Stat label="Needs attention" value={String(metrics.attentionCount)} />
      </div>

      <DashboardCharts
        statusData={statusData}
        stageData={stageData}
        selectedStatus={null}
        selectedStage={null}
        stageScopeLabel="Active"
        onSelectStatus={() => undefined}
        onSelectStage={() => undefined}
      />

      <Card>
        <CardHeader title="Coverage by deal lead" subtitle="Active and pending opportunities" />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <th className="px-5 py-2.5">Deal lead</th>
                <th className="px-3 py-2.5 text-right">Deals</th>
                <th className="px-5 py-2.5 text-right">NWP</th>
              </tr>
            </thead>
            <tbody>
              {byLead.map((row) => (
                <tr key={row.name} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-navy-900">{row.name}</td>
                  <td className="numeric px-3 py-3 text-right text-slate-600">{row.count}</td>
                  <td className="numeric px-5 py-3 text-right font-medium text-navy-900">
                    {formatCurrencyCompact(row.nwp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="numeric mt-2 text-2xl font-semibold text-navy-900">{value}</p>
    </div>
  );
}
