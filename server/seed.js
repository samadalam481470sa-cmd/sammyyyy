// Seeds the database with representative MGA roll-up data so the dashboards
// are demo-ready. Running it again wipes and re-seeds (idempotent).
const db = require('./db');

const MGAS = [
  // ---- Acquired / On-Platform ----
  {
    name: 'Harborline Specialty Underwriters', status: 'acquired', years: 27,
    hq: 'Hartford, CT', contact: 'Dana Whitfield', acquired: '2024-03-15',
    notes: 'First platform acquisition. Anchor of the Northeast property book.',
    ebitda: { 2021: 6.1, 2022: 7.0, 2023: 8.2, 2024: 9.6, 2025: 11.1 },
    programs: [
      ['Coastal Property Program', 'Commercial Property', 'Wind & Hail', 'Northeast'],
      ['Habitational Real Estate', 'Commercial Property', 'All Risk', 'Northeast'],
    ],
    agencies: [
      ['Beacon Hill Insurance Group', 'Jake Morrissey', 'MA', 4.2],
      ['Long Wharf Risk Advisors', 'Priya Raman', 'CT', 3.1],
      ['Narragansett Coverage Co.', 'Tom Delgado', 'RI', 2.4],
    ],
  },
  {
    name: 'BlueRidge Casualty Managers', status: 'acquired', years: 31,
    hq: 'Charlotte, NC', contact: 'Marcus Vail', acquired: '2024-07-01',
    notes: 'Deep carrier relationships in trucking casualty.',
    ebitda: { 2021: 4.8, 2022: 5.5, 2023: 6.5, 2024: 7.8, 2025: 9.0 },
    programs: [
      ['Regional Trucking Liability', 'Commercial Auto', 'Liability', 'Southeast'],
      ['Contractor GL Program', 'General Liability', 'Liability', 'Southeast'],
    ],
    agencies: [
      ['Piedmont Insurance Partners', 'Jake Sutton', 'NC', 5.0],
      ['Savannah Risk Services', 'Alicia Grant', 'GA', 2.8],
    ],
  },
  {
    name: 'Cascade Programs Group', status: 'acquired', years: 22,
    hq: 'Portland, OR', contact: 'Elaine Moss', acquired: '2025-01-10',
    notes: 'Strong E&S property franchise; overlap with Harborline on All Risk.',
    ebitda: { 2021: 3.2, 2022: 3.9, 2023: 4.9, 2024: 6.2, 2025: 7.7 },
    programs: [
      ['Wildfire-Exposed Property', 'Commercial Property', 'All Risk', 'Pacific Northwest'],
      ['Craft Beverage Package', 'General Liability', 'Package', 'Pacific Northwest'],
    ],
    agencies: [
      ['Willamette Valley Insurance', 'Jake Okafor', 'OR', 3.6],
      ['Puget Sound Brokers', 'Hannah Lee', 'WA', 2.9],
      ['Boise Basin Agency', 'Carl Jensen', 'ID', 1.7],
    ],
  },
  {
    name: 'Gulfstream Marine Underwriting', status: 'acquired', years: 25,
    hq: 'Tampa, FL', contact: 'Roberto Salas', acquired: '2025-04-22',
    notes: 'Marine niche; regional overlap with BlueRidge in the Southeast.',
    ebitda: { 2021: 5.4, 2022: 5.9, 2023: 6.8, 2024: 7.9, 2025: 9.4 },
    programs: [
      ['Commercial Hull & Machinery', 'Marine', 'Hull', 'Southeast'],
      ['Marina Operators Liability', 'Marine', 'Liability', 'Southeast'],
    ],
    agencies: [
      ['Tampa Bay Marine Agency', 'Jake Herrera', 'FL', 4.4],
      ['Gulf Coast Risk Group', 'Sandra Boyd', 'AL', 2.2],
    ],
  },
  {
    name: 'Summit Peak Insurance Services', status: 'acquired', years: 20,
    hq: 'Denver, CO', contact: 'Kim Tran', acquired: '2025-08-05',
    notes: 'Newest platform add; workers comp specialist.',
    ebitda: { 2021: 2.1, 2022: 2.6, 2023: 3.4, 2024: 4.5, 2025: 5.8 },
    programs: [
      ['Mountain States Workers Comp', 'Workers Compensation', 'Statutory', 'Mountain West'],
      ['Ski Resort Package', 'General Liability', 'Package', 'Mountain West'],
    ],
    agencies: [
      ['Front Range Insurance Co.', 'Jake Palmer', 'CO', 3.3],
      ['High Desert Agency', 'Maria Ortiz', 'NM', 1.5],
    ],
  },

  // ---- Pipeline / Prospects ----
  {
    name: 'Ironbound Program Managers', status: 'pipeline', years: 29,
    hq: 'Newark, NJ', contact: 'Frank DeLuca',
    notes: 'LOI drafted. Excellent EBITDA trajectory; habitational overlap with Harborline.',
    ebitda: { 2021: 4.0, 2022: 5.1, 2023: 6.6, 2024: 8.5, 2025: 10.9 },
    programs: [
      ['Urban Habitational Program', 'Commercial Property', 'All Risk', 'Northeast'],
      ['Restaurant & Hospitality GL', 'General Liability', 'Liability', 'Northeast'],
    ],
    agencies: [
      ['Garden State Coverage', 'Jake Russo', 'NJ', 3.8],
      ['Hudson Insurance Group', 'Lena Park', 'NY', 4.6],
    ],
  },
  {
    name: 'Prairie Shield Underwriters', status: 'pipeline', years: 34,
    hq: 'Des Moines, IA', contact: 'Gwen Hollis',
    notes: 'Founder nearing retirement; succession-driven sale. Ag niche is uncontested.',
    ebitda: { 2021: 5.9, 2022: 6.3, 2023: 6.9, 2024: 7.6, 2025: 8.2 },
    programs: [
      ['Farm & Ranch Property', 'Agriculture', 'All Risk', 'Midwest'],
      ['Grain Elevator Liability', 'Agriculture', 'Liability', 'Midwest'],
    ],
    agencies: [
      ['Corn Belt Insurance', 'Jake Vandermeer', 'IA', 2.9],
      ['Plains Risk Advisors', 'Beth Callahan', 'NE', 2.1],
      ['Ozark Coverage Group', 'Denny Fisk', 'MO', 1.8],
    ],
  },
  {
    name: 'Lone Star Specialty Risk', status: 'pipeline', years: 23,
    hq: 'Austin, TX', contact: 'Hector Nunez',
    notes: 'Fast-growing energy book. Valuation expectations are rich.',
    ebitda: { 2021: 3.5, 2022: 4.6, 2023: 6.1, 2024: 8.0, 2025: 10.4 },
    programs: [
      ['Oilfield Services GL', 'General Liability', 'Liability', 'Southwest'],
      ['Energy Commercial Auto', 'Commercial Auto', 'Liability', 'Southwest'],
    ],
    agencies: [
      ['Hill Country Insurance', 'Jake Buchanan', 'TX', 5.2],
      ['Permian Basin Brokers', 'Rosa Elizondo', 'TX', 3.9],
    ],
  },
  {
    name: 'Keystone Excess & Surplus', status: 'pipeline', years: 26,
    hq: 'Philadelphia, PA', contact: 'Nadia Brooks',
    notes: 'Strong wind & hail overlap with Harborline — clear synergy candidate.',
    ebitda: { 2021: 4.4, 2022: 5.0, 2023: 5.9, 2024: 7.0, 2025: 8.3 },
    programs: [
      ['Mid-Atlantic Coastal Wind', 'Commercial Property', 'Wind & Hail', 'Northeast'],
      ['Vacant Property Program', 'Commercial Property', 'All Risk', 'Mid-Atlantic'],
    ],
    agencies: [
      ['Liberty Bell Agency', 'Jake Kowalski', 'PA', 3.4],
      ['Chesapeake Insurance Co.', 'Owen Marsh', 'MD', 2.6],
    ],
  },
  {
    name: 'Redwood Professional Lines', status: 'pipeline', years: 18,
    hq: 'San Francisco, CA', contact: 'Ivy Chen',
    notes: 'Below the 20-year experience bar but exceptional tech E&O growth.',
    ebitda: { 2021: 1.8, 2022: 2.5, 2023: 3.6, 2024: 5.1, 2025: 7.0 },
    programs: [
      ['Tech Startup E&O', 'Professional Liability', 'Errors & Omissions', 'West Coast'],
      ['Cyber Liability Program', 'Cyber', 'Liability', 'National'],
    ],
    agencies: [
      ['Bay Area Risk Partners', 'Jake Lindqvist', 'CA', 4.1],
    ],
  },
  {
    name: 'Great Lakes Casualty Group', status: 'pipeline', years: 30,
    hq: 'Chicago, IL', contact: 'Walter Igwe',
    notes: 'Flat EBITDA — likely a pass unless price comes down.',
    ebitda: { 2021: 7.2, 2022: 7.3, 2023: 7.1, 2024: 7.4, 2025: 7.5 },
    programs: [
      ['Manufacturing GL Program', 'General Liability', 'Liability', 'Midwest'],
      ['Fleet Trucking Program', 'Commercial Auto', 'Liability', 'Midwest'],
    ],
    agencies: [
      ['Lakeshore Insurance Group', 'Jake Antonelli', 'IL', 4.8],
      ['Motor City Coverage', 'Dee Washington', 'MI', 3.2],
    ],
  },
  {
    name: 'Bayou Specialty Programs', status: 'pipeline', years: 21,
    hq: 'New Orleans, LA', contact: 'Celeste Fontenot',
    notes: 'Marine + wind overlap with Gulfstream and Harborline. Strong synergy story.',
    ebitda: { 2021: 2.9, 2022: 3.5, 2023: 4.4, 2024: 5.6, 2025: 7.1 },
    programs: [
      ['Gulf Wind & Hail Property', 'Commercial Property', 'Wind & Hail', 'Gulf Coast'],
      ['Inland Marine Cargo', 'Marine', 'Cargo', 'Gulf Coast'],
    ],
    agencies: [
      ['Crescent City Insurance', 'Jake Thibodeaux', 'LA', 3.7],
      ['Delta Risk Services', 'Amara Jones', 'MS', 1.9],
    ],
  },
  {
    name: 'Old Dominion Underwriting Co.', status: 'pipeline', years: 38,
    hq: 'Richmond, VA', contact: 'Charles Pemberton III',
    notes: 'Longest-tenured target in the funnel. Steady, unspectacular growth.',
    ebitda: { 2021: 6.8, 2022: 7.2, 2023: 7.7, 2024: 8.3, 2025: 8.9 },
    programs: [
      ['Main Street Package Program', 'General Liability', 'Package', 'Mid-Atlantic'],
      ['Religious Institutions Program', 'Commercial Property', 'All Risk', 'Mid-Atlantic'],
    ],
    agencies: [
      ['Tidewater Agency Group', 'Jake Beaumont', 'VA', 4.0],
      ['Blue Ridge Brokers', 'Susannah Cole', 'VA', 2.3],
      ['Capital Coverage Co.', 'Reggie Lewis', 'DC', 3.0],
    ],
  },
  {
    name: 'Sierra Nevada Risk Managers', status: 'pipeline', years: 24,
    hq: 'Reno, NV', contact: 'Paulina Vega',
    notes: 'Workers comp overlap with Summit Peak; would extend Mountain West footprint.',
    ebitda: { 2021: 3.0, 2022: 3.6, 2023: 4.5, 2024: 5.5, 2025: 6.9 },
    programs: [
      ['Hospitality Workers Comp', 'Workers Compensation', 'Statutory', 'Mountain West'],
      ['Casino & Gaming GL', 'General Liability', 'Liability', 'Mountain West'],
    ],
    agencies: [
      ['Silver State Insurance', 'Jake Moreno', 'NV', 2.7],
      ['Tahoe Risk Partners', 'Erin Doyle', 'CA', 2.0],
    ],
  },
];

function seed() {
  db.exec('DELETE FROM retail_agencies; DELETE FROM insurance_programs; DELETE FROM mga_financials; DELETE FROM mgas;');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('mgas','mga_financials','insurance_programs','retail_agencies');");

  const insertMga = db.prepare(`INSERT INTO mgas (name, status, years_of_experience, headquarters, principal_contact, notes, acquired_date)
    VALUES (@name, @status, @years, @hq, @contact, @notes, @acquired)`);
  const insertFin = db.prepare('INSERT INTO mga_financials (mga_id, fiscal_year, ebitda) VALUES (?, ?, ?)');
  const insertProg = db.prepare('INSERT INTO insurance_programs (mga_id, name, line_of_business, coverage_type, geographic_region) VALUES (?, ?, ?, ?, ?)');
  const insertAgency = db.prepare('INSERT INTO retail_agencies (mga_id, name, principal, state, annual_premium) VALUES (?, ?, ?, ?, ?)');

  const run = db.transaction(() => {
    for (const m of MGAS) {
      const { lastInsertRowid: id } = insertMga.run({
        name: m.name, status: m.status, years: m.years, hq: m.hq,
        contact: m.contact, notes: m.notes || null, acquired: m.acquired || null,
      });
      for (const [year, ebitda] of Object.entries(m.ebitda)) {
        insertFin.run(id, Number(year), ebitda * 1_000_000);
      }
      for (const [name, lob, coverage, region] of m.programs) {
        insertProg.run(id, name, lob, coverage, region);
      }
      for (const [name, principal, state, premium] of m.agencies) {
        insertAgency.run(id, name, principal, state, premium * 1_000_000);
      }
    }
  });
  run();

  const counts = {
    mgas: db.prepare('SELECT COUNT(*) c FROM mgas').get().c,
    financials: db.prepare('SELECT COUNT(*) c FROM mga_financials').get().c,
    programs: db.prepare('SELECT COUNT(*) c FROM insurance_programs').get().c,
    agencies: db.prepare('SELECT COUNT(*) c FROM retail_agencies').get().c,
  };
  console.log('Seed complete:', counts);
}

if (require.main === module) seed();
module.exports = seed;
