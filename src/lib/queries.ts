/**
 * Read models for the dashboards.
 *
 * Each function returns exactly what one screen needs, already joined and with
 * derived metrics computed, so pages stay presentational and the API routes and
 * the pages cannot disagree about a number.
 */

import { prisma } from "./db";
import {
  aggregateEbitdaByYear,
  buildEbitdaTrend,
  evaluateBestInClass,
  type BestInClassResult,
  type EbitdaTrend,
} from "./metrics";
import {
  buildCrossSellOpportunities,
  buildOverlapGroups,
  buildPairOverlaps,
  buildTagFootprints,
  type CrossSellOpportunity,
  type MgaPairOverlap,
  type MgaTagFootprint,
  type OverlapGroup,
  type ProgramInput,
} from "./synergy";
import {
  MGA_STATUS,
  SYNERGY_DIMENSIONS,
  type SynergyDimension,
} from "./taxonomy";

const mgaWithRelations = {
  financials: { orderBy: { fiscalYear: "asc" } },
  programs: { orderBy: { writtenPremiumUsd: "desc" } },
  retailAgencies: { orderBy: { annualPremiumPlacedUsd: "desc" } },
} as const;

export type FinancialPeriodRow = {
  fiscalYear: number;
  revenueUsd: number;
  ebitdaUsd: number;
  badDebtAddbackUsd: number | null;
  writtenPremiumUsd: number;
  isAudited: boolean;
  isProjected: boolean;
};

export type MgaSummary = {
  id: string;
  slug: string;
  name: string;
  status: string;
  stage: string;
  yearsOfExperience: number;
  foundedYear: number;
  principalName: string;
  headquartersCity: string;
  headquartersState: string;
  primaryRegion: string;
  employeeCount: number | null;
  website: string | null;
  acquisitionDate: string | null;
  enterpriseValueUsd: number | null;
  ebitdaMultiple: number | null;
  ownershipPercent: number | null;
  dealLead: string | null;
  notes: string | null;
  /**
   * Raw history, shipped alongside the derived trend so an interactive screen
   * can recompute growth with or without management projections using the same
   * pure functions the server used, instead of asking the server again.
   */
  financials: FinancialPeriodRow[];
  trend: EbitdaTrend;
  bestInClass: BestInClassResult;
  linesOfBusiness: string[];
  coverageTypes: string[];
  geographicRegions: string[];
  programCount: number;
  retailAgencyCount: number;
  /** Sum of active program premium — the MGA's current placed volume. */
  programPremiumUsd: number;
};

type MgaRecord = {
  id: string;
  slug: string;
  name: string;
  status: string;
  stage: string;
  yearsOfExperience: number;
  foundedYear: number;
  principalName: string;
  headquartersCity: string;
  headquartersState: string;
  primaryRegion: string;
  employeeCount: number | null;
  website: string | null;
  acquisitionDate: Date | null;
  enterpriseValueUsd: number | null;
  ebitdaMultiple: number | null;
  ownershipPercent: number | null;
  dealLead: string | null;
  notes: string | null;
  financials: {
    fiscalYear: number;
    revenueUsd: number;
    ebitdaUsd: number;
    badDebtAddbackUsd: number | null;
    writtenPremiumUsd: number;
    isProjected: boolean;
    isAudited: boolean;
  }[];
  programs: {
    id: string;
    name: string;
    lineOfBusiness: string;
    coverageType: string;
    geographicRegion: string;
    carrierPartner: string | null;
    writtenPremiumUsd: number;
    lossRatio: number | null;
    isActive: boolean;
  }[];
  retailAgencies: {
    id: string;
    name: string;
    principalName: string;
    city: string;
    state: string;
    region: string;
    appointedOn: Date | null;
    annualPremiumPlacedUsd: number | null;
    policyCount: number | null;
    isActive: boolean;
  }[];
};

function toSummary(
  mga: MgaRecord,
  options: { includeProjections: boolean },
): MgaSummary {
  const trend = buildEbitdaTrend(mga.financials, {
    includeProjections: options.includeProjections,
  });

  const activePrograms = mga.programs.filter((program) => program.isActive);

  return {
    id: mga.id,
    slug: mga.slug,
    name: mga.name,
    status: mga.status,
    stage: mga.stage,
    yearsOfExperience: mga.yearsOfExperience,
    foundedYear: mga.foundedYear,
    principalName: mga.principalName,
    headquartersCity: mga.headquartersCity,
    headquartersState: mga.headquartersState,
    primaryRegion: mga.primaryRegion,
    employeeCount: mga.employeeCount,
    website: mga.website,
    acquisitionDate: mga.acquisitionDate
      ? mga.acquisitionDate.toISOString()
      : null,
    enterpriseValueUsd: mga.enterpriseValueUsd,
    ebitdaMultiple: mga.ebitdaMultiple,
    ownershipPercent: mga.ownershipPercent,
    dealLead: mga.dealLead,
    notes: mga.notes,
    financials: mga.financials.map((period) => ({
      fiscalYear: period.fiscalYear,
      revenueUsd: period.revenueUsd,
      ebitdaUsd: period.ebitdaUsd,
      badDebtAddbackUsd: period.badDebtAddbackUsd,
      writtenPremiumUsd: period.writtenPremiumUsd,
      isAudited: period.isAudited,
      isProjected: period.isProjected,
    })),
    trend,
    bestInClass: evaluateBestInClass({
      yearsOfExperience: mga.yearsOfExperience,
      ebitdaCagr: trend.ebitdaCagr,
      latestEbitdaUsd: trend.latestEbitdaUsd,
    }),
    linesOfBusiness: distinctSorted(
      activePrograms.map((program) => program.lineOfBusiness),
    ),
    coverageTypes: distinctSorted(
      activePrograms.map((program) => program.coverageType),
    ),
    geographicRegions: distinctSorted(
      activePrograms.map((program) => program.geographicRegion),
    ),
    programCount: activePrograms.length,
    retailAgencyCount: mga.retailAgencies.length,
    programPremiumUsd: activePrograms.reduce(
      (sum, program) => sum + program.writtenPremiumUsd,
      0,
    ),
  };
}

function distinctSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

/**
 * Pipeline targets for the corp-dev screen.
 *
 * `includeProjections` defaults to false: growth is computed from actuals only,
 * so a target's ranking never depends on its own management forecast unless the
 * team deliberately asks to see it.
 */
export async function getPipelineTargets(
  options: { includeProjections?: boolean } = {},
): Promise<MgaSummary[]> {
  const includeProjections = options.includeProjections ?? false;
  const records = await prisma.mga.findMany({
    where: { status: MGA_STATUS.PIPELINE },
    include: mgaWithRelations,
    orderBy: { name: "asc" },
  });

  return records
    .map((record) => toSummary(record, { includeProjections }))
    .sort((a, b) => b.bestInClass.score - a.bestInClass.score);
}

/** Acquired MGAs for the aggregated portfolio screen. */
export async function getPortfolioCompanies(): Promise<MgaSummary[]> {
  const records = await prisma.mga.findMany({
    where: { status: MGA_STATUS.ON_PLATFORM },
    include: mgaWithRelations,
    orderBy: { name: "asc" },
  });

  return records
    .map((record) => toSummary(record, { includeProjections: true }))
    .sort(
      (a, b) => (b.trend.latestEbitdaUsd ?? 0) - (a.trend.latestEbitdaUsd ?? 0),
    );
}

export type PlatformSummary = {
  onPlatformCount: number;
  pipelineCount: number;
  passedCount: number;
  retailAgencyCount: number;
  programCount: number;
  platformEbitdaUsd: number;
  platformRevenueUsd: number;
  platformWrittenPremiumUsd: number;
  platformEbitdaCagr: number | null;
  latestFiscalYear: number | null;
  weightedAverageYearsOfExperience: number | null;
  investedCapitalUsd: number;
  aggregateEbitdaByYear: ReturnType<typeof aggregateEbitdaByYear>;
  distinctLinesOfBusiness: number;
  distinctRegions: number;
};

/** Headline numbers for the executive overview. */
export async function getPlatformSummary(): Promise<PlatformSummary> {
  const [portfolio, pipeline, retailAgencyCount] = await Promise.all([
    getPortfolioCompanies(),
    getPipelineTargets(),
    prisma.retailAgency.count(),
  ]);

  const aggregate = aggregateEbitdaByYear(
    portfolio.map((company) => company.trend),
  );
  const latest = aggregate.length > 0 ? aggregate[aggregate.length - 1] : null;
  const first = aggregate.length > 0 ? aggregate[0] : null;

  const totalEbitdaForWeighting = portfolio.reduce(
    (sum, company) => sum + (company.trend.latestEbitdaUsd ?? 0),
    0,
  );

  return {
    onPlatformCount: portfolio.length,
    pipelineCount: pipeline.filter((target) => target.stage !== "PASSED").length,
    passedCount: pipeline.filter((target) => target.stage === "PASSED").length,
    retailAgencyCount,
    programCount: portfolio.reduce(
      (sum, company) => sum + company.programCount,
      0,
    ),
    platformEbitdaUsd: latest?.ebitdaUsd ?? 0,
    platformRevenueUsd: latest?.revenueUsd ?? 0,
    platformWrittenPremiumUsd: latest?.writtenPremiumUsd ?? 0,
    // Measured on the aggregate series, which steps up as MGAs are acquired —
    // the chart labels the contributing count per year so the two are read
    // together rather than mistaken for organic growth.
    platformEbitdaCagr:
      first && latest && first.fiscalYear !== latest.fiscalYear
        ? Math.pow(
            latest.ebitdaUsd / first.ebitdaUsd,
            1 / (latest.fiscalYear - first.fiscalYear),
          ) - 1
        : null,
    latestFiscalYear: latest?.fiscalYear ?? null,
    weightedAverageYearsOfExperience:
      totalEbitdaForWeighting > 0
        ? portfolio.reduce(
            (sum, company) =>
              sum +
              company.yearsOfExperience *
                ((company.trend.latestEbitdaUsd ?? 0) /
                  totalEbitdaForWeighting),
            0,
          )
        : null,
    investedCapitalUsd: portfolio.reduce(
      (sum, company) =>
        sum +
        (company.enterpriseValueUsd ?? 0) *
          ((company.ownershipPercent ?? 100) / 100),
      0,
    ),
    aggregateEbitdaByYear: aggregate,
    distinctLinesOfBusiness: new Set(
      portfolio.flatMap((company) => company.linesOfBusiness),
    ).size,
    distinctRegions: new Set(
      portfolio.flatMap((company) => company.geographicRegions),
    ).size,
  };
}

export type SynergyAnalysis = {
  companies: MgaSummary[];
  overlapsByDimension: Record<SynergyDimension, OverlapGroup[]>;
  pairOverlaps: MgaPairOverlap[];
  crossSellOpportunities: CrossSellOpportunity[];
  footprints: Record<string, MgaTagFootprint>;
};

/**
 * Everything the synergy screen needs, computed over acquired MGAs only —
 * synergy between two companies Newport does not own is not a synergy.
 */
export async function getSynergyAnalysis(): Promise<SynergyAnalysis> {
  const records = await prisma.mga.findMany({
    where: { status: MGA_STATUS.ON_PLATFORM },
    include: mgaWithRelations,
    orderBy: { name: "asc" },
  });

  const companies = records
    .map((record) => toSummary(record, { includeProjections: true }))
    .sort(
      (a, b) => (b.trend.latestEbitdaUsd ?? 0) - (a.trend.latestEbitdaUsd ?? 0),
    );

  const mgaInputs = companies.map((company) => ({
    id: company.id,
    name: company.name,
    slug: company.slug,
  }));

  const programInputs: ProgramInput[] = records.flatMap((record) =>
    record.programs.map((program) => ({
      id: program.id,
      mgaId: record.id,
      name: program.name,
      lineOfBusiness: program.lineOfBusiness,
      coverageType: program.coverageType,
      geographicRegion: program.geographicRegion,
      writtenPremiumUsd: program.writtenPremiumUsd,
      isActive: program.isActive,
    })),
  );

  const retailInputs = records.flatMap((record) =>
    record.retailAgencies.map((agency) => ({
      id: agency.id,
      mgaId: record.id,
      region: agency.region,
    })),
  );

  return {
    companies,
    overlapsByDimension: {
      [SYNERGY_DIMENSIONS.lineOfBusiness]: buildOverlapGroups(
        SYNERGY_DIMENSIONS.lineOfBusiness,
        mgaInputs,
        programInputs,
      ),
      [SYNERGY_DIMENSIONS.coverageType]: buildOverlapGroups(
        SYNERGY_DIMENSIONS.coverageType,
        mgaInputs,
        programInputs,
      ),
      [SYNERGY_DIMENSIONS.geographicRegion]: buildOverlapGroups(
        SYNERGY_DIMENSIONS.geographicRegion,
        mgaInputs,
        programInputs,
      ),
    },
    pairOverlaps: buildPairOverlaps(mgaInputs, programInputs),
    crossSellOpportunities: buildCrossSellOpportunities(
      mgaInputs,
      programInputs,
      retailInputs,
    ),
    footprints: Object.fromEntries(buildTagFootprints(programInputs)),
  };
}

export type MgaDetail = MgaSummary & {
  programs: {
    id: string;
    name: string;
    lineOfBusiness: string;
    coverageType: string;
    geographicRegion: string;
    carrierPartner: string | null;
    writtenPremiumUsd: number;
    lossRatio: number | null;
    isActive: boolean;
  }[];
  retailAgencies: {
    id: string;
    name: string;
    principalName: string;
    city: string;
    state: string;
    region: string;
    appointedOn: string | null;
    annualPremiumPlacedUsd: number | null;
    policyCount: number | null;
    isActive: boolean;
  }[];
  /** Tags this MGA shares with at least one other acquired MGA. */
  sharedTags: {
    linesOfBusiness: string[];
    coverageTypes: string[];
    geographicRegions: string[];
  };
};

export async function getMgaBySlug(slug: string): Promise<MgaDetail | null> {
  const record = await prisma.mga.findUnique({
    where: { slug },
    include: mgaWithRelations,
  });

  if (!record) return null;

  const summary = toSummary(record, { includeProjections: true });
  const sharedTags = await getSharedTagsForMga(record.id);

  return {
    ...summary,
    programs: record.programs.map((program) => ({
      id: program.id,
      name: program.name,
      lineOfBusiness: program.lineOfBusiness,
      coverageType: program.coverageType,
      geographicRegion: program.geographicRegion,
      carrierPartner: program.carrierPartner,
      writtenPremiumUsd: program.writtenPremiumUsd,
      lossRatio: program.lossRatio,
      isActive: program.isActive,
    })),
    retailAgencies: record.retailAgencies.map((agency) => ({
      id: agency.id,
      name: agency.name,
      principalName: agency.principalName,
      city: agency.city,
      state: agency.state,
      region: agency.region,
      appointedOn: agency.appointedOn ? agency.appointedOn.toISOString() : null,
      annualPremiumPlacedUsd: agency.annualPremiumPlacedUsd,
      policyCount: agency.policyCount,
      isActive: agency.isActive,
    })),
    sharedTags,
  };
}

/**
 * Tags the given MGA has in common with any other acquired MGA. Used on the
 * detail page to mark which of an MGA's capabilities the platform already has
 * a second source for.
 */
async function getSharedTagsForMga(mgaId: string): Promise<{
  linesOfBusiness: string[];
  coverageTypes: string[];
  geographicRegions: string[];
}> {
  const programs = await prisma.insuranceProgram.findMany({
    where: { isActive: true, mga: { status: MGA_STATUS.ON_PLATFORM } },
    select: {
      mgaId: true,
      lineOfBusiness: true,
      coverageType: true,
      geographicRegion: true,
    },
  });

  const collect = (dimension: SynergyDimension) => {
    const mine = new Set(
      programs
        .filter((program) => program.mgaId === mgaId)
        .map((program) => program[dimension]),
    );
    const theirs = new Set(
      programs
        .filter((program) => program.mgaId !== mgaId)
        .map((program) => program[dimension]),
    );
    return [...mine].filter((tag) => theirs.has(tag)).sort();
  };

  return {
    linesOfBusiness: collect(SYNERGY_DIMENSIONS.lineOfBusiness),
    coverageTypes: collect(SYNERGY_DIMENSIONS.coverageType),
    geographicRegions: collect(SYNERGY_DIMENSIONS.geographicRegion),
  };
}

export type RetailAgencyRow = {
  id: string;
  name: string;
  principalName: string;
  city: string;
  state: string;
  region: string;
  appointedOn: string | null;
  annualPremiumPlacedUsd: number | null;
  policyCount: number | null;
  isActive: boolean;
  mgaId: string;
  mgaName: string;
  mgaSlug: string;
  mgaStatus: string;
};

/** The full "Jakes" directory, with the MGA each retailer is appointed through. */
export async function getRetailAgencies(): Promise<RetailAgencyRow[]> {
  const records = await prisma.retailAgency.findMany({
    include: { mga: { select: { id: true, name: true, slug: true, status: true } } },
    orderBy: [{ annualPremiumPlacedUsd: "desc" }],
  });

  return records.map((agency) => ({
    id: agency.id,
    name: agency.name,
    principalName: agency.principalName,
    city: agency.city,
    state: agency.state,
    region: agency.region,
    appointedOn: agency.appointedOn ? agency.appointedOn.toISOString() : null,
    annualPremiumPlacedUsd: agency.annualPremiumPlacedUsd,
    policyCount: agency.policyCount,
    isActive: agency.isActive,
    mgaId: agency.mga.id,
    mgaName: agency.mga.name,
    mgaSlug: agency.mga.slug,
    mgaStatus: agency.mga.status,
  }));
}