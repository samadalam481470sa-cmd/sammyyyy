import type { MgaListItem } from "@/types/mga";

export type SynergyDimension = "lineOfBusiness" | "coverageType" | "geographicRegion";

export type SynergyGroup = {
  dimension: SynergyDimension;
  value: string;
  mgaIds: string[];
  mgaNames: string[];
};

const DIMENSION_TO_FIELD: Record<SynergyDimension, keyof MgaListItem> = {
  lineOfBusiness: "linesOfBusiness",
  coverageType: "coverageTypes",
  geographicRegion: "regions",
};

const DIMENSION_LABEL: Record<SynergyDimension, string> = {
  lineOfBusiness: "Line of Business",
  coverageType: "Coverage Type",
  geographicRegion: "Geographic Region",
};

export function dimensionLabel(dimension: SynergyDimension): string {
  return DIMENSION_LABEL[dimension];
}

/**
 * Groups acquired MGAs by a shared attribute (line of business, coverage
 * type, or region) and returns only the groups where 2+ distinct MGAs
 * overlap — these are the cross-portfolio "synergies" the exec team and
 * PE advisors care about.
 */
export function findSynergies(
  mgas: MgaListItem[],
  dimension: SynergyDimension,
): SynergyGroup[] {
  const field = DIMENSION_TO_FIELD[dimension];
  const buckets = new Map<string, { ids: Set<string>; names: Set<string> }>();

  for (const mga of mgas) {
    const values = mga[field] as string[];
    for (const value of values) {
      if (!buckets.has(value)) {
        buckets.set(value, { ids: new Set(), names: new Set() });
      }
      const bucket = buckets.get(value)!;
      bucket.ids.add(mga.id);
      bucket.names.add(mga.name);
    }
  }

  return Array.from(buckets.entries())
    .filter(([, bucket]) => bucket.ids.size > 1)
    .map(([value, bucket]) => ({
      dimension,
      value,
      mgaIds: Array.from(bucket.ids),
      mgaNames: Array.from(bucket.names).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => b.mgaIds.length - a.mgaIds.length || a.value.localeCompare(b.value));
}

export function findAllSynergies(mgas: MgaListItem[]): Record<SynergyDimension, SynergyGroup[]> {
  return {
    lineOfBusiness: findSynergies(mgas, "lineOfBusiness"),
    coverageType: findSynergies(mgas, "coverageType"),
    geographicRegion: findSynergies(mgas, "geographicRegion"),
  };
}
