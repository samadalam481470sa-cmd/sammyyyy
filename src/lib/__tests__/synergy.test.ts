import { describe, expect, it } from "vitest";

import {
  buildCrossSellOpportunities,
  buildOverlapGroups,
  buildPairOverlaps,
  buildTagFootprints,
  type MgaInput,
  type ProgramInput,
  summariseSynergies,
} from "../synergy";

const mgas: MgaInput[] = [
  { id: "harborline", name: "Harborline Underwriters", slug: "harborline" },
  { id: "cascade", name: "Cascade Specialty Risk", slug: "cascade" },
  { id: "summit", name: "Summit Professional Lines", slug: "summit" },
];

function program(
  id: string,
  mgaId: string,
  lineOfBusiness: string,
  coverageType: string,
  geographicRegion: string,
  writtenPremiumUsd = 1_000_000,
  isActive = true,
): ProgramInput {
  return {
    id,
    mgaId,
    name: `${mgaId} ${lineOfBusiness}`,
    lineOfBusiness,
    coverageType,
    geographicRegion,
    writtenPremiumUsd,
    isActive,
  };
}

const programs: ProgramInput[] = [
  program("p1", "harborline", "Commercial Property", "Excess & Surplus", "Northeast", 5_000_000),
  program("p2", "harborline", "General Liability", "Admitted Primary", "Northeast", 3_000_000),
  program("p3", "cascade", "Commercial Property", "Excess & Surplus", "Mountain West", 2_000_000),
  program("p4", "cascade", "Environmental", "Excess & Surplus", "Pacific Northwest", 4_000_000),
  program("p5", "summit", "Professional Liability", "Excess & Surplus", "Mountain West", 6_000_000),
];

describe("buildOverlapGroups", () => {
  it("marks a tag carried by two MGAs as an overlap and a solo tag as not", () => {
    const groups = buildOverlapGroups("lineOfBusiness", mgas, programs);
    const byTag = new Map(groups.map((group) => [group.tag, group]));

    expect(byTag.get("Commercial Property")).toMatchObject({
      mgaCount: 2,
      isOverlap: true,
      totalWrittenPremiumUsd: 7_000_000,
    });
    expect(byTag.get("Environmental")).toMatchObject({
      mgaCount: 1,
      isOverlap: false,
    });
  });

  it("orders the widest overlaps first, then by premium", () => {
    const groups = buildOverlapGroups("coverageType", mgas, programs);
    expect(groups[0].tag).toBe("Excess & Surplus");
    expect(groups[0].mgaCount).toBe(3);
    expect(groups.map((group) => group.mgaCount)).toEqual(
      [...groups.map((group) => group.mgaCount)].sort((a, b) => b - a),
    );
  });

  it("rolls several programs from one MGA into a single presence row", () => {
    const withDuplicate = [
      ...programs,
      program("p6", "harborline", "Commercial Property", "Excess Layer", "Mid-Atlantic", 1_000_000),
    ];
    const group = buildOverlapGroups("lineOfBusiness", mgas, withDuplicate).find(
      (candidate) => candidate.tag === "Commercial Property",
    );

    expect(group?.mgaCount).toBe(2);
    expect(group?.programCount).toBe(3);
    const harborlinePresence = group?.mgas.find(
      (presence) => presence.mgaId === "harborline",
    );
    expect(harborlinePresence).toMatchObject({
      programCount: 2,
      writtenPremiumUsd: 6_000_000,
    });
  });

  it("ignores inactive programs", () => {
    const withInactive = [
      ...programs,
      program("p7", "summit", "Surety", "Monoline", "Southeast", 1_000_000, false),
    ];
    const tags = buildOverlapGroups("lineOfBusiness", mgas, withInactive).map(
      (group) => group.tag,
    );
    expect(tags).not.toContain("Surety");
  });

  it("ignores programs whose MGA is outside the requested set", () => {
    const scoped = buildOverlapGroups(
      "lineOfBusiness",
      [mgas[0]],
      programs,
    ).map((group) => group.tag);
    expect(scoped.sort()).toEqual(["Commercial Property", "General Liability"]);
  });
});

describe("buildTagFootprints", () => {
  it("collects distinct sorted tags per MGA", () => {
    const footprints = buildTagFootprints(programs);
    expect(footprints.get("harborline")).toEqual({
      mgaId: "harborline",
      linesOfBusiness: ["Commercial Property", "General Liability"],
      coverageTypes: ["Admitted Primary", "Excess & Surplus"],
      geographicRegions: ["Northeast"],
    });
  });

  it("omits MGAs with no active programs", () => {
    const footprints = buildTagFootprints([
      program("p8", "cardinal", "Workers' Compensation", "Monoline", "Midwest", 1, false),
    ]);
    expect(footprints.has("cardinal")).toBe(false);
  });
});

describe("buildPairOverlaps", () => {
  it("returns one row per unordered pair", () => {
    const pairs = buildPairOverlaps(mgas, programs);
    expect(pairs).toHaveLength(3);
  });

  it("reports the tags two MGAs actually share", () => {
    const pair = buildPairOverlaps(mgas, programs).find(
      (candidate) =>
        candidate.aMgaId === "cascade" || candidate.bMgaId === "cascade",
    );
    expect(pair).toBeDefined();

    const cascadeSummit = buildPairOverlaps(mgas, programs).find(
      (candidate) =>
        [candidate.aMgaId, candidate.bMgaId].sort().join("+") ===
        "cascade+summit",
    );
    expect(cascadeSummit?.sharedCoverageTypes).toEqual(["Excess & Surplus"]);
    expect(cascadeSummit?.sharedGeographicRegions).toEqual(["Mountain West"]);
    expect(cascadeSummit?.sharedLinesOfBusiness).toEqual([]);
    expect(cascadeSummit?.sharedTagCount).toBe(2);
  });

  it("scores a pair with nothing in common at zero", () => {
    const disjoint = buildPairOverlaps(
      [mgas[0], mgas[2]],
      [
        program("a", "harborline", "Commercial Property", "Excess Layer", "Northeast"),
        program("b", "summit", "Cyber", "Monoline", "Nationwide"),
      ],
    );
    expect(disjoint[0].overlapScore).toBe(0);
    expect(disjoint[0].sharedTagCount).toBe(0);
  });

  it("scores identical footprints at one", () => {
    const identical = buildPairOverlaps(
      [mgas[0], mgas[1]],
      [
        program("a", "harborline", "Cyber", "Monoline", "Nationwide"),
        program("b", "cascade", "Cyber", "Monoline", "Nationwide"),
      ],
    );
    expect(identical[0].overlapScore).toBeCloseTo(1, 10);
  });

  it("sorts the most overlapping pair first", () => {
    const pairs = buildPairOverlaps(mgas, programs);
    const scores = pairs.map((pair) => pair.overlapScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("does not pair an MGA with itself", () => {
    const pairs = buildPairOverlaps(mgas, programs);
    for (const pair of pairs) {
      expect(pair.aMgaId).not.toBe(pair.bMgaId);
    }
  });
});

describe("buildCrossSellOpportunities", () => {
  it("calls it a regional extension when the candidate already writes the line", () => {
    const opportunities = buildCrossSellOpportunities(
      [mgas[0], mgas[1]],
      [
        // Harborline proves Commercial Property in the Northeast.
        program("a", "harborline", "Commercial Property", "Excess & Surplus", "Northeast", 5_000_000),
        // Cascade writes Commercial Property elsewhere and is present in the Northeast.
        program("b", "cascade", "Commercial Property", "Excess & Surplus", "Mountain West", 2_000_000),
        program("c", "cascade", "Environmental", "Excess & Surplus", "Northeast", 1_000_000),
      ],
    );

    const match = opportunities.find(
      (opportunity) =>
        opportunity.candidateMgaId === "cascade" &&
        opportunity.lineOfBusiness === "Commercial Property" &&
        opportunity.geographicRegion === "Northeast",
    );

    expect(match?.opportunityKind).toBe("REGIONAL_EXTENSION");
    expect(match?.provenByMgas.map((mga) => mga.mgaId)).toEqual(["harborline"]);
    expect(match?.provenPremiumUsd).toBe(5_000_000);
  });

  it("calls it a product transfer when the candidate has never written the line", () => {
    const opportunities = buildCrossSellOpportunities(
      [mgas[1], mgas[2]],
      [
        program("a", "cascade", "Environmental", "Excess & Surplus", "Mountain West", 3_000_000),
        program("b", "summit", "Professional Liability", "Excess & Surplus", "Mountain West", 6_000_000),
      ],
    );

    const match = opportunities.find(
      (opportunity) =>
        opportunity.candidateMgaId === "summit" &&
        opportunity.lineOfBusiness === "Environmental",
    );

    expect(match?.opportunityKind).toBe("PRODUCT_TRANSFER");
    expect(match?.geographicRegion).toBe("Mountain West");
  });

  it("never names an existing provider as its own candidate", () => {
    const opportunities = buildCrossSellOpportunities(mgas, programs);
    for (const opportunity of opportunities) {
      expect(
        opportunity.provenByMgas.map((mga) => mga.mgaId),
      ).not.toContain(opportunity.candidateMgaId);
    }
  });

  it("requires the candidate to have a reason to be in the region", () => {
    // Summit has no program and no retailer in the Northeast, so Harborline's
    // Northeast property book is not an opportunity for it.
    const opportunities = buildCrossSellOpportunities(
      [mgas[0], mgas[2]],
      [
        program("a", "harborline", "Commercial Property", "Excess & Surplus", "Northeast"),
        program("b", "summit", "Professional Liability", "Excess & Surplus", "Mountain West"),
      ],
    );

    expect(
      opportunities.filter(
        (opportunity) =>
          opportunity.candidateMgaId === "summit" &&
          opportunity.geographicRegion === "Northeast",
      ),
    ).toHaveLength(0);
  });

  it("accepts retail distribution alone as a reason to be in the region", () => {
    const opportunities = buildCrossSellOpportunities(
      [mgas[0], mgas[2]],
      [
        program("a", "harborline", "Commercial Property", "Excess & Surplus", "Northeast"),
        program("b", "summit", "Professional Liability", "Excess & Surplus", "Mountain West"),
      ],
      [
        { id: "r1", mgaId: "summit", region: "Northeast" },
        { id: "r2", mgaId: "summit", region: "Northeast" },
      ],
    );

    const match = opportunities.find(
      (opportunity) =>
        opportunity.candidateMgaId === "summit" &&
        opportunity.geographicRegion === "Northeast",
    );

    expect(match).toBeDefined();
    expect(match?.candidateRetailReach).toBe(2);
    expect(match?.opportunityKind).toBe("PRODUCT_TRANSFER");
  });

  it("ranks regional extensions above product transfers", () => {
    const opportunities = buildCrossSellOpportunities(mgas, programs);
    const kinds = opportunities.map((opportunity) => opportunity.opportunityKind);
    const firstTransfer = kinds.indexOf("PRODUCT_TRANSFER");
    const lastExtension = kinds.lastIndexOf("REGIONAL_EXTENSION");

    if (firstTransfer !== -1 && lastExtension !== -1) {
      expect(lastExtension).toBeLessThan(firstTransfer);
    }
  });
});

describe("summariseSynergies", () => {
  it("splits every dimension into overlapping and exclusive tags", () => {
    const summaries = summariseSynergies(mgas, programs);
    expect(summaries.map((summary) => summary.dimension)).toEqual([
      "lineOfBusiness",
      "coverageType",
      "geographicRegion",
    ]);

    for (const summary of summaries) {
      expect(summary.overlappingTags.every((group) => group.mgaCount >= 2)).toBe(
        true,
      );
      expect(summary.exclusiveTags.every((group) => group.mgaCount === 1)).toBe(
        true,
      );
    }

    const lob = summaries[0];
    expect(lob.overlappingTags.map((group) => group.tag)).toEqual([
      "Commercial Property",
    ]);
    expect(lob.exclusiveTags.map((group) => group.tag).sort()).toEqual([
      "Environmental",
      "General Liability",
      "Professional Liability",
    ]);
  });
});
