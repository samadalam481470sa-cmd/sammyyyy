import clsx from 'clsx';
import { ArrowUpRight, TriangleAlert } from 'lucide-react';
import {
  getOpportunityType,
  getPriority,
  getSourceType,
} from '../../config/picklists';
import {
  formatCurrencyCompact,
  formatDateLong,
  formatDueLabel,
  formatRelativeTime,
} from '../../lib/format';
import type { OpportunityView } from '../../types';
import { Avatar } from '../ui/Avatar';
import { StageBadge, StatusBadge } from '../ui/Badge';
import { Drawer } from '../ui/Drawer';

interface OpportunityDrawerProps {
  opportunity: OpportunityView | null;
  onClose: () => void;
}

export function OpportunityDrawer({ opportunity, onClose }: OpportunityDrawerProps) {
  if (!opportunity) return null;

  const due = formatDueLabel(opportunity.nextActionDate);
  const priority = getPriority(opportunity.priority);

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Confidential opportunity"
      title={opportunity.projectName}
      subtitle={opportunity.entityName}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-navy-900">
            Full Opportunity Profile — Coming in next sprint
          </p>
          <ArrowUpRight className="size-4 text-slate-400" />
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={opportunity.status} />
        <StageBadge stage={opportunity.stage} />
        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50/80 px-2 py-0.5 text-xs font-medium text-slate-700">
          {getOpportunityType(opportunity.type)?.label ?? opportunity.type}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50/80 px-2 py-0.5 text-xs font-medium text-slate-700">
          Priority {priority?.label}
          <span className="text-slate-400">· {priority?.description}</span>
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3">
        <FinancialTile label="NWP" title="Net Written Premium" value={opportunity.nwp} />
        <FinancialTile label="Net Revenue" value={opportunity.netRevenue} />
        <FinancialTile label="PF EBITDA" title="Pro Forma EBITDA" value={opportunity.pfEbitda} />
      </dl>

      <Section title="Ownership & Source">
        <div className="flex items-center gap-2.5 py-1">
          <Avatar name={opportunity.dealLead} size="sm" />
          <div className="min-w-0">
            <p
              className={clsx(
                'text-sm',
                opportunity.dealLead ? 'font-medium text-navy-900' : 'font-medium text-amber-700',
              )}
            >
              {opportunity.dealLead ?? 'No deal lead assigned'}
            </p>
            <p className="text-xs text-slate-500">Deal lead</p>
          </div>
        </div>
        <DetailRow
          label="Source"
          value={`${opportunity.sourceName} (${getSourceType(opportunity.sourceType)?.label ?? opportunity.sourceType})`}
        />
        <DetailRow label="Specialty" value={opportunity.specialty} />
        <DetailRow label="Geography" value={opportunity.geography} />
      </Section>

      <Section title="Next Action">
        {opportunity.nextAction ? (
          <>
            <p className="text-sm text-navy-900">{opportunity.nextAction}</p>
            <p className="mt-1 text-xs text-slate-500">
              {formatDateLong(opportunity.nextActionDate)}
              <span className="mx-1.5 text-slate-300">|</span>
              <span className={due.tone === 'overdue' ? 'font-medium text-rose-600' : ''}>
                {due.text}
              </span>
            </p>
          </>
        ) : (
          <p className="text-sm font-medium text-amber-700">No next action assigned</p>
        )}
        <DetailRow
          label="Last activity"
          value={`${formatDateLong(opportunity.lastActivityDate)} · ${formatRelativeTime(opportunity.lastActivityDate)}`}
        />
        {opportunity.criticalDate ? (
          <DetailRow
            label={opportunity.criticalDateLabel ?? 'Key date'}
            value={formatDateLong(opportunity.criticalDate)}
          />
        ) : null}
      </Section>

      {opportunity.attentionFlags.length > 0 ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-900">
            <TriangleAlert className="size-4" />
            Needs attention
          </p>
          <ul className="mt-2 space-y-1.5">
            {opportunity.attentionFlags.map((flag) => (
              <li key={flag.reason} className="text-xs text-amber-900/90">
                <span className="font-medium">{flag.label}</span>
                <span className="mx-1.5 text-amber-600/50">|</span>
                {flag.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Drawer>
  );
}

function FinancialTile({
  label,
  value,
  title,
}: {
  label: string;
  value: number;
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5" title={title}>
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </dt>
      <dd className="numeric mt-1 text-lg font-semibold tracking-tight text-navy-900">
        {formatCurrencyCompact(value)}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {title}
      </h3>
      <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2.5">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-0.5">
      <span className="shrink-0 text-xs text-slate-500">{label}</span>
      <span className="text-right text-[13px] text-navy-900">{value}</span>
    </div>
  );
}
