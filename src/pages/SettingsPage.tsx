import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  PIPELINE_STAGES,
  PRIORITY_LEVELS,
  SOURCE_TYPES,
} from '../config/picklists';
import { APP_CONFIG, CURRENT_USER } from '../config/app';
import { useDashboard } from '../hooks/useDashboard';
import { Avatar } from '../components/ui/Avatar';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';

export function SettingsPage() {
  const { snapshot } = useDashboard();
  const team = snapshot?.team ?? [];

  return (
    <div className="mx-auto w-full max-w-[1760px] space-y-5 px-4 py-5 lg:px-8 lg:py-6">
      <PageHeader
        title="Settings"
        subtitle="Workspace identity, team roster and centrally controlled pick lists."
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Workspace" subtitle={APP_CONFIG.productName} />
          <CardBody className="space-y-3 text-sm">
            <Row label="Company" value={APP_CONFIG.companyName} />
            <Row label="Signed in as" value={`${CURRENT_USER.firstName} ${CURRENT_USER.lastName}`} />
            <Row label="Title" value={CURRENT_USER.title} />
            <Row label="Confidentiality" value={APP_CONFIG.confidentialityNotice} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Deal team" subtitle={`${team.length} members`} />
          <CardBody className="space-y-3">
            {team.map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <Avatar name={member.name} size="sm" />
                <div>
                  <p className="text-sm font-medium text-navy-900">{member.name}</p>
                  <p className="text-xs text-slate-500">{member.title}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <PicklistCard title="Opportunity statuses" items={OPPORTUNITY_STATUSES.map((item) => item.label)} />
        <PicklistCard title="Pipeline stages" items={PIPELINE_STAGES.map((item) => item.label)} />
        <PicklistCard title="Opportunity types" items={OPPORTUNITY_TYPES.map((item) => item.label)} />
        <PicklistCard title="Source types" items={SOURCE_TYPES.map((item) => item.label)} />
        <PicklistCard
          title="Priorities"
          items={PRIORITY_LEVELS.map((item) => `${item.label} — ${item.description}`)}
        />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-navy-900">{value}</span>
    </div>
  );
}

function PicklistCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader title={title} subtitle="Controlled from config/picklists.ts" />
      <CardBody>
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-navy-800"
            >
              {item}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
