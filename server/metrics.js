// Financial metric helpers shared by the API routes.

/**
 * Given [{fiscal_year, ebitda}, ...] sorted ascending, compute:
 * - latestEbitda: most recent year's EBITDA
 * - yoyGrowth: latest year vs prior year (fraction, e.g. 0.15)
 * - cagr: compound annual growth rate across the full series (fraction)
 */
function computeEbitdaMetrics(series) {
  if (!series || series.length === 0) {
    return { latestEbitda: null, yoyGrowth: null, cagr: null };
  }
  const sorted = [...series].sort((a, b) => a.fiscal_year - b.fiscal_year);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const latestEbitda = last.ebitda;

  let yoyGrowth = null;
  if (sorted.length >= 2) {
    const prev = sorted[sorted.length - 2];
    if (prev.ebitda > 0) yoyGrowth = (last.ebitda - prev.ebitda) / prev.ebitda;
  }

  let cagr = null;
  const span = last.fiscal_year - first.fiscal_year;
  if (span > 0 && first.ebitda > 0 && last.ebitda > 0) {
    cagr = Math.pow(last.ebitda / first.ebitda, 1 / span) - 1;
  }

  return { latestEbitda, yoyGrowth, cagr };
}

module.exports = { computeEbitdaMetrics };
