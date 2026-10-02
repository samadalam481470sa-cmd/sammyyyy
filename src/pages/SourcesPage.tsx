import { useMemo, useState } from 'react';
import { getSourceType } from '../config/picklists';
import { useDashboard } from '../hooks/useDashboard';
import { formatCurrencyCompact } from '../lib/format';
import { Badge } from '../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { ModuleSearch } from '../components/ui/ModuleSearch';
import { PageHeader } from '../components/ui/PageHeader';

export function SourcesPage() {
  const { opportunities } = useDashboard();
  const [search, setSearch] = useState('');

  const sources = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        type: string;
        deals: number;
        active: number;
        nwp: number;
        projects: string[];
      }
    >();

    for (const opportunity of opportunities) {
      const key = `${opportunity.sourceType}::${opportunity.sourceName}`;
      const existing = map.get(key) ?? {
        name: opportunity.sourceName,
        type: opportunity.sourceType,
        deals: 0,
        active: 0,
        nwp: 0,
        projects: [],
      };
      existing.deals += 1;
      if (opportunity.status === 'active' || opportunity.status === 'pending') existing.active += 1;
      existing.nwp += opportunity.nwp;
      existing.projects.push(opportunity.projectName);
      map.set(key, existing);
    }

    return [...map.values()].sort((a, b) => b.deals - a.deals || b.nwp - a.nwp);
  }, [opportunities]);

  const rows = sources.filter((source) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      source.name.toLowerCase().includes(query) ||
      (getSourceType(source.type)?.label ?? source.type).toLowerCase().includes(query)
    );
  });

  return (
    <div className="mx-auto w-full max-w-[1760px] space-y-5 px-4 py-5 lg:px-8 lg:py-6">
      <PageHeader
        title="Sources / Bankers"
        subtitle="Origination coverage across investment bankers, intermediaries and direct relationships."
      />
      <ModuleSearch value={search} onChange={setSearch} placeholder="Search sources..." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rows.map((source) => (
          <Card key={`${source.type}-${source.name}`}>
            <CardHeader
              title={source.name}
              subtitle={getSourceType(source.type)?.label ?? source.type}
              actions={<Badge tone="accent">{source.deals} deals</Badge>}
            />
            <CardBody className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <Metric label="In flight" value={String(source.active)} />
                <Metric label="Total NWP" value={formatCurrencyCompact(source.nwp)} />
                <Metric label="Projects" value={String(source.projects.length)} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {source.projects.map((project) => (
                  <span
                    key={project}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-navy-800"
                  >
                    {project}
                  </span>
                ))}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="numeric mt-1 text-base font-semibold text-navy-900">{value}</p>
    </div>
  );
}
