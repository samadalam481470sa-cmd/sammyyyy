import { getStatusConfig } from '../../data/constants';
import type { OpportunityStatus } from '../../types/opportunity';

export default function StatusBadge({ status }: { status: OpportunityStatus }) {
  const config = getStatusConfig(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${config.badgeClassName}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClassName}`} />
      {config.label}
    </span>
  );
}
