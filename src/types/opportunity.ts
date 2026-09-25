/**
 * Core data model for the Newport Specialty Partners acquisition CRM.
 *
 * This file defines the shape of an "Opportunity" (an M&A acquisition
 * target/deal) along with the supporting pick-list types. These types are
 * intentionally decoupled from any single data source — today they describe
 * the mock dataset in `src/data`, but the same shapes are meant to describe
 * records returned by a future REST/GraphQL API.
 *
 * IMPORTANT MODELING NOTE:
 * `status` and `stage` are deliberately separate concepts.
 *  - `status`  = the broad lifecycle condition of the opportunity.
 *  - `stage`   = where the deal sits within the acquisition process.
 * An opportunity with status "Active" can be in any stage (NDA, LOI, etc).
 * Closed/Declined/Withdrew/Completed opportunities retain the stage they
 * were last in for historical reference, but no longer progress.
 */

/** Broad lifecycle condition of an acquisition opportunity. */
export type OpportunityStatus =
  | 'Active'
  | 'Pending'
  | 'Inactive'
  | 'Closed'
  | 'Declined'
  | 'Withdrew'
  | 'Completed';

/** Where a deal currently sits within Newport's acquisition process. */
export type OpportunityStage =
  | 'Target Identified'
  | 'Initial Outreach'
  | 'Preliminary Discussion'
  | 'NDA'
  | 'Initial Review'
  | 'IOI / LOI'
  | 'Exclusivity'
  | 'Due Diligence'
  | 'Closing';

/** The nature/structure of the acquisition opportunity. */
export type OpportunityType =
  | 'Platform Acquisition'
  | 'Add-on Acquisition'
  | 'Organic Growth Initiative'
  | 'Carrier Capacity';

/** Who/what originated the opportunity. */
export type SourceType =
  | 'Investment Banker'
  | 'Intermediary'
  | 'Direct MGA Relationship'
  | 'Carrier Partner'
  | 'Other';

/** Internal weekly-focus priority. A = must move, B = important, C = monitor. */
export type PriorityLevel = 'A' | 'B' | 'C';

export interface Opportunity {
  id: string;
  /** Confidential internal project code name, e.g. "Project Guardian". */
  projectName: string;
  /** Actual legal/operating entity name, e.g. "CrossCover Insurance Services". */
  entityName: string;
  type: OpportunityType;
  status: OpportunityStatus;
  stage: OpportunityStage;
  /** Newport team member who owns the deal. Empty string = unassigned. */
  dealLead: string;
  sourceType: SourceType;
  sourceName: string;
  specialty: string;
  geography: string;
  /** Net Written Premium, in whole USD. */
  nwp: number;
  /** Net Revenue, in whole USD. */
  netRevenue: number;
  /** Pro Forma EBITDA, in whole USD. */
  pfEbitda: number;
  /** Free-text description of the next action. Null = no next action assigned. */
  nextAction: string | null;
  /** ISO 8601 date string. Null when there is no scheduled next action. */
  nextActionDate: string | null;
  priority: PriorityLevel;
  /** ISO 8601 date string of the most recent recorded activity. */
  lastActivityDate: string;
}

/** A discrete, actionable follow-up tied to a deal, surfaced on the dashboard. */
export interface PriorityTask {
  id: string;
  priority: PriorityLevel;
  action: string;
  projectName: string;
  owner: string;
  /** ISO 8601 date string. */
  dueDate: string;
}

/** Category used to pick an icon/tone for a recent activity entry. */
export type ActivityType =
  | 'stage_change'
  | 'status_change'
  | 'note'
  | 'document'
  | 'diligence'
  | 'task';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  actor: string;
  message: string;
  projectName: string | null;
  /** ISO 8601 timestamp string. */
  timestamp: string;
}
