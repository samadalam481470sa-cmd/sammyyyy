import { getPriorityConfig } from '../../data/constants';
import type { PriorityLevel } from '../../types/opportunity';

export default function PriorityBadge({ priority }: { priority: PriorityLevel }) {
  const config = getPriorityConfig(priority);
  return (
    <span
      title={config.description}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${config.badgeClassName}`}
    >
      {config.label}
    </span>
  );
}
