-- Newport Specialty Partners CRM — PostgreSQL MVP schema

CREATE TYPE mga_status AS ENUM ('prospect', 'acquired');
CREATE TYPE pipeline_stage AS ENUM (
  'initial_review',
  'management_meeting',
  'diligence',
  'investment_committee',
  'on_platform',
  'passed'
);

CREATE TABLE mga (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  status mga_status NOT NULL DEFAULT 'prospect',
  pipeline_stage pipeline_stage NOT NULL DEFAULT 'initial_review',
  founded_year SMALLINT CHECK (founded_year BETWEEN 1800 AND EXTRACT(YEAR FROM CURRENT_DATE)),
  years_of_experience SMALLINT NOT NULL CHECK (years_of_experience >= 0),
  headquarters_city TEXT,
  headquarters_state CHAR(2),
  website TEXT,
  acquisition_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status = 'acquired' AND pipeline_stage = 'on_platform')
    OR status = 'prospect'
  )
);

CREATE TABLE mga_financial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mga_id UUID NOT NULL REFERENCES mga(id) ON DELETE CASCADE,
  fiscal_year SMALLINT NOT NULL CHECK (fiscal_year BETWEEN 1900 AND 2200),
  revenue NUMERIC(14, 2),
  ebitda NUMERIC(14, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  source_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mga_id, fiscal_year)
);

CREATE TABLE insurance_program (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mga_id UUID NOT NULL REFERENCES mga(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE line_of_business (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE coverage_type (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE geographic_region (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE program_line_of_business (
  program_id UUID NOT NULL REFERENCES insurance_program(id) ON DELETE CASCADE,
  line_of_business_id UUID NOT NULL REFERENCES line_of_business(id),
  PRIMARY KEY (program_id, line_of_business_id)
);

CREATE TABLE program_coverage (
  program_id UUID NOT NULL REFERENCES insurance_program(id) ON DELETE CASCADE,
  coverage_type_id UUID NOT NULL REFERENCES coverage_type(id),
  PRIMARY KEY (program_id, coverage_type_id)
);

CREATE TABLE program_region (
  program_id UUID NOT NULL REFERENCES insurance_program(id) ON DELETE CASCADE,
  geographic_region_id UUID NOT NULL REFERENCES geographic_region(id),
  PRIMARY KEY (program_id, geographic_region_id)
);

CREATE TABLE retail_agency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associated_mga_id UUID NOT NULL REFERENCES mga(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  city TEXT,
  state CHAR(2),
  contact_name TEXT,
  contact_email TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mga_status_stage ON mga(status, pipeline_stage);
CREATE INDEX idx_financial_mga_year ON mga_financial(mga_id, fiscal_year DESC);
CREATE INDEX idx_program_mga ON insurance_program(mga_id);
CREATE INDEX idx_retail_agency_mga ON retail_agency(associated_mga_id);

-- Reusable analytics view for pipeline sorting and portfolio dashboards.
CREATE VIEW mga_performance AS
WITH ranked AS (
  SELECT
    mga_id,
    fiscal_year,
    ebitda,
    LAG(ebitda) OVER (PARTITION BY mga_id ORDER BY fiscal_year) AS prior_ebitda,
    ROW_NUMBER() OVER (PARTITION BY mga_id ORDER BY fiscal_year DESC) AS recency_rank
  FROM mga_financial
)
SELECT
  m.id,
  m.name,
  m.status,
  m.pipeline_stage,
  m.years_of_experience,
  r.fiscal_year,
  r.ebitda,
  ROUND(((r.ebitda - r.prior_ebitda) / NULLIF(r.prior_ebitda, 0)) * 100, 1) AS yoy_ebitda_growth_pct
FROM mga m
LEFT JOIN ranked r ON r.mga_id = m.id AND r.recency_rank = 1;
