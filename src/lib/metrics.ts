/**
 * Derived financial metrics.
 *
 * Nothing in here is stored. Every growth figure on every screen is recomputed
 * from the `FinancialPeriod` rows, so a corrected EBITDA input immediately
 * corrects every dashboard that depends on it. The functions are pure and
 * unit-tested (src/lib/__tests__/metrics.test.ts) because these are the numbers
 * that go in front of the board.
 */

import {
  BEST_IN_CLASS_THRESHOLDS,
  type BestInClassThresholds,
} from "./taxonomy";

export type FinancialPeriodInput = {
  fiscalYear: number;
  revenueUsd: number;
  ebitdaUsd: number;
  writtenPremiumUsd: number;
  isProjected: boolean;
  isAudited: boolean;
};

export type EbitdaYearPoint = {
  fiscalYear: number;
  revenueUsd: number;
  ebitdaUsd: number;
  writtenPremiumUsd: number;
  isProjected: boolean;
  isAudited: boolean;
  /** EBITDA / revenue as a decimal, or null when revenue is non-positive. */
  ebitdaMargin: number | null;
  /** Growth vs. the previous year in the series, as a decimal. Null for the first year. */
  yoyGrowth: number | null;
};

export type EbitdaTrend = {
  series: EbitdaYearPoint[];
  firstYear: number | null;
  latestYear: number | null;
  firstEbitdaUsd: number | null;
  latestEbitdaUsd: number | null;
  latestRevenueUsd: number | null;
  latestWrittenPremiumUsd: number | null;
  latestEbitdaMargin: number | null;
  /** Compound annual growth rate across the series, as a decimal. */
  ebitdaCagr: number | null;
  /** Most recent year-over-year growth, as a decimal. */
  latestYoyGrowth: number | null;
  /** Years of history in the series. */
  yearCount: number;
  /** True when any year in the series is a management projection. */
  includesProjection: boolean;
};

/**
 * Year-over-year growth as a decimal. Uses the magnitude of the prior year so a
 * swing from a loss to a profit reads as positive growth rather than inverted.
 * Returns null when the prior year is zero and the ratio is undefined.
 */
export function yearOverYearGrowth(
  previous: number,
  current: number,
): number | null {
  if (previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

/**
 * Compound annual growth rate as a decimal.
 *
 * Undefined — and therefore null — unless the series spans at least two years
 * and starts from a positive base. A negative or zero starting EBITDA has no
 * meaningful compound rate, and quietly returning a number there is how a
 * pipeline screen ends up ranking a turnaround above a compounder.
 */
export function compoundAnnualGrowthRate(
  startValue: number,
  endValue: number,
  years: number,
): number | null {
  if (years <= 0) return null;
  if (startValue <= 0) return null;
  if (endValue <= 0) return -1;
  return Math.pow(endValue / startValue, 1 / years) - 1;
}

/**
 * Builds the full EBITDA trend for one MGA from its financial history.
 *
 * `options.includeProjections` defaults to true; set it false to compute growth
 * from actuals only, which is what the pipeline screen does when the corp-dev
 * team wants to see a target without management's forecast in the number.
 */
export function buildEbitdaTrend(
  periods: FinancialPeriodInput[],
  options: { includeProjections?: boolean } = {},
): EbitdaTrend {
  const includeProjections = options.includeProjections ?? true;

  const filtered = includeProjections
    ? periods
    : periods.filter((period) => !period.isProjected);

  const sorted = [...filtered].sort((a, b) => a.fiscalYear - b.fiscalYear);

  const series: EbitdaYearPoint[] = sorted.map((period, index) => {
    const previous = index > 0 ? sorted[index - 1] : null;
    return {
      fiscalYear: period.fiscalYear,
      revenueUsd: period.revenueUsd,
      ebitdaUsd: period.ebitdaUsd,
      writtenPremiumUsd: period.writtenPremiumUsd,
      isProjected: period.isProjected,
      isAudited: period.isAudited,
      ebitdaMargin:
        period.revenueUsd > 0 ? period.ebitdaUsd / period.revenueUsd : null,
      yoyGrowth: previous
        ? yearOverYearGrowth(previous.ebitdaUsd, period.ebitdaUsd)
        : null,
    };
  });

  if (series.length === 0) {
    return {
      series,
      firstYear: null,
      latestYear: null,
      firstEbitdaUsd: null,
      latestEbitdaUsd: null,
      latestRevenueUsd: null,
      latestWrittenPremiumUsd: null,
      latestEbitdaMargin: null,
      ebitdaCagr: null,
      latestYoyGrowth: null,
      yearCount: 0,
      includesProjection: false,
    };
  }

  const first = series[0];
  const latest = series[series.length - 1];
  const spanYears = latest.fiscalYear - first.fiscalYear;

  return {
    series,
    firstYear: first.fiscalYear,
    latestYear: latest.fiscalYear,
    firstEbitdaUsd: first.ebitdaUsd,
    latestEbitdaUsd: latest.ebitdaUsd,
    latestRevenueUsd: latest.revenueUsd,
    latestWrittenPremiumUsd: latest.writtenPremiumUsd,
    latestEbitdaMargin: latest.ebitdaMargin,
    ebitdaCagr: compoundAnnualGrowthRate(
      first.ebitdaUsd,
      latest.ebitdaUsd,
      spanYears,
    ),
    latestYoyGrowth: latest.yoyGrowth,
    yearCount: series.length,
    includesProjection: series.some((point) => point.isProjected),
  };
}

export type BestInClassInput = {
  yearsOfExperience: number;
  ebitdaCagr: number | null;
  latestEbitdaUsd: number | null;
};

export type BestInClassResult = {
  /** True only when all three thesis criteria are met. */
  isBestInClass: boolean;
  meetsExperience: boolean;
  meetsGrowth: boolean;
  meetsScale: boolean;
  /** 0-100 composite used to rank the pipeline. */
  score: number;
};

/**
 * Scores a target against Newport's stated thesis: a long-tenured operator,
 * compounding EBITDA, at enough scale to be worth a platform slot.
 *
 * The score is a weighted blend of the same three inputs, normalised so the
 * ranking is stable and explainable — growth is weighted heaviest at 50 because
 * that is the metric Mary leads with, then scale at 30 and tenure at 20.
 */
export function evaluateBestInClass(
  input: BestInClassInput,
  thresholds: BestInClassThresholds = BEST_IN_CLASS_THRESHOLDS,
): BestInClassResult {
  const meetsExperience =
    input.yearsOfExperience >= thresholds.minYearsOfExperience;
  const meetsGrowth =
    input.ebitdaCagr !== null && input.ebitdaCagr >= thresholds.minEbitdaCagr;
  const meetsScale =
    input.latestEbitdaUsd !== null &&
    input.latestEbitdaUsd >= thresholds.minLatestEbitdaUsd;

  // Each component saturates at roughly twice its threshold so one outlier
  // cannot dominate the ranking.
  const growthComponent = clamp01(
    (input.ebitdaCagr ?? 0) / (thresholds.minEbitdaCagr * 2),
  );
  const scaleComponent = clamp01(
    (input.latestEbitdaUsd ?? 0) / (thresholds.minLatestEbitdaUsd * 3),
  );
  const experienceComponent = clamp01(
    input.yearsOfExperience / (thresholds.minYearsOfExperience * 1.75),
  );

  const score =
    growthComponent * 50 + scaleComponent * 30 + experienceComponent * 20;

  return {
    isBestInClass: meetsExperience && meetsGrowth && meetsScale,
    meetsExperience,
    meetsGrowth,
    meetsScale,
    score: Math.round(score * 10) / 10,
  };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Sums EBITDA by fiscal year across many MGAs to produce the aggregate
 * platform trend, and reports how many MGAs contributed to each year so a
 * step-up caused by an acquisition is not mistaken for organic growth.
 */
export function aggregateEbitdaByYear(
  trends: { series: EbitdaYearPoint[] }[],
): {
  fiscalYear: number;
  ebitdaUsd: number;
  revenueUsd: number;
  writtenPremiumUsd: number;
  contributingMgaCount: number;
  yoyGrowth: number | null;
}[] {
  const byYear = new Map<
    number,
    {
      fiscalYear: number;
      ebitdaUsd: number;
      revenueUsd: number;
      writtenPremiumUsd: number;
      contributingMgaCount: number;
    }
  >();

  for (const trend of trends) {
    for (const point of trend.series) {
      const existing = byYear.get(point.fiscalYear);
      if (existing) {
        existing.ebitdaUsd += point.ebitdaUsd;
        existing.revenueUsd += point.revenueUsd;
        existing.writtenPremiumUsd += point.writtenPremiumUsd;
        existing.contributingMgaCount += 1;
      } else {
        byYear.set(point.fiscalYear, {
          fiscalYear: point.fiscalYear,
          ebitdaUsd: point.ebitdaUsd,
          revenueUsd: point.revenueUsd,
          writtenPremiumUsd: point.writtenPremiumUsd,
          contributingMgaCount: 1,
        });
      }
    }
  }

  const ordered = [...byYear.values()].sort(
    (a, b) => a.fiscalYear - b.fiscalYear,
  );

  return ordered.map((year, index) => ({
    ...year,
    yoyGrowth:
      index > 0
        ? yearOverYearGrowth(ordered[index - 1].ebitdaUsd, year.ebitdaUsd)
        : null,
  }));
}
