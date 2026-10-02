import { useMemo, useState } from 'react';
import { useDashboard } from '../hooks/useDashboard';
import { Badge } from '../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { ModuleSearch } from '../components/ui/ModuleSearch';
import { PageHeader } from '../components/ui/PageHeader';

const TYPE_TONE = {
  carrier: 'accent',
  reinsurer: 'navy',
  capacity: 'teal',
} as const;

export function CarriersPage() {
  const { snapshot } = useDashboard();
  const [search, setSearch] = useState('');
  const carriers = snapshot?.carriers ?? [];

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return carriers.filter((carrier) => {
      if (!query) return true;
      return [carrier.name, carrier.specialty, carrier.relationshipOwner, carrier.type]
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [carriers, search]);

  return (
    <div className="mx-auto w-full max-w-[1760px] space-y-5 px-4 py-5 lg:px-8 lg:py-6">
      <PageHeader
        title="Carriers / Reinsurers"
        subtitle="Capacity partners and paper relationships supporting Newport acquisitions."
      />
      <ModuleSearch value={search} onChange={setSearch} placeholder="Search carriers or specialties..." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rows.map((carrier) => (
          <Card key={carrier.id}>
            <CardHeader
              title={carrier.name}
              subtitle={carrier.specialty}
              actions={
                <Badge tone={TYPE_TONE[carrier.type]}>
                  {carrier.type.charAt(0).toUpperCase() + carrier.type.slice(1)}
                </Badge>
              }
            />
            <CardBody className="space-y-2 text-sm">
              <p className="text-slate-600">{carrier.notes}</p>
              <div className="flex flex-wrap gap-4 pt-1 text-xs text-slate-500">
                <span>
                  Relationship owner:{' '}
                  <span className="font-medium text-navy-800">{carrier.relationshipOwner}</span>
                </span>
                <span>
                  Linked deals:{' '}
                  <span className="font-medium text-navy-800">{carrier.activeDeals}</span>
                </span>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
