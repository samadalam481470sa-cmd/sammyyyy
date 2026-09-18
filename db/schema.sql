CREATE TYPE mga_status AS ENUM ('PIPELINE', 'PROSPECT', 'ACQUIRED', 'ON_PLATFORM');

CREATE TABLE mgas (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  years_of_experience INTEGER NOT NULL CHECK (years_of_experience >= 0),
  status mga_status NOT NULL DEFAULT 'PROSPECT',
  headquarters_city TEXT,
  geographic_region TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mga_financials (
  id UUID PRIMARY KEY,
  mga_id UUID NOT NULL REFERENCES mgas(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  historical_ebitda NUMERIC(14, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  UNIQUE (mga_id, fiscal_year)
);

CREATE TABLE insurance_programs (
  id UUID PRIMARY KEY,
  mga_id UUID NOT NULL REFERENCES mgas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  line_of_business TEXT[] NOT NULL DEFAULT '{}',
  coverage_type TEXT[] NOT NULL DEFAULT '{}',
  geographic_regions TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE retail_agencies (
  id UUID PRIMARY KEY,
  associated_mga_id UUID NOT NULL REFERENCES mgas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  state_code CHAR(2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mgas_status_region ON mgas(status, geographic_region);
CREATE INDEX idx_financials_mga_year ON mga_financials(mga_id, fiscal_year DESC);
CREATE INDEX idx_agencies_mga ON retail_agencies(associated_mga_id);

CREATE VIEW mga_growth AS
SELECT
  mga_id,
  fiscal_year,
  historical_ebitda,
  LAG(historical_ebitda) OVER (PARTITION BY mga_id ORDER BY fiscal_year) AS prior_year_ebitda,
  ROUND(
    100 * (historical_ebitda - LAG(historical_ebitda) OVER (PARTITION BY mga_id ORDER BY fiscal_year))
    / NULLIF(LAG(historical_ebitda) OVER (PARTITION BY mga_id ORDER BY fiscal_year), 0),
    2
  ) AS yoy_growth_percent
FROM mga_financials;
