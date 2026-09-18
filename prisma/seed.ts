/**
 * Seed script for the Newport Specialty Partners MGA CRM MVP.
 *
 * Populates a handful of "on-platform" (acquired) MGAs with overlapping
 * lines of business / regions (to demonstrate synergy detection) plus a
 * pipeline of prospective targets with varying EBITDA growth trajectories
 * and years of experience, so the M&A dashboard has something meaningful
 * to sort and filter.
 */
import { PrismaClient } from "@prisma/client";
import { MgaStatus, PipelineStage } from "../src/types/mga";

const prisma = new PrismaClient();

type EbitdaSeed = { year: number; ebitdaUsd: number; revenueUsd?: number };
type ProgramSeed = {
  name: string;
  lineOfBusiness: string;
  coverageType: string;
  geographicRegion: string;
  premiumVolumeUsd?: number;
};
type AgencySeed = { name: string; state?: string; contactName?: string };

type MgaSeed = {
  name: string;
  description: string;
  yearsOfExperience: number;
  status: MgaStatus;
  pipelineStage?: PipelineStage;
  headquartersState: string;
  website?: string;
  contactName?: string;
  contactEmail?: string;
  acquiredDate?: Date;
  askPriceUsd?: number;
  financials: EbitdaSeed[];
  programs: ProgramSeed[];
  agencies: AgencySeed[];
};

const mgas: MgaSeed[] = [
  // ---------------------------------------------------------------------
  // ACQUIRED / ON-PLATFORM — feeds the Aggregated Portfolio View
  // ---------------------------------------------------------------------
  {
    name: "Cornerstone Specialty Underwriters",
    description:
      "Program administrator specializing in commercial trucking and cargo risks across the Southeast.",
    yearsOfExperience: 26,
    status: MgaStatus.ACQUIRED,
    headquartersState: "GA",
    website: "https://cornerstonespecialty.example.com",
    contactName: "Diane Ashford",
    contactEmail: "dashford@cornerstonespecialty.example.com",
    acquiredDate: new Date("2023-04-12"),
    financials: [
      { year: 2019, ebitdaUsd: 3_100_000, revenueUsd: 14_000_000 },
      { year: 2020, ebitdaUsd: 3_450_000, revenueUsd: 15_200_000 },
      { year: 2021, ebitdaUsd: 4_020_000, revenueUsd: 17_100_000 },
      { year: 2022, ebitdaUsd: 4_980_000, revenueUsd: 19_800_000 },
      { year: 2023, ebitdaUsd: 5_610_000, revenueUsd: 22_400_000 },
    ],
    programs: [
      {
        name: "Southeast Motor Truck Cargo",
        lineOfBusiness: "Commercial Auto",
        coverageType: "Motor Truck Cargo",
        geographicRegion: "Southeast",
        premiumVolumeUsd: 42_000_000,
      },
      {
        name: "Trucking General Liability",
        lineOfBusiness: "General Liability",
        coverageType: "Primary GL",
        geographicRegion: "Southeast",
        premiumVolumeUsd: 18_500_000,
      },
    ],
    agencies: [
      { name: "Palmetto Transport Insurance Agency", state: "SC", contactName: "Rick Owens" },
      { name: "Magnolia Fleet Brokers", state: "GA", contactName: "Tasha Reeves" },
      { name: "Coastal Cargo Insurance Group", state: "FL" },
    ],
  },
  {
    name: "Highwater Marine Programs",
    description:
      "MGA underwriting inland marine and cargo programs for regional carriers along the Gulf Coast.",
    yearsOfExperience: 22,
    status: MgaStatus.ACQUIRED,
    headquartersState: "TX",
    website: "https://highwatermarine.example.com",
    contactName: "Marcus Ibe",
    contactEmail: "mibe@highwatermarine.example.com",
    acquiredDate: new Date("2022-09-01"),
    financials: [
      { year: 2019, ebitdaUsd: 2_200_000, revenueUsd: 10_500_000 },
      { year: 2020, ebitdaUsd: 2_050_000, revenueUsd: 10_100_000 },
      { year: 2021, ebitdaUsd: 2_640_000, revenueUsd: 12_300_000 },
      { year: 2022, ebitdaUsd: 3_310_000, revenueUsd: 14_900_000 },
      { year: 2023, ebitdaUsd: 3_790_000, revenueUsd: 16_600_000 },
    ],
    programs: [
      {
        name: "Gulf Coast Inland Marine",
        lineOfBusiness: "Inland Marine",
        coverageType: "Cargo & Transit",
        geographicRegion: "Gulf Coast",
        premiumVolumeUsd: 21_000_000,
      },
      {
        name: "Motor Truck Cargo — Gulf",
        lineOfBusiness: "Commercial Auto",
        coverageType: "Motor Truck Cargo",
        geographicRegion: "Gulf Coast",
        premiumVolumeUsd: 12_800_000,
      },
    ],
    agencies: [
      { name: "Bayou Risk Partners", state: "LA" },
      { name: "Golden Triangle Insurance Services", state: "TX", contactName: "Ellen Vasquez" },
    ],
  },
  {
    name: "Meridian Habitational Risk Solutions",
    description:
      "Habitational and multifamily property program manager with a growing E&S book in the Northeast.",
    yearsOfExperience: 24,
    status: MgaStatus.ACQUIRED,
    headquartersState: "NJ",
    website: "https://meridianhabitational.example.com",
    contactName: "Paula Grant",
    contactEmail: "pgrant@meridianhabitational.example.com",
    acquiredDate: new Date("2024-01-18"),
    financials: [
      { year: 2019, ebitdaUsd: 4_800_000, revenueUsd: 21_000_000 },
      { year: 2020, ebitdaUsd: 4_650_000, revenueUsd: 20_500_000 },
      { year: 2021, ebitdaUsd: 5_910_000, revenueUsd: 24_800_000 },
      { year: 2022, ebitdaUsd: 7_040_000, revenueUsd: 28_900_000 },
      { year: 2023, ebitdaUsd: 8_330_000, revenueUsd: 33_100_000 },
    ],
    programs: [
      {
        name: "Multifamily Property — Northeast",
        lineOfBusiness: "Property",
        coverageType: "E&S Property",
        geographicRegion: "Northeast",
        premiumVolumeUsd: 55_000_000,
      },
      {
        name: "Habitational General Liability",
        lineOfBusiness: "General Liability",
        coverageType: "Primary GL",
        geographicRegion: "Northeast",
        premiumVolumeUsd: 19_400_000,
      },
    ],
    agencies: [
      { name: "Hudson Valley Property Insurers", state: "NY" },
      { name: "Garden State Risk Advisors", state: "NJ", contactName: "Ben Turcotte" },
      { name: "New England Habitational Brokers", state: "MA" },
    ],
  },
  {
    name: "Apex Builders Risk Underwriters",
    description:
      "Construction-focused MGA offering builder's risk and GL programs across the Southeast and Mid-Atlantic.",
    yearsOfExperience: 20,
    status: MgaStatus.ACQUIRED,
    headquartersState: "NC",
    website: "https://apexbuildersrisk.example.com",
    contactName: "Sam Whitfield",
    contactEmail: "swhitfield@apexbuildersrisk.example.com",
    acquiredDate: new Date("2023-11-07"),
    financials: [
      { year: 2019, ebitdaUsd: 1_900_000, revenueUsd: 9_200_000 },
      { year: 2020, ebitdaUsd: 2_010_000, revenueUsd: 9_600_000 },
      { year: 2021, ebitdaUsd: 2_460_000, revenueUsd: 11_100_000 },
      { year: 2022, ebitdaUsd: 3_120_000, revenueUsd: 13_400_000 },
      { year: 2023, ebitdaUsd: 3_680_000, revenueUsd: 15_200_000 },
    ],
    programs: [
      {
        name: "Builder's Risk — Southeast",
        lineOfBusiness: "Property",
        coverageType: "Builder's Risk",
        geographicRegion: "Southeast",
        premiumVolumeUsd: 26_000_000,
      },
      {
        name: "Contractors General Liability",
        lineOfBusiness: "General Liability",
        coverageType: "Primary GL",
        geographicRegion: "Southeast",
        premiumVolumeUsd: 14_700_000,
      },
    ],
    agencies: [
      { name: "Piedmont Contractor Insurance", state: "NC" },
      { name: "Carolina Builders Agency Group", state: "SC", contactName: "Joel Marsh" },
    ],
  },

  // ---------------------------------------------------------------------
  // PIPELINE / PROSPECT — feeds the M&A Pipeline Dashboard
  // ---------------------------------------------------------------------
  {
    name: "Ironclad Excess & Surplus Partners",
    description:
      "Excess & surplus lines MGA with a fast-growing book in umbrella and excess liability.",
    yearsOfExperience: 31,
    status: MgaStatus.PIPELINE,
    pipelineStage: PipelineStage.DILIGENCE,
    headquartersState: "IL",
    contactName: "Renee Foss",
    contactEmail: "rfoss@ironcladexcess.example.com",
    askPriceUsd: 62_000_000,
    financials: [
      { year: 2019, ebitdaUsd: 3_400_000 },
      { year: 2020, ebitdaUsd: 3_650_000 },
      { year: 2021, ebitdaUsd: 4_500_000 },
      { year: 2022, ebitdaUsd: 5_950_000 },
      { year: 2023, ebitdaUsd: 8_100_000 },
    ],
    programs: [
      {
        name: "Excess Umbrella — Midwest",
        lineOfBusiness: "Umbrella / Excess",
        coverageType: "Excess Liability",
        geographicRegion: "Midwest",
      },
    ],
    agencies: [{ name: "Great Lakes Excess Brokers", state: "IL" }],
  },
  {
    name: "Summit Peak Environmental Programs",
    description:
      "Niche MGA underwriting environmental and pollution liability for mid-market contractors.",
    yearsOfExperience: 18,
    status: MgaStatus.PIPELINE,
    pipelineStage: PipelineStage.LOI,
    headquartersState: "CO",
    contactName: "Wes Tran",
    contactEmail: "wtran@summitpeakenv.example.com",
    askPriceUsd: 38_000_000,
    financials: [
      { year: 2019, ebitdaUsd: 1_500_000 },
      { year: 2020, ebitdaUsd: 1_620_000 },
      { year: 2021, ebitdaUsd: 1_980_000 },
      { year: 2022, ebitdaUsd: 2_410_000 },
      { year: 2023, ebitdaUsd: 2_690_000 },
    ],
    programs: [
      {
        name: "Contractors Pollution Liability",
        lineOfBusiness: "Environmental",
        coverageType: "Pollution Liability",
        geographicRegion: "Mountain West",
      },
    ],
    agencies: [{ name: "Front Range Environmental Insurance", state: "CO" }],
  },
  {
    name: "Blue Ridge Trucking Programs",
    description:
      "Long-established trucking MGA with deep regional carrier relationships across the Southeast.",
    yearsOfExperience: 29,
    status: MgaStatus.PIPELINE,
    pipelineStage: PipelineStage.INITIAL_OUTREACH,
    headquartersState: "TN",
    contactName: "Gail Norwood",
    contactEmail: "gnorwood@blueridgetrucking.example.com",
    askPriceUsd: 54_000_000,
    financials: [
      { year: 2019, ebitdaUsd: 2_800_000 },
      { year: 2020, ebitdaUsd: 2_650_000 },
      { year: 2021, ebitdaUsd: 3_010_000 },
      { year: 2022, ebitdaUsd: 3_340_000 },
      { year: 2023, ebitdaUsd: 3_620_000 },
    ],
    programs: [
      {
        name: "Southeast Motor Truck Cargo",
        lineOfBusiness: "Commercial Auto",
        coverageType: "Motor Truck Cargo",
        geographicRegion: "Southeast",
      },
      {
        name: "Trucking Physical Damage",
        lineOfBusiness: "Commercial Auto",
        coverageType: "Physical Damage",
        geographicRegion: "Southeast",
      },
    ],
    agencies: [{ name: "Smoky Mountain Fleet Insurance", state: "TN" }],
  },
  {
    name: "Westgate Habitational Underwriters",
    description:
      "Western-region habitational and vacant property MGA looking for a growth-capital partner.",
    yearsOfExperience: 15,
    status: MgaStatus.PIPELINE,
    pipelineStage: PipelineStage.IDENTIFIED,
    headquartersState: "AZ",
    contactName: "Nora Kim",
    contactEmail: "nkim@westgatehab.example.com",
    askPriceUsd: 27_000_000,
    financials: [
      { year: 2019, ebitdaUsd: 900_000 },
      { year: 2020, ebitdaUsd: 950_000 },
      { year: 2021, ebitdaUsd: 1_180_000 },
      { year: 2022, ebitdaUsd: 1_460_000 },
      { year: 2023, ebitdaUsd: 1_710_000 },
    ],
    programs: [
      {
        name: "Vacant & Habitational Property",
        lineOfBusiness: "Property",
        coverageType: "E&S Property",
        geographicRegion: "Southwest",
      },
    ],
    agencies: [{ name: "Desert Sky Property Insurers", state: "AZ" }],
  },
  {
    name: "Founders Cyber & Tech Programs",
    description:
      "Fast-scaling cyber liability MGA for small-to-mid-size tech and professional services firms.",
    yearsOfExperience: 12,
    status: MgaStatus.PIPELINE,
    pipelineStage: PipelineStage.IDENTIFIED,
    headquartersState: "MA",
    contactName: "Priya Nair",
    contactEmail: "pnair@founderscyber.example.com",
    askPriceUsd: 45_000_000,
    financials: [
      { year: 2020, ebitdaUsd: 700_000 },
      { year: 2021, ebitdaUsd: 1_450_000 },
      { year: 2022, ebitdaUsd: 2_980_000 },
      { year: 2023, ebitdaUsd: 5_120_000 },
    ],
    programs: [
      {
        name: "Tech E&O / Cyber",
        lineOfBusiness: "Cyber",
        coverageType: "Cyber Liability",
        geographicRegion: "Northeast",
      },
    ],
    agencies: [{ name: "Beacon Hill Tech Insurance", state: "MA" }],
  },
];

async function main() {
  console.log("Clearing existing data...");
  await prisma.retailAgency.deleteMany();
  await prisma.insuranceProgram.deleteMany();
  await prisma.ebitdaRecord.deleteMany();
  await prisma.mga.deleteMany();

  console.log(`Seeding ${mgas.length} MGAs...`);
  for (const seed of mgas) {
    await prisma.mga.create({
      data: {
        name: seed.name,
        description: seed.description,
        yearsOfExperience: seed.yearsOfExperience,
        status: seed.status,
        pipelineStage: seed.pipelineStage,
        headquartersState: seed.headquartersState,
        website: seed.website,
        contactName: seed.contactName,
        contactEmail: seed.contactEmail,
        acquiredDate: seed.acquiredDate,
        askPriceUsd: seed.askPriceUsd,
        financials: {
          create: seed.financials.map((f) => ({
            year: f.year,
            ebitdaUsd: f.ebitdaUsd,
            revenueUsd: f.revenueUsd,
          })),
        },
        insurancePrograms: {
          create: seed.programs.map((p) => ({
            name: p.name,
            lineOfBusiness: p.lineOfBusiness,
            coverageType: p.coverageType,
            geographicRegion: p.geographicRegion,
            premiumVolumeUsd: p.premiumVolumeUsd,
          })),
        },
        retailAgencies: {
          create: seed.agencies.map((a) => ({
            name: a.name,
            state: a.state,
            contactName: a.contactName,
          })),
        },
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
