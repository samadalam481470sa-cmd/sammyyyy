import type { EbitdaRecord, InsuranceProgram, Mga, RetailAgency } from "@prisma/client";

export const MgaStatus = {
  PIPELINE: "PIPELINE",
  ACQUIRED: "ACQUIRED",
} as const;
export type MgaStatus = (typeof MgaStatus)[keyof typeof MgaStatus];

export const PipelineStage = {
  IDENTIFIED: "IDENTIFIED",
  INITIAL_OUTREACH: "INITIAL_OUTREACH",
  LOI: "LOI",
  DILIGENCE: "DILIGENCE",
  CLOSING: "CLOSING",
} as const;
export type PipelineStage = (typeof PipelineStage)[keyof typeof PipelineStage];

export type MgaWithRelations = Omit<Mga, "status" | "pipelineStage"> & {
  status: MgaStatus;
  pipelineStage: PipelineStage | null;
  financials: EbitdaRecord[];
  insurancePrograms: InsuranceProgram[];
  retailAgencies: RetailAgency[];
};

export type MgaListItem = MgaWithRelations & {
  latestEbitdaUsd: number | null;
  ebitdaYoyGrowthPct: number | null;
  ebitdaCagrPct: number | null;
  regions: string[];
  linesOfBusiness: string[];
  coverageTypes: string[];
};
