import { FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDashboard } from '../hooks/useDashboard';
import { formatRelativeTime } from '../lib/format';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ModuleSearch } from '../components/ui/ModuleSearch';
import { PageHeader } from '../components/ui/PageHeader';

const CATEGORY_LABEL = {
  nda: 'NDA',
  ioi: 'IOI',
  loi: 'LOI',
  diligence: 'Diligence',
  financials: 'Financials',
  other: 'Other',
} as const;

const STATUS_TONE = {
  draft: 'amber',
  final: 'emerald',
  shared: 'accent',
} as const;

export function DocumentsPage() {
  const { snapshot, opportunitiesById } = useDashboard();
  const [search, setSearch] = useState('');
  const documents = snapshot?.documents ?? [];

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...documents]
      .filter((doc) => {
        if (!query) return true;
        const project = opportunitiesById.get(doc.opportunityId)?.projectName ?? '';
        return [doc.name, project, doc.uploadedBy, CATEGORY_LABEL[doc.category]]
          .some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }, [documents, search, opportunitiesById]);

  return (
    <div className="mx-auto w-full max-w-[1760px] space-y-5 px-4 py-5 lg:px-8 lg:py-6">
      <PageHeader
        title="Documents"
        subtitle="NDAs, IOIs, LOIs and diligence materials indexed by confidential project."
      />
      <ModuleSearch value={search} onChange={setSearch} placeholder="Search documents or projects..." />

      <Card>
        <div className="divide-y divide-slate-100">
          {rows.map((doc) => {
            const project = opportunitiesById.get(doc.opportunityId);
            return (
              <div key={doc.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-navy-900">{doc.name}</p>
                    <Badge tone="slate">{CATEGORY_LABEL[doc.category]}</Badge>
                    <Badge tone={STATUS_TONE[doc.status]}>{doc.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {project?.projectName ?? 'Unknown project'} · {doc.uploadedBy} ·{' '}
                    {formatRelativeTime(doc.uploadedAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
