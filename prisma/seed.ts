/**
 * Loads the demo dataset. Safe to re-run: every table is cleared first, so
 * `npm run db:seed` always produces exactly the same database.
 */

import { PrismaClient } from "../src/generated/prisma";
import {
  AUDITED_THROUGH_YEAR,
  FIRST_FISCAL_YEAR,
  MGA_SEEDS,
  PROJECTION_FISCAL_YEAR,
  type MgaSeed,
} from "./seed-data";

const prisma = new PrismaClient();

const MILLION = 1_000_000;

/** Bad debt written off as a share of revenue — the add-back in Mary's EBITDA. */
const BAD_DEBT_RATE = 0.006;

function roundToDollars(value: number): number {
  return Math.round(value);
}

type FinancialRow = {
  fiscalYear: number;
  revenueUsd: number;
  ebitdaUsd: number;
  badDebtAddbackUsd: number;
  writtenPremiumUsd: number;
  isAudited: boolean;
  isProjected: boolean;
};

/**
 * Expands a declared EBITDA series into full financial rows. Revenue is implied
 * by the MGA's margin and written premium by its commission rate, which keeps
 * the three figures consistent with each other on every screen.
 */
function buildFinancialRows(seed: MgaSeed): FinancialRow[] {
  const actuals = seed.ebitdaMillionsByYear.map((ebitdaMillions, index) => {
    const fiscalYear = FIRST_FISCAL_YEAR + index;
    const ebitdaUsd = ebitdaMillions * MILLION;
    const revenueUsd = ebitdaUsd / seed.ebitdaMargin;
    return {
      fiscalYear,
      revenueUsd: roundToDollars(revenueUsd),
      ebitdaUsd: roundToDollars(ebitdaUsd),
      badDebtAddbackUsd: roundToDollars(revenueUsd * BAD_DEBT_RATE),
      writtenPremiumUsd: roundToDollars(revenueUsd / seed.commissionRate),
      isAudited: fiscalYear <= AUDITED_THROUGH_YEAR,
      isProjected: false,
    };
  });

  if (seed.projectedEbitdaMillions === undefined) {
    return actuals;
  }

  const projectedEbitdaUsd = seed.projectedEbitdaMillions * MILLION;
  const projectedRevenueUsd = projectedEbitdaUsd / seed.ebitdaMargin;

  return [
    ...actuals,
    {
      fiscalYear: PROJECTION_FISCAL_YEAR,
      revenueUsd: roundToDollars(projectedRevenueUsd),
      ebitdaUsd: roundToDollars(projectedEbitdaUsd),
      badDebtAddbackUsd: roundToDollars(projectedRevenueUsd * BAD_DEBT_RATE),
      writtenPremiumUsd: roundToDollars(
        projectedRevenueUsd / seed.commissionRate,
      ),
      isAudited: false,
      isProjected: true,
    },
  ];
}

/** Latest actual written premium — the base for allocating program premium. */
function latestActualWrittenPremium(rows: FinancialRow[]): number {
  const actuals = rows.filter((row) => !row.isProjected);
  const source = actuals.length > 0 ? actuals : rows;
  return source[source.length - 1].writtenPremiumUsd;
}

async function main() {
  console.log("Clearing existing data…");
  await prisma.retailAgency.deleteMany();
  await prisma.insuranceProgram.deleteMany();
  await prisma.financialPeriod.deleteMany();
  await prisma.mga.deleteMany();

  let programCount = 0;
  let agencyCount = 0;
  let financialCount = 0;

  for (const seed of MGA_SEEDS) {
    const financialRows = buildFinancialRows(seed);
    const basePremium = latestActualWrittenPremium(financialRows);
    const totalWeight = seed.programs.reduce(
      (sum, program) => sum + program.premiumWeight,
      0,
    );

    await prisma.mga.create({
      data: {
        slug: seed.slug,
        name: seed.name,
        status: seed.status,
        stage: seed.stage,
        yearsOfExperience: seed.yearsOfExperience,
        foundedYear: seed.foundedYear,
        principalName: seed.principalName,
        headquartersCity: seed.headquartersCity,
        headquartersState: seed.headquartersState,
        primaryRegion: seed.primaryRegion,
        employeeCount: seed.employeeCount,
        website: seed.website,
        acquisitionDate: seed.acquisitionDate
          ? new Date(`${seed.acquisitionDate}T00:00:00.000Z`)
          : null,
        enterpriseValueUsd: seed.enterpriseValueUsd ?? null,
        ebitdaMultiple: seed.ebitdaMultiple ?? null,
        ownershipPercent: seed.ownershipPercent ?? null,
        dealLead: seed.dealLead,
        notes: seed.notes,
        financials: {
          create: financialRows,
        },
        programs: {
          create: seed.programs.map((program) => ({
            name: program.name,
            lineOfBusiness: program.lineOfBusiness,
            coverageType: program.coverageType,
            geographicRegion: program.geographicRegion,
            carrierPartner: program.carrierPartner,
            writtenPremiumUsd: roundToDollars(
              (basePremium * program.premiumWeight) / totalWeight,
            ),
            lossRatio: program.lossRatio,
            isActive: program.isActive ?? true,
          })),
        },
        retailAgencies: {
          create: seed.retailAgencies.map((agency) => ({
            name: agency.name,
            principalName: agency.principalName,
            city: agency.city,
            state: agency.state,
            region: agency.region,
            appointedOn: new Date(`${agency.appointedYear}-01-15T00:00:00.000Z`),
            annualPremiumPlacedUsd: roundToDollars(
              basePremium * agency.premiumShare,
            ),
            policyCount: agency.policyCount,
            isActive: agency.isActive ?? true,
          })),
        },
      },
    });

    programCount += seed.programs.length;
    agencyCount += seed.retailAgencies.length;
    financialCount += financialRows.length;
  }

  console.log(
    [
      `Seeded ${MGA_SEEDS.length} MGAs`,
      `${financialCount} financial periods`,
      `${programCount} insurance programs`,
      `${agencyCount} retail agencies`,
    ].join(", "),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
