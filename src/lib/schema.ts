/**
 * Newport Specialty Partners — Core CRM Schema (MVP)
 *
 * Entities mirror Mary's requirements from the transcript.
 * Confirm on the 7:00 PM call: do EBITDA, Line of Business, and Region
 * capture exactly what leadership wants on screen?
 */

export type MgaStatus = "pipeline" | "acquired";

/** Primary CRM account: Managing General Agent */
export interface Mga {
  id: string;
  name: string;
  /** Targeting 20–30+ years */
  yearsOfExperience: number;
  status: MgaStatus;
  headquarters: string;
  /** Primary operating footprint (also mirrored on programs) */
  primaryRegion: string;
  notes?: string;
  acquiredAt?: string; // ISO date when status === acquired
}

/**
 * Historical financials — time-series for YoY EBITDA growth.
 * EBITDA here: earnings before interest, bad debt, and taxes.
 */
export interface MgaFinancial {
  id: string;
  mgaId: string;
  year: number;
  ebitda: number; // USD millions
}

/** Insurance programs underwritten/administered by an MGA */
export interface InsuranceProgram {
  id: string;
  mgaId: string;
  name: string;
  lineOfBusiness: string;
  coverageType: string;
  geographicRegion: string;
}

/**
 * Retail Agencies ("The Jakes") — independent entities managed by MGAs.
 * Associated_MGA is the foreign key back to Mga.
 */
export interface RetailAgency {
  id: string;
  name: string;
  associatedMgaId: string;
  city: string;
  state: string;
  premiumVolumeMm?: number;
}

export interface PlatformData {
  mgas: Mga[];
  financials: MgaFinancial[];
  programs: InsuranceProgram[];
  retailAgencies: RetailAgency[];
}

/** Derived metrics used by dashboards */
export interface MgaMetrics {
  mga: Mga;
  latestEbitda: number | null;
  priorEbitda: number | null;
  yoyEbitdaGrowth: number | null; // fraction, e.g. 0.18 = 18%
  programs: InsuranceProgram[];
  retailCount: number;
  linesOfBusiness: string[];
  coverageTypes: string[];
  regions: string[];
}

export interface SynergyOverlap {
  dimension: "lineOfBusiness" | "coverageType" | "geographicRegion";
  value: string;
  mgaIds: string[];
  mgaNames: string[];
}
