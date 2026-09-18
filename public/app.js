/* Newport Specialty Partners — MGA Platform frontend */

const $ = (sel) => document.querySelector(sel);

const state = {
  view: 'pipeline',
  meta: { regions: [], lines_of_business: [], coverage_types: [] },
  synergyValues: { lob: new Set(), coverage: new Set(), region: new Set() },
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const fmtMoney = (v) =>
  v == null ? '—' : '$' + (v / 1_000_000).toFixed(1) + 'M';

const fmtPct = (v) =>
  v == null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';

const growthClass = (v) => (v == null ? '' : v >= 0 ? 'up' : 'down');

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function api(path, opts) {
  const res = await fetch(path, opts);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}

// ---------------------------------------------------------------------------
// Sparkline SVG for EBITDA time-series
// ---------------------------------------------------------------------------

function sparkline(financials) {
  if (!financials || financials.length < 2) return '';
  const w = 300, h = 42, pad = 3;
  const vals = financials.map((f) => f.ebitda);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const pts = financials.map((f, i) => {
    const x = pad + (i / (financials.length - 1)) * (w - pad * 2);
    const y = h - pad - ((f.ebitda - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `${pad},${h} ${pts.join(' ')} ${w - pad},${h}`;
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polygon class="area" points="${area}"></polygon>
    <polyline points="${pts.join(' ')}"></polyline>
  </svg>`;
}

// ---------------------------------------------------------------------------
// MGA card
// ---------------------------------------------------------------------------

function chipRow(mga, useSynergy) {
  const chips = [];
  for (const lob of mga.lines_of_business) {
    const hot = useSynergy && state.synergyValues.lob.has(lob);
    chips.push(`<span class="chip ${hot ? 'synergy' : ''}">${esc(lob)}</span>`);
  }
  for (const r of mga.regions) {
    const hot = useSynergy && state.synergyValues.region.has(r);
    chips.push(`<span class="chip ${hot ? 'synergy' : ''}">${esc(r)}</span>`);
  }
  return chips.join('');
}

function mgaCard(mga, { useSynergy = false } = {}) {
  const m = mga.metrics;
  const veteran = mga.years_of_experience >= 20;
  const statusBadge = mga.status === 'acquired'
    ? '<span class="badge badge-acquired">On Platform</span>'
    : '<span class="badge badge-pipeline">Pipeline</span>';
  const action = mga.status === 'pipeline'
    ? `<div class="card-actions"><button class="btn btn-small btn-acquire" data-id="${mga.id}">Mark acquired</button></div>`
    : '';

  return `<article class="mga-card" data-id="${mga.id}">
    <div class="mga-card-top">
      <div>
        <div class="mga-name">${esc(mga.name)}</div>
        <div class="mga-hq">${esc(mga.headquarters || '')}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;">
        ${statusBadge}
        ${veteran ? `<span class="badge badge-veteran">${mga.years_of_experience} yrs</span>` : `<span class="badge">${mga.years_of_experience} yrs</span>`}
      </div>
    </div>
    ${sparkline(mga.financials)}
    <div class="stat-row">
      <div class="stat"><div class="label">EBITDA (latest)</div><div class="value">${fmtMoney(m.latest_ebitda)}</div></div>
      <div class="stat"><div class="label">CAGR</div><div class="value ${growthClass(m.ebitda_cagr)}">${fmtPct(m.ebitda_cagr)}</div></div>
      <div class="stat"><div class="label">YoY</div><div class="value ${growthClass(m.yoy_ebitda_growth)}">${fmtPct(m.yoy_ebitda_growth)}</div></div>
    </div>
    <div class="tag-row">${chipRow(mga, useSynergy)}</div>
    ${action}
  </article>`;
}

// ---------------------------------------------------------------------------
// Pipeline view
// ---------------------------------------------------------------------------

async function renderPipeline() {
  const params = new URLSearchParams({ status: 'pipeline' });
  if ($('#filter-veterans').checked) params.set('min_years', '20');
  const region = $('#filter-region').value;
  const lob = $('#filter-lob').value;
  if (region) params.set('region', region);
  if (lob) params.set('lob', lob);
  params.set('sort', $('#sort-by').value);

  const mgas = await api('/api/mgas?' + params);
  const list = $('#pipeline-list');
  list.innerHTML = mgas.length
    ? mgas.map((m) => mgaCard(m)).join('')
    : '<div class="empty-state">No pipeline MGAs match these filters.</div>';
}

// ---------------------------------------------------------------------------
// Portfolio view
// ---------------------------------------------------------------------------

function synergyGroup(title, items) {
  const rows = items.map((item) => {
    const hot = item.count >= 2;
    const who = item.mgas.map((m) => m.name).join(' · ');
    return `<div class="synergy-item ${hot ? 'hot' : ''}">
      <div><strong>${esc(item.value)}</strong><span class="who">${esc(who)}</span></div>
      <span class="count">×${item.count}</span>
    </div>`;
  }).join('');
  return `<div class="synergy-group"><h4>${esc(title)}</h4>${rows || '<p class="muted small">None yet.</p>'}</div>`;
}

async function renderPortfolio() {
  const [mgas, synergies] = await Promise.all([
    api('/api/mgas?status=acquired&sort=ebitda'),
    api('/api/synergies'),
  ]);

  // Record which values are shared, so cards can glow the matching chips.
  state.synergyValues.lob = new Set(synergies.lines_of_business.filter((i) => i.count >= 2).map((i) => i.value));
  state.synergyValues.coverage = new Set(synergies.coverage_types.filter((i) => i.count >= 2).map((i) => i.value));
  state.synergyValues.region = new Set(synergies.regions.filter((i) => i.count >= 2).map((i) => i.value));

  const p = synergies.portfolio;
  $('#portfolio-kpis').innerHTML = `
    <div class="kpi"><div class="label">MGAs on platform</div><div class="value">${p.mga_count}</div></div>
    <div class="kpi"><div class="label">Aggregate EBITDA (latest FY)</div><div class="value">${fmtMoney(p.total_latest_ebitda)}</div></div>
    <div class="kpi"><div class="label">Retail agencies managed</div><div class="value">${p.retail_agency_count}</div></div>
  `;

  $('#portfolio-list').innerHTML = mgas.length
    ? mgas.map((m) => mgaCard(m, { useSynergy: true })).join('')
    : '<div class="empty-state">No acquisitions closed yet.</div>';

  $('#synergy-groups').innerHTML =
    synergyGroup('Lines of Business', synergies.lines_of_business) +
    synergyGroup('Coverage Types', synergies.coverage_types) +
    synergyGroup('Geographic Regions', synergies.regions);
}

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------

async function openDrawer(id) {
  const mga = await api('/api/mgas/' + id);
  const m = mga.metrics;

  const maxEbitda = Math.max(...mga.financials.map((f) => f.ebitda), 1);
  const bars = mga.financials.map((f) =>
    `<div class="bar" style="height:${Math.max((f.ebitda / maxEbitda) * 100, 4)}%" title="${f.fiscal_year}: ${fmtMoney(f.ebitda)}"><span>${f.fiscal_year}</span></div>`
  ).join('');

  const finRows = mga.financials.map((f, i) => {
    const prev = mga.financials[i - 1];
    const growth = prev && prev.ebitda > 0 ? (f.ebitda - prev.ebitda) / prev.ebitda : null;
    return `<tr><td>${f.fiscal_year}</td><td class="num">${fmtMoney(f.ebitda)}</td>
      <td class="num ${growth == null ? '' : growth >= 0 ? 'growth-pos' : 'growth-neg'}">${fmtPct(growth)}</td></tr>`;
  }).join('');

  const progRows = mga.programs.map((pr) =>
    `<tr><td>${esc(pr.name)}</td><td>${esc(pr.line_of_business)}</td><td>${esc(pr.coverage_type)}</td><td>${esc(pr.geographic_region)}</td></tr>`
  ).join('');

  const agencyRows = mga.retail_agencies.map((a) =>
    `<tr><td>${esc(a.name)}</td><td>${esc(a.principal || '—')}</td><td>${esc(a.state || '—')}</td><td class="num">${fmtMoney(a.annual_premium)}</td></tr>`
  ).join('');

  $('#drawer').innerHTML = `
    <div class="drawer-head">
      <div>
        <h3>${esc(mga.name)}</h3>
        <p class="muted">${esc(mga.headquarters || '')} · ${mga.years_of_experience} years in market
          ${mga.acquired_date ? ' · acquired ' + esc(mga.acquired_date) : ''}</p>
      </div>
      <button class="close" id="btn-close-drawer" aria-label="Close">×</button>
    </div>
    ${mga.notes ? `<p class="muted small">${esc(mga.notes)}</p>` : ''}
    <section>
      <h4 class="section-label">Historical EBITDA</h4>
      <div class="bar-chart-wrap"><div class="bar-chart">${bars}</div></div>
      <table>
        <thead><tr><th>Fiscal year</th><th class="num">EBITDA</th><th class="num">YoY growth</th></tr></thead>
        <tbody>${finRows}</tbody>
      </table>
      <p class="muted small" style="margin-top:8px">CAGR ${fmtPct(m.ebitda_cagr)} · Latest YoY ${fmtPct(m.yoy_ebitda_growth)}</p>
    </section>
    <section>
      <h4 class="section-label">Insurance Programs (${mga.programs.length})</h4>
      <table>
        <thead><tr><th>Program</th><th>Line of business</th><th>Coverage</th><th>Region</th></tr></thead>
        <tbody>${progRows}</tbody>
      </table>
    </section>
    <section>
      <h4 class="section-label">Retail Agencies — "The Jakes" (${mga.retail_agencies.length})</h4>
      <table>
        <thead><tr><th>Agency</th><th>Principal</th><th>State</th><th class="num">Annual premium</th></tr></thead>
        <tbody>${agencyRows}</tbody>
      </table>
    </section>
  `;
  $('#drawer').classList.remove('hidden');
  $('#drawer-backdrop').classList.remove('hidden');
  $('#btn-close-drawer').addEventListener('click', closeDrawer);
}

function closeDrawer() {
  $('#drawer').classList.add('hidden');
  $('#drawer-backdrop').classList.add('hidden');
}

// ---------------------------------------------------------------------------
// Add MGA modal
// ---------------------------------------------------------------------------

function openAddModal() {
  $('#add-form').reset();
  $('#add-error').classList.add('hidden');
  $('#add-modal').classList.remove('hidden');
  $('#modal-backdrop').classList.remove('hidden');
}

function closeAddModal() {
  $('#add-modal').classList.add('hidden');
  $('#modal-backdrop').classList.add('hidden');
}

// ---------------------------------------------------------------------------
// View switching + events
// ---------------------------------------------------------------------------

function switchView(view) {
  state.view = view;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  $('#view-pipeline').classList.toggle('hidden', view !== 'pipeline');
  $('#view-portfolio').classList.toggle('hidden', view !== 'portfolio');
  refresh();
}

function refresh() {
  return state.view === 'pipeline' ? renderPipeline() : renderPortfolio();
}

async function init() {
  state.meta = await api('/api/meta');
  for (const r of state.meta.regions) {
    $('#filter-region').insertAdjacentHTML('beforeend', `<option value="${esc(r)}">${esc(r)}</option>`);
  }
  for (const l of state.meta.lines_of_business) {
    $('#filter-lob').insertAdjacentHTML('beforeend', `<option value="${esc(l)}">${esc(l)}</option>`);
  }

  document.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => switchView(t.dataset.view)));

  ['#filter-veterans', '#filter-region', '#filter-lob', '#sort-by'].forEach((sel) =>
    $(sel).addEventListener('change', renderPipeline));

  document.body.addEventListener('click', async (e) => {
    const acquireBtn = e.target.closest('.btn-acquire');
    if (acquireBtn) {
      e.stopPropagation();
      await api(`/api/mgas/${acquireBtn.dataset.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'acquired' }),
      });
      refresh();
      return;
    }
    const card = e.target.closest('.mga-card');
    if (card) openDrawer(card.dataset.id);
  });

  $('#drawer-backdrop').addEventListener('click', closeDrawer);
  $('#btn-add-mga').addEventListener('click', openAddModal);
  $('#btn-cancel-add').addEventListener('click', closeAddModal);
  $('#modal-backdrop').addEventListener('click', closeAddModal);

  $('#add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api('/api/mgas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      closeAddModal();
      switchView('pipeline');
    } catch (err) {
      const el = $('#add-error');
      el.textContent = err.message;
      el.classList.remove('hidden');
    }
  });

  refresh();
}

init();
