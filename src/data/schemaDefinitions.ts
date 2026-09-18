import { SchemaEntity } from '../types';

export const sqlSchemaDDL = `-- =======================================================================
-- Newport Specialty Partners (Lovell Minnick Portfolio)
-- Core Database Architecture Schema
-- Designed for Managing General Agent (MGA) Roll-Up & Synergy Aggregation
-- =======================================================================

-- 1. Managing General Agents (Core Account Entity)
CREATE TABLE managing_general_agents (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    founded_year INT NOT NULL,
    years_of_experience INT NOT NULL CHECK (years_of_experience >= 0), -- Mary requirement: target 20-30+ years
    status VARCHAR(50) NOT NULL CHECK (status IN ('Pipeline', 'Acquired')),
    pipeline_stage VARCHAR(50) DEFAULT 'Initial Screening' CHECK (
        pipeline_stage IN ('Initial Screening', 'Due Diligence', 'LOI Signed', 'Deal Closing', 'On-Platform')
    ),
    acquired_date DATE NULL,
    headquarters_city VARCHAR(100) NOT NULL,
    headquarters_state VARCHAR(50) NOT NULL,
    primary_region VARCHAR(50) NOT NULL CHECK (
        primary_region IN ('Northeast', 'Southeast', 'Midwest', 'West / Pacific', 'Southwest', 'National')
    ),
    primary_lob VARCHAR(100) NOT NULL,
    description TEXT,
    investment_thesis TEXT,
    website VARCHAR(255),
    contact_name VARCHAR(150),
    contact_role VARCHAR(100),
    contact_email VARCHAR(255),
    valuation_multiple DECIMAL(5, 2) DEFAULT 10.0,
    target_enterprise_value DECIMAL(15, 2),
    rating_score INT DEFAULT 85 CHECK (rating_score BETWEEN 0 AND 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. MGA Financials (Historical EBITDA & Time-Series Growth)
CREATE TABLE mga_financials (
    id VARCHAR(36) PRIMARY KEY,
    mga_id VARCHAR(36) NOT NULL REFERENCES managing_general_agents(id) ON DELETE CASCADE,
    fiscal_year INT NOT NULL,
    historical_ebitda DECIMAL(15, 2) NOT NULL, -- Mary requirement: Earnings before interest, bad debt & taxes
    gross_written_premium DECIMAL(15, 2) NOT NULL, -- GWP volume
    revenue DECIMAL(15, 2) NOT NULL, -- Commission & fee revenue
    ebitda_margin_pct DECIMAL(5, 2) NOT NULL,
    yoy_ebitda_growth_pct DECIMAL(6, 2) NOT NULL, -- Calculated YoY growth
    loss_ratio_pct DECIMAL(5, 2) NOT NULL,
    bad_debt_loss_rate DECIMAL(4, 2) DEFAULT 0.20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_mga_fiscal_year UNIQUE (mga_id, fiscal_year)
);

-- 3. Insurance Programs (Underwriting Facilities & Coverages)
CREATE TABLE insurance_programs (
    id VARCHAR(36) PRIMARY KEY,
    mga_id VARCHAR(36) NOT NULL REFERENCES managing_general_agents(id) ON DELETE CASCADE,
    program_name VARCHAR(255) NOT NULL,
    line_of_business VARCHAR(100) NOT NULL, -- Mary requirement: String/Tag
    coverage_type VARCHAR(100) NOT NULL,    -- Mary requirement: String/Tag
    geographic_region VARCHAR(50) NOT NULL, -- Mary requirement: String/Tag
    carrier_partner VARCHAR(255) NOT NULL,  -- e.g. Munich Re, Lloyd's, Travelers
    carrier_rating VARCHAR(50) DEFAULT 'A (Excellent)',
    annual_gwp DECIMAL(15, 2) NOT NULL,
    average_commission_rate DECIMAL(5, 2) NOT NULL,
    underwriting_authority_limit DECIMAL(15, 2) NOT NULL,
    target_industry VARCHAR(255),
    active_policies INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Retail Agencies ("The Jakes" - Independent Distribution Network)
CREATE TABLE retail_agencies (
    id VARCHAR(36) PRIMARY KEY,
    associated_mga_id VARCHAR(36) NOT NULL REFERENCES managing_general_agents(id) ON DELETE CASCADE, -- Mary requirement: FK to MGA
    agency_name VARCHAR(255) NOT NULL,
    principal_agent VARCHAR(150) NOT NULL, -- The "Jake" contact
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    region VARCHAR(50) NOT NULL,
    annual_placed_premium DECIMAL(15, 2) NOT NULL,
    active_policies_count INT NOT NULL DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'Gold' CHECK (tier IN ('Platinum', 'Gold', 'Silver', 'Bronze')),
    primary_lines_placed TEXT[], -- Array or JSON of lines placed
    years_partnered INT DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Portfolio Synergies & Cross-Selling Matrix
CREATE TABLE portfolio_synergies (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    synergy_type VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Revenue Expansion', 'Cost Reduction', 'Capital Clout')),
    overlap_dimension VARCHAR(50) NOT NULL CHECK (
        overlap_dimension IN ('Line of Business', 'Geographic Region', 'Carrier Partner', 'Retail Agency Network', 'Operational Efficiency')
    ),
    overlap_value VARCHAR(255) NOT NULL,
    estimated_annual_value DECIMAL(15, 2) NOT NULL,
    potential_ebitda_impact DECIMAL(15, 2) NOT NULL,
    implementation_timeline_months INT DEFAULT 6,
    status VARCHAR(50) DEFAULT 'Identified' CHECK (status IN ('Identified', 'In Execution', 'Captured')),
    confidence_score INT DEFAULT 85 CHECK (confidence_score BETWEEN 0 AND 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for Best-in-Class high-speed filtering (Mary's corporate dev team)
CREATE INDEX idx_mga_years_exp ON managing_general_agents(years_of_experience);
CREATE INDEX idx_mga_status ON managing_general_agents(status);
CREATE INDEX idx_mga_region ON managing_general_agents(primary_region);
CREATE INDEX idx_mga_lob ON managing_general_agents(primary_lob);
CREATE INDEX idx_financials_ebitda_growth ON mga_financials(yoy_ebitda_growth_pct);
CREATE INDEX idx_programs_lob_region ON insurance_programs(line_of_business, geographic_region);
CREATE INDEX idx_retail_agencies_mga ON retail_agencies(associated_mga_id);
`;

export const schemaEntities: SchemaEntity[] = [
  {
    name: 'MGA (Managing General Agent)',
    tableName: 'managing_general_agents',
    description: 'The primary entity in the CRM platform representing specialty underwriting agencies targeted for acquisition or onboarded to the roll-up platform.',
    category: 'Core Entity',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', isPrimaryKey: true, isRequired: true, description: 'Unique identifier (UUID)' },
      { name: 'name', type: 'VARCHAR(255)', isRequired: true, description: 'Display name of the MGA' },
      { name: 'years_of_experience', type: 'INTEGER', isRequired: true, description: 'Track record in years. Targeting 20-30+ years as required by Mary.', maryTranscriptNote: 'Directly fulfills requirement: Years_of_Experience (Integer) targeting 20-30+ years.' },
      { name: 'status', type: "ENUM('Pipeline', 'Acquired')", isRequired: true, description: 'Pipeline vs Acquired on-platform status.', maryTranscriptNote: 'Directly fulfills requirement: Status (Enum) Pipeline/Prospect vs Acquired/On-Platform.' },
      { name: 'pipeline_stage', type: 'VARCHAR(50)', isRequired: false, description: 'Current M&A funnel stage (Initial Screening, Due Diligence, LOI Signed, Deal Closing, On-Platform).' },
      { name: 'primary_region', type: 'VARCHAR(50)', isRequired: true, description: 'Geographic base of operations (Northeast, Southeast, Midwest, West/Pacific, Southwest, National).' },
      { name: 'primary_lob', type: 'VARCHAR(100)', isRequired: true, description: 'Core specialty line of business (e.g. Specialty Casualty, Marine, Cat Property, Cyber).' },
      { name: 'valuation_multiple', type: 'DECIMAL(5,2)', description: 'Target acquisition valuation multiple (EV / EBITDA).' },
      { name: 'target_enterprise_value', type: 'DECIMAL(15,2)', description: 'Target Enterprise Value in USD.' },
    ],
  },
  {
    name: 'MGA Financials',
    tableName: 'mga_financials',
    description: 'Historical time-series financial data used by Lovell Minnick and the deal team to calculate and visualize YoY EBITDA growth, revenue margins, and loss ratios.',
    category: 'Financial Metrics',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', isPrimaryKey: true, isRequired: true, description: 'Unique record ID' },
      { name: 'mga_id', type: 'VARCHAR(36)', isForeignKey: true, foreignKeyTarget: 'managing_general_agents.id', isRequired: true, description: 'Foreign Key linking to parent MGA' },
      { name: 'fiscal_year', type: 'INTEGER', isRequired: true, description: 'Financial reporting year (e.g. 2021-2025)' },
      { name: 'historical_ebitda', type: 'DECIMAL(15,2)', isRequired: true, description: 'Earnings before interest, bad debt, and taxes. Powers time-series growth charts.', maryTranscriptNote: 'Directly fulfills requirement: Historical_EBITDA (Time-series data). Calculates and visualizes YoY growth.' },
      { name: 'gross_written_premium', type: 'DECIMAL(15,2)', isRequired: true, description: 'Total gross written premium (GWP) volume placed.' },
      { name: 'revenue', type: 'DECIMAL(15,2)', isRequired: true, description: 'Net agency commissions and management fee revenue.' },
      { name: 'ebitda_margin_pct', type: 'DECIMAL(5,2)', isRequired: true, description: 'EBITDA Margin percentage (EBITDA / Revenue).' },
      { name: 'yoy_ebitda_growth_pct', type: 'DECIMAL(6,2)', isRequired: true, description: 'Year-over-Year EBITDA percentage growth rate.' },
    ],
  },
  {
    name: 'Insurance Programs',
    tableName: 'insurance_programs',
    description: 'Specialized insurance programs underwritten by each MGA with specific coverage types, regional scope, and capacity provider carriers.',
    category: 'Product / Program',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', isPrimaryKey: true, isRequired: true, description: 'Unique program ID' },
      { name: 'mga_id', type: 'VARCHAR(36)', isForeignKey: true, foreignKeyTarget: 'managing_general_agents.id', isRequired: true, description: 'Foreign key to parent MGA' },
      { name: 'program_name', type: 'VARCHAR(255)', isRequired: true, description: 'Branded program name' },
      { name: 'line_of_business', type: 'VARCHAR(100)', isRequired: true, description: 'Line of business category tag.', maryTranscriptNote: 'Directly fulfills requirement: Line_of_Business (String/Tag).' },
      { name: 'coverage_type', type: 'VARCHAR(100)', isRequired: true, description: 'Specific coverage structure tag.', maryTranscriptNote: 'Directly fulfills requirement: Coverage_Type (String/Tag).' },
      { name: 'geographic_region', type: 'VARCHAR(50)', isRequired: true, description: 'Geographic territory tag.', maryTranscriptNote: 'Directly fulfills requirement: Geographic_Region (String/Tag).' },
      { name: 'carrier_partner', type: 'VARCHAR(255)', isRequired: true, description: 'Delegated carrier / capacity provider (Munich Re, Lloyd’s, Travelers, etc.)' },
      { name: 'annual_gwp', type: 'DECIMAL(15,2)', isRequired: true, description: 'Annual GWP written under this specific facility.' },
    ],
  },
  {
    name: 'Retail Agencies ("The Jakes")',
    tableName: 'retail_agencies',
    description: 'The independent, unrelated retail broker entities managed and distributed through the MGAs.',
    category: 'Distribution ("The Jakes")',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', isPrimaryKey: true, isRequired: true, description: 'Unique agency ID' },
      { name: 'associated_mga_id', type: 'VARCHAR(36)', isForeignKey: true, foreignKeyTarget: 'managing_general_agents.id', isRequired: true, description: 'Foreign Key linking back to parent MGA.', maryTranscriptNote: 'Directly fulfills requirement: Associated_MGA (Foreign Key linking back to MGA).' },
      { name: 'agency_name', type: 'VARCHAR(255)', isRequired: true, description: 'Retail agency company name' },
      { name: 'principal_agent', type: 'VARCHAR(150)', isRequired: true, description: 'The independent producer ("Jake")' },
      { name: 'city / state / region', type: 'VARCHAR', isRequired: true, description: 'Location of the retail brokerage office' },
      { name: 'annual_placed_premium', type: 'DECIMAL(15,2)', isRequired: true, description: 'Volume of premium placed with the MGA' },
      { name: 'active_policies_count', type: 'INTEGER', isRequired: true, description: 'Total active policies managed' },
      { name: 'tier', type: "ENUM('Platinum', 'Gold', 'Silver')", isRequired: true, description: 'Relationship volume tier' },
    ],
  },
  {
    name: 'Portfolio Synergies',
    tableName: 'portfolio_synergies',
    description: 'Synergies identified across the aggregated portfolio (carrier capacity consolidation, cross-sell into "The Jakes" retail networks, regional expansions, and tech consolidation).',
    category: 'Synergies',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', isPrimaryKey: true, isRequired: true, description: 'Synergy ID' },
      { name: 'title', type: 'VARCHAR(255)', isRequired: true, description: 'Synergy initiative title' },
      { name: 'overlap_dimension', type: 'VARCHAR(50)', isRequired: true, description: 'Dimension of overlap (Carrier, LOB, Geography, Retail Network).' },
      { name: 'estimated_annual_value', type: 'DECIMAL(15,2)', isRequired: true, description: 'Estimated annual EBITDA or cost saving benefit in USD' },
      { name: 'status', type: 'VARCHAR(50)', isRequired: true, description: 'Execution status (Identified, In Execution, Captured)' },
    ],
  },
];
