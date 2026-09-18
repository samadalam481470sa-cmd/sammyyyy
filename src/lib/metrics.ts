import { platformData } from "./data";
import type {
  Mga,
  MgaFinancial,
  MgaMetrics,
  SynergyOverlap,
} from "./schema";

export function getFinancialsForMga(mgaId: string): MgaFinancial[] {
  return platformData.financials
    .filter((f) => f.mgaId === mgaId)
    .sort((a, b) => a.year - b.year);
}

export function computeYoyGrowth(
  financials: MgaFinancial[],
): { latest: number | null; prior: number | null; growth: number | null } {
  if (financials.length === 0) {
    return { latest: null, prior: null, growth: null };
  }
  const sorted = [...financials].sort((a, b) => a.year - b.year);
  const latest = sorted[sorted.length - 1];
  const prior = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  if (!prior || prior.ebitda === 0) {
    return { latest: latest.ebitda, prior: prior?.ebitda ?? null, growth: null };
  }
  return {
    latest: latest.ebitda,
    prior: prior.ebitda,
    growth: (latest.ebitda - prior.ebitda) / prior.ebitda,
  };
}

export function getMgaMetrics(mga: Mga): MgaMetrics {
  const financials = getFinancialsForMga(mga.id);
  const { latest, prior, growth } = computeYoyGrowth(financials);
  const programs = platformData.programs.filter((p) => p.mgaId === mga.id);
  const retailCount = platformData.retailAgencies.filter(
    (r) => r.associatedMgaId === mga.id,
  ).length;

  return {
    mga,
    latestEbitda: latest,
    priorEbitda: prior,
    yoyEbitdaGrowth: growth,
    programs,
    retailCount,
    linesOfBusiness: [...new Set(programs.map((p) => p.lineOfBusiness))],
    coverageTypes: [...new Set(programs.map((p) => p.coverageType))],
    regions: [...new Set(programs.map((p) => p.geographicRegion))],
  };
}

export function getAllMetrics(status?: Mga["status"]): MgaMetrics[] {
  const mgas = status
    ? platformData.mgas.filter((m) => m.status === status)
    : platformData.mgas;
  return mgas.map(getMgaMetrics);
}

export function getMgaById(id: string): Mga | undefined {
  return platformData.mgas.find((m) => m.id === id);
}

type ProgramKey = "lineOfBusiness" | "coverageType" | "geographicRegion";

const SYNERGY_BUCKETS: {
  dimension: SynergyOverlap["dimension"];
  key: ProgramKey;
}[] = [
  { dimension: "lineOfBusiness", key: "lineOfBusiness" },
  { dimension: "coverageType", key: "coverageType" },
  { dimension: "geographicRegion", key: "geographicRegion" },
];

/** Find overlapping LoB / coverage / region across MGAs in a status set */
export function findSynergies(
  status: Mga["status"] = "acquired",
): SynergyOverlap[] {
  const mgas = platformData.mgas.filter((m) => m.status === status);
  const mgaById = new Map(mgas.map((m) => [m.id, m]));
  const programs = platformData.programs.filter((p) => mgaById.has(p.mgaId));
  return collectOverlaps(programs, mgaById);
}

/**
 * Pipeline MGAs that share LoB / coverage / region with at least one
 * on-platform MGA — acquisition synergy candidates for corp dev.
 */
export function findPipelineSynergyCandidates(): SynergyOverlap[] {
  const acquired = platformData.mgas.filter((m) => m.status === "acquired");
  const pipeline = platformData.mgas.filter((m) => m.status === "pipeline");
  const acquiredIds = new Set(acquired.map((m) => m.id));
  const pipelineIds = new Set(pipeline.map((m) => m.id));
  const nameById = new Map(
    [...acquired, ...pipeline].map((m) => [m.id, m.name]),
  );

  const acquiredPrograms = platformData.programs.filter((p) =>
    acquiredIds.has(p.mgaId),
  );
  const pipelinePrograms = platformData.programs.filter((p) =>
    pipelineIds.has(p.mgaId),
  );

  const overlaps: SynergyOverlap[] = [];

  for (const { dimension, key } of SYNERGY_BUCKETS) {
    const acquiredValues = new Map<string, Set<string>>();
    for (const p of acquiredPrograms) {
      const value = p[key];
      if (!acquiredValues.has(value)) acquiredValues.set(value, new Set());
      acquiredValues.get(value)!.add(p.mgaId);
    }

    const pipelineByValue = new Map<string, Set<string>>();
    for (const p of pipelinePrograms) {
      const value = p[key];
      if (!acquiredValues.has(value)) continue;
      if (!pipelineByValue.has(value)) pipelineByValue.set(value, new Set());
      pipelineByValue.get(value)!.add(p.mgaId);
    }

    for (const [value, pipeIds] of pipelineByValue) {
      const platformIds = [...acquiredValues.get(value)!];
      const mgaIds = [...platformIds, ...pipeIds];
      overlaps.push({
        dimension,
        value,
        mgaIds,
        mgaNames: mgaIds.map((id) => nameById.get(id)!),
      });
    }
  }

  return overlaps.sort((a, b) => b.mgaIds.length - a.mgaIds.length);
}

function collectOverlaps(
  programs: typeof platformData.programs,
  mgaById: Map<string, Mga>,
): SynergyOverlap[] {
  const overlaps: SynergyOverlap[] = [];

  for (const { dimension, key } of SYNERGY_BUCKETS) {
    const map = new Map<string, Set<string>>();
    for (const p of programs) {
      const value = p[key];
      if (!map.has(value)) map.set(value, new Set());
      map.get(value)!.add(p.mgaId);
    }
    for (const [value, ids] of map) {
      if (ids.size < 2) continue;
      const mgaIds = [...ids];
      overlaps.push({
        dimension,
        value,
        mgaIds,
        mgaNames: mgaIds.map((id) => mgaById.get(id)!.name),
      });
    }
  }

  return overlaps.sort((a, b) => b.mgaIds.length - a.mgaIds.length);
}

export function formatUsdMm(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `$${value.toFixed(1)}M`;
}

export function formatPct(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export const REGIONS = [
  "Northeast",
  "Southeast",
  "Midwest",
  "Southwest",
  "West",
  "Mountain",
] as const;
