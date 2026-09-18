const path = require('path');
const express = require('express');
const db = require('./db');
const { computeEbitdaMetrics } = require('./metrics');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

const getFinancials = db.prepare(
  'SELECT fiscal_year, ebitda FROM mga_financials WHERE mga_id = ? ORDER BY fiscal_year'
);
const getPrograms = db.prepare(
  'SELECT id, name, line_of_business, coverage_type, geographic_region FROM insurance_programs WHERE mga_id = ? ORDER BY name'
);
const getAgencies = db.prepare(
  'SELECT id, name, principal, state, annual_premium FROM retail_agencies WHERE mga_id = ? ORDER BY name'
);

function hydrateMga(row) {
  const financials = getFinancials.all(row.id);
  const programs = getPrograms.all(row.id);
  const agencies = getAgencies.all(row.id);
  const metrics = computeEbitdaMetrics(financials);
  return {
    ...row,
    financials,
    programs,
    retail_agencies: agencies,
    metrics: {
      latest_ebitda: metrics.latestEbitda,
      yoy_ebitda_growth: metrics.yoyGrowth,
      ebitda_cagr: metrics.cagr,
    },
    lines_of_business: [...new Set(programs.map((p) => p.line_of_business))],
    coverage_types: [...new Set(programs.map((p) => p.coverage_type))],
    regions: [...new Set(programs.map((p) => p.geographic_region))],
  };
}

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

// Distinct filter values for dropdowns.
app.get('/api/meta', (req, res) => {
  res.json({
    regions: db.prepare('SELECT DISTINCT geographic_region v FROM insurance_programs ORDER BY v').all().map((r) => r.v),
    lines_of_business: db.prepare('SELECT DISTINCT line_of_business v FROM insurance_programs ORDER BY v').all().map((r) => r.v),
    coverage_types: db.prepare('SELECT DISTINCT coverage_type v FROM insurance_programs ORDER BY v').all().map((r) => r.v),
  });
});

// List MGAs with computed growth metrics. Supports filtering and sorting.
// Query params: status, region, lob, min_years, sort (cagr|yoy|ebitda|years|name)
app.get('/api/mgas', (req, res) => {
  const { status, region, lob, min_years: minYears, sort } = req.query;

  let rows = db.prepare('SELECT * FROM mgas').all();
  if (status) rows = rows.filter((r) => r.status === status);

  let mgas = rows.map(hydrateMga);
  if (region) mgas = mgas.filter((m) => m.regions.includes(region));
  if (lob) mgas = mgas.filter((m) => m.lines_of_business.includes(lob));
  if (minYears) mgas = mgas.filter((m) => m.years_of_experience >= Number(minYears));

  const sorters = {
    cagr: (a, b) => (b.metrics.ebitda_cagr ?? -Infinity) - (a.metrics.ebitda_cagr ?? -Infinity),
    yoy: (a, b) => (b.metrics.yoy_ebitda_growth ?? -Infinity) - (a.metrics.yoy_ebitda_growth ?? -Infinity),
    ebitda: (a, b) => (b.metrics.latest_ebitda ?? -Infinity) - (a.metrics.latest_ebitda ?? -Infinity),
    years: (a, b) => b.years_of_experience - a.years_of_experience,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  mgas.sort(sorters[sort] || sorters.cagr);

  res.json(mgas);
});

app.get('/api/mgas/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM mgas WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'MGA not found' });
  res.json(hydrateMga(row));
});

// Create a new MGA (pipeline intake).
app.post('/api/mgas', (req, res) => {
  const { name, status = 'pipeline', years_of_experience, headquarters, principal_contact, notes } = req.body || {};
  if (!name || years_of_experience == null) {
    return res.status(400).json({ error: 'name and years_of_experience are required' });
  }
  if (!['pipeline', 'acquired'].includes(status)) {
    return res.status(400).json({ error: "status must be 'pipeline' or 'acquired'" });
  }
  try {
    const { lastInsertRowid } = db.prepare(
      `INSERT INTO mgas (name, status, years_of_experience, headquarters, principal_contact, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(name, status, Number(years_of_experience), headquarters || null, principal_contact || null, notes || null);
    res.status(201).json(hydrateMga(db.prepare('SELECT * FROM mgas WHERE id = ?').get(lastInsertRowid)));
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'An MGA with that name already exists' });
    }
    throw err;
  }
});

// Update status — the "close the deal" action that moves a target onto the platform.
app.patch('/api/mgas/:id/status', (req, res) => {
  const { status } = req.body || {};
  if (!['pipeline', 'acquired'].includes(status)) {
    return res.status(400).json({ error: "status must be 'pipeline' or 'acquired'" });
  }
  const acquiredDate = status === 'acquired' ? new Date().toISOString().slice(0, 10) : null;
  const info = db.prepare('UPDATE mgas SET status = ?, acquired_date = ? WHERE id = ?')
    .run(status, acquiredDate, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'MGA not found' });
  res.json(hydrateMga(db.prepare('SELECT * FROM mgas WHERE id = ?').get(req.params.id)));
});

// Synergy analysis across the acquired portfolio: for each dimension
// (line of business, coverage type, region), find values shared by 2+ MGAs.
app.get('/api/synergies', (req, res) => {
  const acquired = db.prepare("SELECT * FROM mgas WHERE status = 'acquired'").all().map(hydrateMga);

  function overlaps(dimension) {
    const byValue = new Map();
    for (const mga of acquired) {
      for (const value of mga[dimension]) {
        if (!byValue.has(value)) byValue.set(value, []);
        byValue.get(value).push({ id: mga.id, name: mga.name });
      }
    }
    return [...byValue.entries()]
      .map(([value, mgas]) => ({ value, mgas, count: mgas.length }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }

  const totalEbitda = acquired.reduce((sum, m) => sum + (m.metrics.latest_ebitda || 0), 0);
  const totalAgencies = acquired.reduce((sum, m) => sum + m.retail_agencies.length, 0);

  res.json({
    portfolio: {
      mga_count: acquired.length,
      total_latest_ebitda: totalEbitda,
      retail_agency_count: totalAgencies,
    },
    lines_of_business: overlaps('lines_of_business'),
    coverage_types: overlaps('coverage_types'),
    regions: overlaps('regions'),
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Newport MGA CRM running at http://localhost:${PORT}`);
  });
}

module.exports = app;
