import type { EbitdaRecord, InsuranceProgram, Mga, RetailAgency } from "@prisma/client";
import type { MgaListItem, MgaStatus, PipelineStage } from "@/types/mga";

/** Shape returned by a Prisma query that includes all MGA relations. */
export type RawMgaWithRelations = Mga & {
  financials: EbitdaRecord[];
  insurancePrograms: InsuranceProgram[];
  retailAgencies: RetailAgency[];
};

/** Sorts EBITDA records chronologically without mutating the input array. */
export function sortByYear(records: EbitdaRecord[]): EbitdaRecord[] {
  return [...records].sort((a, b) => a.year - b.year);
}

/** Most recent EBITDA figure on file, or null if there is no history yet. */
export function getLatestEbitda(records: EbitdaRecord[]): number | null {
  const sorted = sortByYear(records);
  return sorted.length > 0 ? sorted[sorted.length - 1].ebitdaUsd : null;
}

/** Year-over-year EBITDA growth between the two most recent data points. */
export function getYoyGrowthPct(records: EbitdaRecord[]): number | null {
  const sorted = sortByYear(records);
  if (sorted.length < 2) return null;
  const prior = sorted[sorted.length - 2].ebitdaUsd;
  const latest = sorted[sorted.length - 1].ebitdaUsd;
  if (prior === 0) return null;
  return ((latest - prior) / Math.abs(prior)) * 100;
}

/** Compound annual growth rate across the full EBITDA history on file. */
export function getCagrPct(records: EbitdaRecord[]): number | null {
  const sorted = sortByYear(records);
  if (sorted.length < 2) return null;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const years = last.year - first.year;
  if (years <= 0 || first.ebitdaUsd <= 0) return null;
  const cagr = (Math.pow(last.ebitdaUsd / first.ebitdaUsd, 1 / years) - 1) * 100;
  return cagr;
}

export function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function programField(
  programs: InsuranceProgram[],
  field: "geographicRegion" | "lineOfBusiness" | "coverageType",
): string[] {
  return uniqueSorted(programs.map((p) => p[field]));
}

/** Enriches a raw MGA + relations record with derived dashboard metrics. */
export function withDerivedMetrics(mga: RawMgaWithRelations): MgaListItem {
  return {
    ...mga,
    status: mga.status as MgaStatus,
    pipelineStage: mga.pipelineStage as PipelineStage | null,
    latestEbitdaUsd: getLatestEbitda(mga.financials),
    ebitdaYoyGrowthPct: getYoyGrowthPct(mga.financials),
    ebitdaCagrPct: getCagrPct(mga.financials),
    regions: programField(mga.insurancePrograms, "geographicRegion"),
    linesOfBusiness: programField(mga.insurancePrograms, "lineOfBusiness"),
    coverageTypes: programField(mga.insurancePrograms, "coverageType"),
  };
}

export function formatUsd(value: number | null | undefined, compact = true): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}
