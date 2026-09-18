import clsx from "clsx";
import type { MgaStatus, PipelineStage } from "@/types/mga";

const STAGE_LABEL: Record<PipelineStage, string> = {
  IDENTIFIED: "Identified",
  INITIAL_OUTREACH: "Initial Outreach",
  LOI: "LOI Submitted",
  DILIGENCE: "In Diligence",
  CLOSING: "Closing",
};

export function StatusBadge({
  status,
  pipelineStage,
}: {
  status: MgaStatus;
  pipelineStage?: PipelineStage | null;
}) {
  if (status === "ACQUIRED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-500/10 px-2.5 py-1 text-xs font-semibold text-accent-600">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
        On-Platform
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-700">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
      {pipelineStage ? STAGE_LABEL[pipelineStage] : "Pipeline"}
    </span>
  );
}

export function PillTag({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "brand" | "amber";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        tone === "slate" && "bg-slate-100 text-slate-600",
        tone === "brand" && "bg-brand-50 text-brand-700",
        tone === "amber" && "bg-amber-100 text-amber-700",
      )}
    >
      {children}
    </span>
  );
}
