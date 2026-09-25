import { getStageConfig } from '../../data/constants';
import type { OpportunityStage } from '../../types/opportunity';

export default function StageBadge({ stage }: { stage: OpportunityStage }) {
  const config = getStageConfig(stage);
  return (
    <span className="inline-flex items-center rounded-md bg-navy-50 px-2 py-1 text-xs font-medium text-navy-700 ring-1 ring-inset ring-navy-600/10">
      {config.shortLabel}
    </span>
  );
}
