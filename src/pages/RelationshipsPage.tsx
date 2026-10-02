import { useMemo, useState } from 'react';
import { useDashboard } from '../hooks/useDashboard';
import { Badge } from '../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { ModuleSearch } from '../components/ui/ModuleSearch';
import { PageHeader } from '../components/ui/PageHeader';
import { Avatar } from '../components/ui/Avatar';

const TYPE_LABELS = {
  target_management: 'Target management',
  banker: 'Investment banker',
  intermediary: 'Intermediary',
  carrier: 'Carrier / Reinsurer',
  internal: 'Newport team',
} as const;

export function RelationshipsPage() {
  const { snapshot, opportunitiesById } = useDashboard();
  const [search, setSearch] = useState('');
  const contacts = snapshot?.contacts ?? [];

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (!query) return true;
      return [contact.name, contact.organization, contact.role, contact.email]
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [contacts, search]);

  return (
    <div className="mx-auto w-full max-w-[1760px] space-y-5 px-4 py-5 lg:px-8 lg:py-6">
      <PageHeader
        title="Relationships"
        subtitle="People connected to Newport acquisition activity — targets, bankers, intermediaries and carriers."
      />
      <ModuleSearch value={search} onChange={setSearch} placeholder="Search contacts or organizations..." />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((contact) => (
          <Card key={contact.id}>
            <CardHeader
              title={contact.name}
              subtitle={contact.role}
              icon={<Avatar name={contact.name} size="sm" />}
              actions={<Badge tone="navy">{TYPE_LABELS[contact.relationshipType]}</Badge>}
            />
            <CardBody className="space-y-2 text-sm">
              <p className="font-medium text-navy-900">{contact.organization}</p>
              <p className="text-slate-500">{contact.email}</p>
              <p className="text-slate-500">{contact.phone}</p>
              <div className="pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Linked projects
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {contact.opportunityIds.map((id) => {
                    const opportunity = opportunitiesById.get(id);
                    return (
                      <li
                        key={id}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-navy-800"
                      >
                        {opportunity?.projectName ?? id}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
