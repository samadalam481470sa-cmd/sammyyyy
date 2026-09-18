/**
 * Synergy analysis for the aggregated portfolio.
 *
 * Mary's "one platform" question is really three questions asked of the same
 * data: where do the acquired MGAs already overlap, where is a capability
 * trapped inside a single MGA, and where does one MGA's distribution reach a
 * region another MGA's product has never been sold into.
 *
 * All three are answered by joining `InsuranceProgram` tags across MGAs. The
 * functions are pure so the results are testable and so the same computation
 * can serve a page render or an API response.
 */

import {
  SYNERGY_DIMENSIONS,
  type SynergyDimension,
} from "./taxonomy";

export type ProgramInput = {
  id: string;
  mgaId: string;
  name: string;
  lineOfBusiness: string;
  coverageType: string;
  geographicRegion: string;
  writtenPremiumUsd: number;
  isActive: boolean;
};

export type MgaInput = {
  id: string;
  name: string;
  slug: string;
};

export type RetailAgencyInput = {
  id: string;
  mgaId: string;
  region: string;
};

export type MgaTagPresence = {
  mgaId: string;
  mgaName: string;
  mgaSlug: string;
  programCount: number;
  writtenPremiumUsd: number;
};

export type OverlapGroup = {
  dimension: SynergyDimension;
  tag: string;
  mgaCount: number;
  programCount: number;
  totalWrittenPremiumUsd: number;
  mgas: MgaTagPresence[];
  /** True when two or more MGAs share the tag — the definition of an overlap. */
  isOverlap: boolean;
};

/**
 * Groups every tag on a dimension by the MGAs that carry it, ordered so the
 * widest overlaps (most MGAs, then most premium) sort to the top of the screen.
 */
export function buildOverlapGroups(
  dimension: SynergyDimension,
  mgas: MgaInput[],
  programs: ProgramInput[],
): OverlapGroup[] {
  const mgaById = new Map(mgas.map((mga) => [mga.id, mga]));
  const byTag = new Map<string, Map<string, MgaTagPresence>>();

  for (const program of programs) {
    if (!program.isActive) continue;
    const mga = mgaById.get(program.mgaId);
    if (!mga) continue;

    const tag = program[dimension];
    let tagEntry = byTag.get(tag);
    if (!tagEntry) {
      tagEntry = new Map();
      byTag.set(tag, tagEntry);
    }

    const existing = tagEntry.get(mga.id);
    if (existing) {
      existing.programCount += 1;
      existing.writtenPremiumUsd += program.writtenPremiumUsd;
    } else {
      tagEntry.set(mga.id, {
        mgaId: mga.id,
        mgaName: mga.name,
        mgaSlug: mga.slug,
        programCount: 1,
        writtenPremiumUsd: program.writtenPremiumUsd,
      });
    }
  }

  const groups: OverlapGroup[] = [...byTag.entries()].map(
    ([tag, presenceByMga]) => {
      const presences = [...presenceByMga.values()].sort(
        (a, b) => b.writtenPremiumUsd - a.writtenPremiumUsd,
      );
      return {
        dimension,
        tag,
        mgaCount: presences.length,
        programCount: presences.reduce((sum, p) => sum + p.programCount, 0),
        totalWrittenPremiumUsd: presences.reduce(
          (sum, p) => sum + p.writtenPremiumUsd,
          0,
        ),
        mgas: presences,
        isOverlap: presences.length >= 2,
      };
    },
  );

  return groups.sort(
    (a, b) =>
      b.mgaCount - a.mgaCount ||
      b.totalWrittenPremiumUsd - a.totalWrittenPremiumUsd ||
      a.tag.localeCompare(b.tag),
  );
}

/** The set of distinct tags an MGA carries on each dimension. */
export type MgaTagFootprint = {
  mgaId: string;
  linesOfBusiness: string[];
  coverageTypes: string[];
  geographicRegions: string[];
};

export function buildTagFootprints(
  programs: ProgramInput[],
): Map<string, MgaTagFootprint> {
  const footprints = new Map<
    string,
    {
      mgaId: string;
      linesOfBusiness: Set<string>;
      coverageTypes: Set<string>;
      geographicRegions: Set<string>;
    }
  >();

  for (const program of programs) {
    if (!program.isActive) continue;
    let entry = footprints.get(program.mgaId);
    if (!entry) {
      entry = {
        mgaId: program.mgaId,
        linesOfBusiness: new Set(),
        coverageTypes: new Set(),
        geographicRegions: new Set(),
      };
      footprints.set(program.mgaId, entry);
    }
    entry.linesOfBusiness.add(program.lineOfBusiness);
    entry.coverageTypes.add(program.coverageType);
    entry.geographicRegions.add(program.geographicRegion);
  }

  return new Map(
    [...footprints.entries()].map(([mgaId, entry]) => [
      mgaId,
      {
        mgaId,
        linesOfBusiness: [...entry.linesOfBusiness].sort(),
        coverageTypes: [...entry.coverageTypes].sort(),
        geographicRegions: [...entry.geographicRegions].sort(),
      },
    ]),
  );
}

export type MgaPairOverlap = {
  aMgaId: string;
  aMgaName: string;
  bMgaId: string;
  bMgaName: string;
  sharedLinesOfBusiness: string[];
  sharedCoverageTypes: string[];
  sharedGeographicRegions: string[];
  sharedTagCount: number;
  /** Jaccard similarity across all three dimensions combined, 0-1. */
  overlapScore: number;
};

/**
 * Pairwise overlap between every two MGAs, scored with Jaccard similarity over
 * the union of their three tag sets. Jaccard is used rather than a raw count so
 * a broad MGA with many programs does not look synergistic with everything
 * simply by virtue of being large.
 */
export function buildPairOverlaps(
  mgas: MgaInput[],
  programs: ProgramInput[],
): MgaPairOverlap[] {
  const footprints = buildTagFootprints(programs);
  const pairs: MgaPairOverlap[] = [];

  for (let i = 0; i < mgas.length; i += 1) {
    for (let j = i + 1; j < mgas.length; j += 1) {
      const a = mgas[i];
      const b = mgas[j];
      const fa = footprints.get(a.id);
      const fb = footprints.get(b.id);
      if (!fa || !fb) continue;

      const sharedLob = intersect(fa.linesOfBusiness, fb.linesOfBusiness);
      const sharedCoverage = intersect(fa.coverageTypes, fb.coverageTypes);
      const sharedRegion = intersect(
        fa.geographicRegions,
        fb.geographicRegions,
      );

      const intersectionSize =
        sharedLob.length + sharedCoverage.length + sharedRegion.length;
      const unionSize =
        union(fa.linesOfBusiness, fb.linesOfBusiness).length +
        union(fa.coverageTypes, fb.coverageTypes).length +
        union(fa.geographicRegions, fb.geographicRegions).length;

      pairs.push({
        aMgaId: a.id,
        aMgaName: a.name,
        bMgaId: b.id,
        bMgaName: b.name,
        sharedLinesOfBusiness: sharedLob,
        sharedCoverageTypes: sharedCoverage,
        sharedGeographicRegions: sharedRegion,
        sharedTagCount: intersectionSize,
        overlapScore: unionSize === 0 ? 0 : intersectionSize / unionSize,
      });
    }
  }

  return pairs.sort(
    (a, b) => b.overlapScore - a.overlapScore || b.sharedTagCount - a.sharedTagCount,
  );
}

export type CrossSellOpportunity = {
  lineOfBusiness: string;
  geographicRegion: string;
  /** MGAs already writing this line in this region. */
  provenByMgas: { mgaId: string; mgaName: string; mgaSlug: string }[];
  candidateMgaId: string;
  candidateMgaName: string;
  candidateMgaSlug: string;
  /**
   * REGIONAL_EXTENSION — the candidate already writes the line elsewhere and
   * has distribution in the region, so it is a filing-and-appointment problem.
   * PRODUCT_TRANSFER — the candidate has distribution in the region but has
   * never written the line, so the product has to come from a sibling MGA.
   */
  opportunityKind: "REGIONAL_EXTENSION" | "PRODUCT_TRANSFER";
  /** Retail agencies the candidate already has appointed in the region. */
  candidateRetailReach: number;
  /** Premium the proven MGAs write in this line/region pair. */
  provenPremiumUsd: number;
};

/**
 * Finds white space on the platform: a line of business that one acquired MGA
 * already writes profitably in a region where a sibling MGA has distribution
 * but no product.
 *
 * Regional extensions rank above product transfers because the candidate
 * already owns the underwriting capability, and within each kind the largest
 * proven premium ranks first.
 */
export function buildCrossSellOpportunities(
  mgas: MgaInput[],
  programs: ProgramInput[],
  retailAgencies: RetailAgencyInput[] = [],
): CrossSellOpportunity[] {
  const activePrograms = programs.filter((program) => program.isActive);
  const footprints = buildTagFootprints(activePrograms);
  const mgaById = new Map(mgas.map((mga) => [mga.id, mga]));

  // Premium and providers for each (line of business, region) pair.
  const pairKey = (lob: string, region: string) => `${lob}||${region}`;
  const providersByPair = new Map<
    string,
    { lineOfBusiness: string; geographicRegion: string; mgaIds: Set<string>; premiumUsd: number }
  >();

  for (const program of activePrograms) {
    const key = pairKey(program.lineOfBusiness, program.geographicRegion);
    let entry = providersByPair.get(key);
    if (!entry) {
      entry = {
        lineOfBusiness: program.lineOfBusiness,
        geographicRegion: program.geographicRegion,
        mgaIds: new Set(),
        premiumUsd: 0,
      };
      providersByPair.set(key, entry);
    }
    entry.mgaIds.add(program.mgaId);
    entry.premiumUsd += program.writtenPremiumUsd;
  }

  // Retail distribution reach per MGA per region.
  const retailReach = new Map<string, number>();
  for (const agency of retailAgencies) {
    const key = `${agency.mgaId}||${agency.region}`;
    retailReach.set(key, (retailReach.get(key) ?? 0) + 1);
  }

  const opportunities: CrossSellOpportunity[] = [];

  for (const entry of providersByPair.values()) {
    for (const candidate of mgas) {
      if (entry.mgaIds.has(candidate.id)) continue;

      const footprint = footprints.get(candidate.id);
      if (!footprint) continue;

      const hasProgramPresenceInRegion = footprint.geographicRegions.includes(
        entry.geographicRegion,
      );
      const retailInRegion =
        retailReach.get(`${candidate.id}||${entry.geographicRegion}`) ?? 0;

      // A candidate needs a real reason to be in the region: either it already
      // writes something there, or it has retailers appointed there.
      if (!hasProgramPresenceInRegion && retailInRegion === 0) continue;

      const writesLineElsewhere = footprint.linesOfBusiness.includes(
        entry.lineOfBusiness,
      );

      opportunities.push({
        lineOfBusiness: entry.lineOfBusiness,
        geographicRegion: entry.geographicRegion,
        provenByMgas: [...entry.mgaIds]
          .map((id) => mgaById.get(id))
          .filter((mga): mga is MgaInput => Boolean(mga))
          .map((mga) => ({
            mgaId: mga.id,
            mgaName: mga.name,
            mgaSlug: mga.slug,
          })),
        candidateMgaId: candidate.id,
        candidateMgaName: candidate.name,
        candidateMgaSlug: candidate.slug,
        opportunityKind: writesLineElsewhere
          ? "REGIONAL_EXTENSION"
          : "PRODUCT_TRANSFER",
        candidateRetailReach: retailInRegion,
        provenPremiumUsd: entry.premiumUsd,
      });
    }
  }

  const kindRank = { REGIONAL_EXTENSION: 0, PRODUCT_TRANSFER: 1 } as const;

  return opportunities.sort(
    (a, b) =>
      kindRank[a.opportunityKind] - kindRank[b.opportunityKind] ||
      b.provenPremiumUsd - a.provenPremiumUsd ||
      b.candidateRetailReach - a.candidateRetailReach,
  );
}

export type SynergySummary = {
  dimension: SynergyDimension;
  /** Tags carried by two or more MGAs. */
  overlappingTags: OverlapGroup[];
  /** Tags carried by exactly one MGA — a capability the platform has not spread yet. */
  exclusiveTags: OverlapGroup[];
};

export function summariseSynergies(
  mgas: MgaInput[],
  programs: ProgramInput[],
): SynergySummary[] {
  return Object.values(SYNERGY_DIMENSIONS).map((dimension) => {
    const groups = buildOverlapGroups(dimension, mgas, programs);
    return {
      dimension,
      overlappingTags: groups.filter((group) => group.isOverlap),
      exclusiveTags: groups.filter((group) => !group.isOverlap),
    };
  });
}

function intersect(a: string[], b: string[]): string[] {
  const bSet = new Set(b);
  return a.filter((value) => bSet.has(value)).sort();
}

function union(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])].sort();
}
