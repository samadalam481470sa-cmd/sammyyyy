import { Badge } from "./ui";
import {
  DEAL_STAGE_LABEL,
  MGA_STATUS,
  MGA_STATUS_LABEL,
  type DealStage,
  type MgaStatus,
} from "@/lib/taxonomy";

export function StatusBadge({ status }: { status: string }) {
  const label =
    MGA_STATUS_LABEL[status as MgaStatus] ?? status.replaceAll("_", " ");
  return (
    <Badge tone={status === MGA_STATUS.ON_PLATFORM ? "navy" : "slate"}>
      {label}
    </Badge>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  const label = DEAL_STAGE_LABEL[stage as DealStage] ?? stage;
  const tone =
    stage === "UNDER_LOI"
      ? "gold"
      : stage === "CLOSED"
        ? "navy"
        : stage === "PASSED"
          ? "rose"
          : "outline";
  return <Badge tone={tone}>{label}</Badge>;
}

/**
 * Marks a target that clears all three thesis criteria, or names the one it
 * misses. Naming the miss is the point — a bare "no" would hide whether a
 * target failed on growth, tenure or scale.
 */
export function BestInClassBadge({
  result,
}: {
  result: {
    isBestInClass: boolean;
    meetsExperience: boolean;
    meetsGrowth: boolean;
    meetsScale: boolean;
  };
}) {
  if (result.isBestInClass) {
    return <Badge tone="gold">Best in class</Badge>;
  }

  const misses = [
    result.meetsGrowth ? null : "growth",
    result.meetsExperience ? null : "tenure",
    result.meetsScale ? null : "scale",
  ].filter((value): value is string => Boolean(value));

  return (
    <Badge tone="outline" className="font-medium">
      Misses {misses.join(" + ")}
    </Badge>
  );
}
