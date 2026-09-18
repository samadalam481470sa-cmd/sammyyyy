/**
 * Canonical tag vocabularies for the platform.
 *
 * Line of business, coverage type and geographic region are stored as strings
 * on `InsuranceProgram`, but they are only useful for synergy analysis if every
 * MGA spells them the same way. This module is the single source of truth: the
 * seed writes from it, the filter controls read from it, and the overlap engine
 * assumes any two equal strings really are the same thing.
 *
 * Adding a tag is a one-line change here. Promoting these to lookup tables is a
 * later migration, not a rewrite — see docs/SCHEMA.md.
 */

export const MGA_STATUS = {
  PIPELINE: "PIPELINE",
  ON_PLATFORM: "ON_PLATFORM",
} as const;

export type MgaStatus = (typeof MGA_STATUS)[keyof typeof MGA_STATUS];

export const MGA_STATUS_LABEL: Record<MgaStatus, string> = {
  PIPELINE: "Pipeline / Prospect",
  ON_PLATFORM: "Acquired / On Platform",
};

/** Corp-dev stages. The first four live inside the PIPELINE bucket. */
export const DEAL_STAGE = {
  SOURCED: "SOURCED",
  QUALIFIED: "QUALIFIED",
  DILIGENCE: "DILIGENCE",
  UNDER_LOI: "UNDER_LOI",
  CLOSED: "CLOSED",
  PASSED: "PASSED",
} as const;

export type DealStage = (typeof DEAL_STAGE)[keyof typeof DEAL_STAGE];

export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  SOURCED: "Sourced",
  QUALIFIED: "Qualified",
  DILIGENCE: "Diligence",
  UNDER_LOI: "Under LOI",
  CLOSED: "Closed",
  PASSED: "Passed",
};

/** Ordered for the pipeline funnel display. */
export const PIPELINE_STAGE_ORDER: DealStage[] = [
  DEAL_STAGE.SOURCED,
  DEAL_STAGE.QUALIFIED,
  DEAL_STAGE.DILIGENCE,
  DEAL_STAGE.UNDER_LOI,
];

export const LINES_OF_BUSINESS = [
  "Commercial Auto",
  "Commercial Property",
  "General Liability",
  "Professional Liability",
  "Workers' Compensation",
  "Inland Marine",
  "Environmental",
  "Cyber",
  "Personal Lines",
  "Surety",
] as const;

export type LineOfBusiness = (typeof LINES_OF_BUSINESS)[number];

export const COVERAGE_TYPES = [
  "Excess & Surplus",
  "Admitted Primary",
  "Excess Layer",
  "Umbrella",
  "Package",
  "Monoline",
  "Program Business",
] as const;

export type CoverageType = (typeof COVERAGE_TYPES)[number];

export const GEOGRAPHIC_REGIONS = [
  "Northeast",
  "Mid-Atlantic",
  "Southeast",
  "Midwest",
  "Gulf South",
  "Mountain West",
  "Pacific Northwest",
  "California",
  "Texas",
  "Nationwide",
] as const;

export type GeographicRegion = (typeof GEOGRAPHIC_REGIONS)[number];

/** The three dimensions the synergy engine can group and overlap on. */
export const SYNERGY_DIMENSIONS = {
  lineOfBusiness: "lineOfBusiness",
  coverageType: "coverageType",
  geographicRegion: "geographicRegion",
} as const;

export type SynergyDimension =
  (typeof SYNERGY_DIMENSIONS)[keyof typeof SYNERGY_DIMENSIONS];

export const SYNERGY_DIMENSION_LABEL: Record<SynergyDimension, string> = {
  lineOfBusiness: "Line of Business",
  coverageType: "Coverage Type",
  geographicRegion: "Geographic Region",
};

export type BestInClassThresholds = {
  /** Mary's target operator profile: 20-30+ years underwriting the same book. */
  minYearsOfExperience: number;
  /** Trailing EBITDA compound annual growth rate, as a decimal. */
  minEbitdaCagr: number;
  /** Floor on trailing EBITDA, in whole US dollars. */
  minLatestEbitdaUsd: number;
};

/**
 * Newport's stated acquisition thesis, in one place so the "Best in Class"
 * preset on the pipeline screen and the copy describing it cannot disagree.
 */
export const BEST_IN_CLASS_THRESHOLDS: BestInClassThresholds = {
  minYearsOfExperience: 20,
  minEbitdaCagr: 0.12,
  minLatestEbitdaUsd: 2_000_000,
};
