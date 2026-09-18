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

/** Find overlapping LoB / coverage / region across acquired MGAs */
export function findSynergies(
  status: Mga["status"] = "acquired",
): SynergyOverlap[] {
  const mgas = platformData.mgas.filter((m) => m.status === status);
  const mgaById = new Map(mgas.map((m) => [m.id, m]));
  const programs = platformData.programs.filter((p) => mgaById.has(p.mgaId));

  const buckets: {
    dimension: SynergyOverlap["dimension"];
    key: keyof typeof programs[0];
  }[] = [
    { dimension: "lineOfBusiness", key: "lineOfBusiness" },
    { dimension: "coverageType", key: "coverageType" },
    { dimension: "geographicRegion", key: "geographicRegion" },
  ];

  const overlaps: SynergyOverlap[] = [];

  for (const { dimension, key } of buckets) {
    const map = new Map<string, Set<string>>();
    for (const p of programs) {
      const value = p[key] as string;
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
