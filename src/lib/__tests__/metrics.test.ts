import { describe, expect, it } from "vitest";

import {
  aggregateEbitdaByYear,
  buildEbitdaTrend,
  compoundAnnualGrowthRate,
  evaluateBestInClass,
  type FinancialPeriodInput,
  yearOverYearGrowth,
} from "../metrics";

function period(
  fiscalYear: number,
  ebitdaUsd: number,
  overrides: Partial<FinancialPeriodInput> = {},
): FinancialPeriodInput {
  return {
    fiscalYear,
    ebitdaUsd,
    revenueUsd: ebitdaUsd * 3,
    writtenPremiumUsd: ebitdaUsd * 20,
    isProjected: false,
    isAudited: true,
    ...overrides,
  };
}

describe("yearOverYearGrowth", () => {
  it("computes a simple increase", () => {
    expect(yearOverYearGrowth(100, 125)).toBeCloseTo(0.25, 10);
  });

  it("computes a decrease as a negative rate", () => {
    expect(yearOverYearGrowth(200, 150)).toBeCloseTo(-0.25, 10);
  });

  it("reads a swing from loss to profit as positive growth", () => {
    expect(yearOverYearGrowth(-50, 25)).toBeCloseTo(1.5, 10);
  });

  it("is undefined when the prior year is zero", () => {
    expect(yearOverYearGrowth(0, 100)).toBeNull();
  });
});

describe("compoundAnnualGrowthRate", () => {
  it("returns the rate that compounds the start value into the end value", () => {
    // 100 growing at 20% for three years reaches 172.8.
    expect(compoundAnnualGrowthRate(100, 172.8, 3)).toBeCloseTo(0.2, 10);
  });

  it("returns zero for a flat series", () => {
    expect(compoundAnnualGrowthRate(500, 500, 4)).toBeCloseTo(0, 10);
  });

  it("returns a negative rate for a declining series", () => {
    const rate = compoundAnnualGrowthRate(2_600_000, 1_700_000, 4);
    expect(rate).not.toBeNull();
    expect(rate as number).toBeCloseTo(-0.1008, 3);
  });

  it("refuses to guess when the starting value is not positive", () => {
    expect(compoundAnnualGrowthRate(0, 500, 4)).toBeNull();
    expect(compoundAnnualGrowthRate(-100, 500, 4)).toBeNull();
  });

  it("refuses to guess across a zero-length span", () => {
    expect(compoundAnnualGrowthRate(100, 200, 0)).toBeNull();
  });

  it("reports total loss when the end value is not positive", () => {
    expect(compoundAnnualGrowthRate(100, 0, 3)).toBe(-1);
    expect(compoundAnnualGrowthRate(100, -25, 3)).toBe(-1);
  });
});

describe("buildEbitdaTrend", () => {
  const harborline = [
    period(2021, 4_100_000),
    period(2022, 4_600_000),
    period(2023, 5_400_000),
    period(2024, 6_300_000),
    period(2025, 7_400_000),
  ];

  it("sorts an out-of-order series by fiscal year", () => {
    const trend = buildEbitdaTrend([harborline[2], harborline[0], harborline[4]]);
    expect(trend.series.map((point) => point.fiscalYear)).toEqual([
      2021, 2023, 2025,
    ]);
  });

  it("leaves the first year without a year-over-year figure", () => {
    const trend = buildEbitdaTrend(harborline);
    expect(trend.series[0].yoyGrowth).toBeNull();
    expect(trend.series[1].yoyGrowth).toBeCloseTo(0.12195, 4);
  });

  it("computes CAGR across the span of the series, not its row count", () => {
    const trend = buildEbitdaTrend(harborline);
    // Five rows span four years, so the exponent is 1/4.
    expect(trend.ebitdaCagr).toBeCloseTo(0.159076, 5);
  });

  it("reports the latest year's headline figures", () => {
    const trend = buildEbitdaTrend(harborline);
    expect(trend.latestYear).toBe(2025);
    expect(trend.latestEbitdaUsd).toBe(7_400_000);
    expect(trend.latestYoyGrowth).toBeCloseTo(0.174603, 5);
    expect(trend.latestEbitdaMargin).toBeCloseTo(1 / 3, 10);
  });

  it("excludes management projections when asked, changing the growth rate", () => {
    const withProjection = [
      ...harborline,
      period(2026, 9_000_000, { isProjected: true, isAudited: false }),
    ];

    const included = buildEbitdaTrend(withProjection);
    const excluded = buildEbitdaTrend(withProjection, {
      includeProjections: false,
    });

    expect(included.includesProjection).toBe(true);
    expect(included.latestYear).toBe(2026);
    expect(excluded.includesProjection).toBe(false);
    expect(excluded.latestYear).toBe(2025);
    expect(excluded.ebitdaCagr).toBeCloseTo(0.159076, 5);
    expect(included.ebitdaCagr as number).toBeGreaterThan(
      excluded.ebitdaCagr as number,
    );
  });

  it("returns an empty trend rather than throwing on no history", () => {
    const trend = buildEbitdaTrend([]);
    expect(trend.series).toEqual([]);
    expect(trend.ebitdaCagr).toBeNull();
    expect(trend.latestEbitdaUsd).toBeNull();
    expect(trend.yearCount).toBe(0);
  });

  it("handles a single year of history without inventing growth", () => {
    const trend = buildEbitdaTrend([period(2025, 3_000_000)]);
    expect(trend.yearCount).toBe(1);
    expect(trend.ebitdaCagr).toBeNull();
    expect(trend.latestYoyGrowth).toBeNull();
    expect(trend.latestEbitdaUsd).toBe(3_000_000);
  });

  it("does not compute a margin when revenue is zero", () => {
    const trend = buildEbitdaTrend([period(2025, 1_000_000, { revenueUsd: 0 })]);
    expect(trend.latestEbitdaMargin).toBeNull();
  });
});

describe("evaluateBestInClass", () => {
  const thesis = {
    minYearsOfExperience: 20,
    minEbitdaCagr: 0.12,
    minLatestEbitdaUsd: 2_000_000,
  };

  it("passes a target that clears all three criteria", () => {
    const result = evaluateBestInClass(
      { yearsOfExperience: 27, ebitdaCagr: 0.243, latestEbitdaUsd: 6_200_000 },
      thesis,
    );
    expect(result).toMatchObject({
      isBestInClass: true,
      meetsExperience: true,
      meetsGrowth: true,
      meetsScale: true,
    });
  });

  it("fails a long-tenured operator whose growth is just short of thesis", () => {
    const result = evaluateBestInClass(
      { yearsOfExperience: 32, ebitdaCagr: 0.119, latestEbitdaUsd: 6_900_000 },
      thesis,
    );
    expect(result.isBestInClass).toBe(false);
    expect(result.meetsGrowth).toBe(false);
    expect(result.meetsExperience).toBe(true);
    expect(result.meetsScale).toBe(true);
  });

  it("fails a fast grower that is one year short on tenure", () => {
    const result = evaluateBestInClass(
      { yearsOfExperience: 19, ebitdaCagr: 0.308, latestEbitdaUsd: 4_100_000 },
      thesis,
    );
    expect(result.isBestInClass).toBe(false);
    expect(result.meetsExperience).toBe(false);
    expect(result.meetsGrowth).toBe(true);
  });

  it("fails a shrinking sub-scale target on both growth and scale", () => {
    const result = evaluateBestInClass(
      { yearsOfExperience: 23, ebitdaCagr: -0.101, latestEbitdaUsd: 1_700_000 },
      thesis,
    );
    expect(result.isBestInClass).toBe(false);
    expect(result.meetsGrowth).toBe(false);
    expect(result.meetsScale).toBe(false);
    expect(result.meetsExperience).toBe(true);
  });

  it("treats missing history as failing growth and scale", () => {
    const result = evaluateBestInClass(
      { yearsOfExperience: 40, ebitdaCagr: null, latestEbitdaUsd: null },
      thesis,
    );
    expect(result.isBestInClass).toBe(false);
    expect(result.meetsGrowth).toBe(false);
    expect(result.meetsScale).toBe(false);
  });

  it("scores within 0-100 and ranks a stronger target higher", () => {
    const strong = evaluateBestInClass(
      { yearsOfExperience: 30, ebitdaCagr: 0.24, latestEbitdaUsd: 7_000_000 },
      thesis,
    );
    const weak = evaluateBestInClass(
      { yearsOfExperience: 21, ebitdaCagr: 0.13, latestEbitdaUsd: 2_100_000 },
      thesis,
    );

    expect(strong.score).toBeGreaterThan(weak.score);
    for (const result of [strong, weak]) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it("saturates rather than letting one outlier dominate the score", () => {
    const outlier = evaluateBestInClass(
      { yearsOfExperience: 40, ebitdaCagr: 5, latestEbitdaUsd: 900_000_000 },
      thesis,
    );
    expect(outlier.score).toBe(100);
  });

  it("does not credit negative growth or negative scale", () => {
    const result = evaluateBestInClass(
      { yearsOfExperience: 0, ebitdaCagr: -0.5, latestEbitdaUsd: -1_000_000 },
      thesis,
    );
    expect(result.score).toBe(0);
  });
});

describe("aggregateEbitdaByYear", () => {
  it("sums overlapping years and counts contributing MGAs", () => {
    const aggregate = aggregateEbitdaByYear([
      buildEbitdaTrend([period(2024, 1_000_000), period(2025, 1_200_000)]),
      buildEbitdaTrend([period(2025, 800_000)]),
    ]);

    expect(aggregate).toHaveLength(2);
    expect(aggregate[0]).toMatchObject({
      fiscalYear: 2024,
      ebitdaUsd: 1_000_000,
      contributingMgaCount: 1,
      yoyGrowth: null,
    });
    expect(aggregate[1]).toMatchObject({
      fiscalYear: 2025,
      ebitdaUsd: 2_000_000,
      contributingMgaCount: 2,
    });
    expect(aggregate[1].yoyGrowth).toBeCloseTo(1, 10);
  });

  it("orders years ascending regardless of input order", () => {
    const aggregate = aggregateEbitdaByYear([
      buildEbitdaTrend([period(2025, 100)]),
      buildEbitdaTrend([period(2021, 100)]),
      buildEbitdaTrend([period(2023, 100)]),
    ]);
    expect(aggregate.map((year) => year.fiscalYear)).toEqual([2021, 2023, 2025]);
  });

  it("returns nothing for an empty portfolio", () => {
    expect(aggregateEbitdaByYear([])).toEqual([]);
  });
});
