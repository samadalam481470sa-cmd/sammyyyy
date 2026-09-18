const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Point the app at a throwaway database before loading it.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'newport-test-'));
process.env.DB_PATH = path.join(tmpDir, 'test.db');

const seed = require('../server/seed');
const app = require('../server/index');
const { computeEbitdaMetrics } = require('../server/metrics');

let server;
let base;

before(async () => {
  seed();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('EBITDA metrics: CAGR and YoY are computed correctly', () => {
  const series = [
    { fiscal_year: 2021, ebitda: 100 },
    { fiscal_year: 2022, ebitda: 121 },
    { fiscal_year: 2023, ebitda: 133.1 },
  ];
  const m = computeEbitdaMetrics(series);
  assert.ok(Math.abs(m.cagr - 0.1536) < 0.001, `cagr was ${m.cagr}`);
  assert.ok(Math.abs(m.yoyGrowth - 0.1) < 0.0001, `yoy was ${m.yoyGrowth}`);
  assert.strictEqual(m.latestEbitda, 133.1);
});

test('EBITDA metrics: handles empty and single-year series', () => {
  assert.deepStrictEqual(computeEbitdaMetrics([]), { latestEbitda: null, yoyGrowth: null, cagr: null });
  const m = computeEbitdaMetrics([{ fiscal_year: 2025, ebitda: 5 }]);
  assert.strictEqual(m.latestEbitda, 5);
  assert.strictEqual(m.yoyGrowth, null);
  assert.strictEqual(m.cagr, null);
});

test('GET /api/mgas returns hydrated MGAs sorted by CAGR by default', async () => {
  const res = await fetch(`${base}/api/mgas`);
  assert.strictEqual(res.status, 200);
  const mgas = await res.json();
  assert.strictEqual(mgas.length, 14);
  for (let i = 1; i < mgas.length; i++) {
    assert.ok(mgas[i - 1].metrics.ebitda_cagr >= mgas[i].metrics.ebitda_cagr, 'not sorted by CAGR desc');
  }
  const first = mgas[0];
  assert.ok(Array.isArray(first.financials) && first.financials.length > 0);
  assert.ok(Array.isArray(first.programs));
  assert.ok(Array.isArray(first.retail_agencies));
});

test('GET /api/mgas filters: status, min_years, region combine correctly', async () => {
  const res = await fetch(`${base}/api/mgas?status=pipeline&min_years=20&region=Northeast`);
  const mgas = await res.json();
  assert.ok(mgas.length > 0);
  for (const m of mgas) {
    assert.strictEqual(m.status, 'pipeline');
    assert.ok(m.years_of_experience >= 20);
    assert.ok(m.regions.includes('Northeast'));
  }
});

test('GET /api/mgas/:id returns detail with relations; 404 for missing', async () => {
  const list = await (await fetch(`${base}/api/mgas`)).json();
  const res = await fetch(`${base}/api/mgas/${list[0].id}`);
  assert.strictEqual(res.status, 200);
  const mga = await res.json();
  assert.strictEqual(mga.id, list[0].id);
  assert.ok(mga.retail_agencies.length > 0, 'expected linked retail agencies');

  const missing = await fetch(`${base}/api/mgas/99999`);
  assert.strictEqual(missing.status, 404);
});

test('POST /api/mgas creates a pipeline MGA and rejects bad input', async () => {
  const res = await fetch(`${base}/api/mgas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Underwriters LLC', years_of_experience: 12, headquarters: 'Buffalo, NY' }),
  });
  assert.strictEqual(res.status, 201);
  const created = await res.json();
  assert.strictEqual(created.status, 'pipeline');

  const bad = await fetch(`${base}/api/mgas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'No Years Inc' }),
  });
  assert.strictEqual(bad.status, 400);

  const dupe = await fetch(`${base}/api/mgas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Underwriters LLC', years_of_experience: 1 }),
  });
  assert.strictEqual(dupe.status, 409);
});

test('PATCH /api/mgas/:id/status moves an MGA onto the platform', async () => {
  const pipeline = await (await fetch(`${base}/api/mgas?status=pipeline`)).json();
  const target = pipeline.find((m) => m.name === 'Test Underwriters LLC');
  const res = await fetch(`${base}/api/mgas/${target.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'acquired' }),
  });
  assert.strictEqual(res.status, 200);
  const updated = await res.json();
  assert.strictEqual(updated.status, 'acquired');
  assert.ok(updated.acquired_date, 'acquired_date should be stamped');

  const bad = await fetch(`${base}/api/mgas/${target.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'divested' }),
  });
  assert.strictEqual(bad.status, 400);
});

test('GET /api/synergies reports overlaps shared by 2+ acquired MGAs', async () => {
  const res = await fetch(`${base}/api/synergies`);
  assert.strictEqual(res.status, 200);
  const syn = await res.json();

  assert.ok(syn.portfolio.mga_count >= 5);
  assert.ok(syn.portfolio.total_latest_ebitda > 0);

  // Seed data guarantees: Harborline + Cascade share Commercial Property;
  // BlueRidge + Gulfstream share the Southeast region.
  const cp = syn.lines_of_business.find((i) => i.value === 'Commercial Property');
  assert.ok(cp && cp.count >= 2, 'Commercial Property should be a shared line of business');
  const se = syn.regions.find((i) => i.value === 'Southeast');
  assert.ok(se && se.count >= 2, 'Southeast should be a shared region');

  for (const group of ['lines_of_business', 'coverage_types', 'regions']) {
    const items = syn[group];
    for (let i = 1; i < items.length; i++) {
      assert.ok(items[i - 1].count >= items[i].count, `${group} not sorted by count desc`);
    }
  }
});

test('GET /api/meta returns distinct filter values', async () => {
  const meta = await (await fetch(`${base}/api/meta`)).json();
  assert.ok(meta.regions.includes('Northeast'));
  assert.ok(meta.lines_of_business.includes('Marine'));
  assert.ok(meta.coverage_types.includes('Wind & Hail'));
});
