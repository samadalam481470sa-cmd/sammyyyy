// Newport Specialty Partners CRM & Portfolio Platform - Core Data Types

export type MGAStatus = 'Pipeline' | 'Acquired';

export type PipelineStage = 
  | 'Initial Screening'
  | 'Due Diligence'
  | 'LOI Signed'
  | 'Deal Closing'
  | 'On-Platform';

export type GeographicRegion = 
  | 'Northeast'
  | 'Southeast'
  | 'Midwest'
  | 'West / Pacific'
  | 'Southwest'
  | 'National';

export type LineOfBusiness = 
  | 'Commercial Property'
  | 'Specialty Casualty'
  | 'Professional Liability / E&O'
  | 'Executive Liability / D&O'
  | 'Inland & Ocean Marine'
  | 'Cyber Risk & Tech E&O'
  | 'Environmental & Energy'
  | 'Specialty Excess & Surplus (E&S)'
  | 'Workers Compensation';

export type CoverageType =
  | 'Primary General Liability'
  | 'Excess & Umbrella Liability'
  | 'Named Perils First-Party Property'
  | 'All-Risk Cargo & Hull'
  | 'Third-Party Cyber Breach & Liability'
  | 'Pollution Legal Liability'
  | 'Miscellaneous E&O'
  | 'Directors & Officers'
  | 'Commercial Auto Physical Damage';

export interface LeadershipMember {
  name: string;
  title: string;
  email: string;
  yearsInIndustry: number;
}

export interface FinancialYear {
  fiscal_year: number;
  historical_ebitda: number; // in USD (earnings before interest, bad debt, taxes)
  gross_written_premium: number; // GWP in USD
  revenue: number; // net commission / brokerage fees
  ebitda_margin_pct: number; // %
  yoy_ebitda_growth_pct: number; // YoY % change
  loss_ratio_pct: number; // carrier loss ratio
  bad_debt_loss_rate: number; // %
}

export interface InsuranceProgram {
  id: string;
  mga_id: string;
  program_name: string;
  line_of_business: LineOfBusiness;
  coverage_type: CoverageType;
  geographic_region: GeographicRegion;
  carrier_partner: string;
  carrier_rating: string;
  annual_gwp: number;
  average_commission_rate: number; // e.g. 15%
  underwriting_authority_limit: number; // $ per risk
  target_industry: string;
  active_policies: number;
}

export interface RetailAgency {
  id: string;
  associated_mga_id: string;
  agency_name: string;
  principal_agent: string; // The "Jake" contact
  email: string;
  phone: string;
  city: string;
  state: string;
  region: GeographicRegion;
  annual_placed_premium: number;
  active_policies_count: number;
  tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze';
  primary_lines_placed: LineOfBusiness[];
  years_partnered: number;
}

export interface MGA {
  id: string;
  name: string;
  legal_name: string;
  code: string;
  founded_year: number;
  years_of_experience: number; // Target: 20-30+ years
  status: MGAStatus;
  pipeline_stage: PipelineStage;
  acquired_date?: string;
  headquarters: {
    city: string;
    state: string;
    region: GeographicRegion;
    address: string;
  };
  primary_region: GeographicRegion;
  primary_lob: LineOfBusiness;
  description: string;
  investment_thesis: string;
  website: string;
  contact_name: string;
  contact_role: string;
  contact_email: string;
  valuation_multiple: number; // e.g., 9.5x EBITDA
  target_enterprise_value: number; // in USD
  rating_score: number; // 0-100 roll-up attractiveness score
  key_carrier_partners: string[];
  leadership: LeadershipMember[];
  financials: FinancialYear[];
  programs?: InsuranceProgram[];
  retail_agencies?: RetailAgency[];
  tags: string[];
}

export interface SynergyOpportunity {
  id: string;
  title: string;
  description: string;
  type: 'Cross-Sell Opportunity' | 'Carrier Capacity Consolidation' | 'Geographic Expansion' | 'Operational Efficiency';
  category: 'Revenue Expansion' | 'Cost Reduction' | 'Capital Clout';
  mga_ids: string[];
  mga_names: string[];
  overlap_dimension: 'Line of Business' | 'Geographic Region' | 'Carrier Partner' | 'Retail Agency Network' | 'Operational Efficiency';
  overlap_value: string;
  estimated_annual_value: number; // USD
  potential_ebitda_impact: number; // USD
  implementation_timeline_months: number;
  status: 'Identified' | 'In Execution' | 'Captured';
  confidence_score: number; // 1-100
}

export interface SchemaField {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  foreignKeyTarget?: string;
  isRequired?: boolean;
  description: string;
  maryTranscriptNote?: string;
}

export interface SchemaEntity {
  name: string;
  tableName: string;
  description: string;
  category: 'Core Entity' | 'Financial Metrics' | 'Product / Program' | 'Distribution ("The Jakes")' | 'Synergies';
  fields: SchemaField[];
}
