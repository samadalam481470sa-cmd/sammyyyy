const clientNames = [
  ["Hudson Valley Fabrication", "Daniel Rosen", "Manufacturing", "Albany", "NY", "Northeast"],
  ["Brightwater Hospitality Group", "Imani Brooks", "Hospitality", "Charleston", "SC", "Southeast"],
  ["Mason Ridge Logistics", "Olivia Chen", "Transportation", "Detroit", "MI", "Midwest"],
  ["Tideway Marine Services", "Peter Walsh", "Marine", "Providence", "RI", "Northeast"],
  ["Silver Oak Medical Partners", "Maya Shah", "Healthcare", "Denver", "CO", "Mountain West"],
  ["Redwood Property Holdings", "Lucas Martin", "Real Estate", "Sacramento", "CA", "California"],
  ["Greenline Environmental", "Renee Foster", "Environmental", "Portland", "OR", "Pacific Northwest"],
  ["Northstar Technology Labs", "Ethan Kim", "Technology", "Seattle", "WA", "Pacific Northwest"],
  ["Ironworks Construction", "Camila Ruiz", "Construction", "Pittsburgh", "PA", "Mid-Atlantic"],
  ["Heritage Food Markets", "Noah Bennett", "Retail", "Columbus", "OH", "Midwest"],
  ["Atlas Fleet Services", "Sofia Trevino", "Transportation", "Dallas", "TX", "Texas"],
  ["Crescent Bay Apartments", "Marcus Green", "Real Estate", "Mobile", "AL", "Gulf South"],
  ["Summit Allied Health", "Aaliyah Carter", "Healthcare", "Salt Lake City", "UT", "Mountain West"],
  ["Keystone Storage Systems", "Henry Wu", "Warehousing", "Harrisburg", "PA", "Mid-Atlantic"],
  ["Bluebird Retail Group", "Layla Ahmed", "Retail", "Boston", "MA", "Northeast"],
  ["Canyon Energy Services", "Mateo Garcia", "Energy", "Houston", "TX", "Texas"],
] as const;

const mgas = [
  "Harborline Underwriters",
  "Cascade Specialty Risk",
  "Lone Star Program Managers",
  "Meridian Casualty Group",
  "Gulf Bay Underwriters",
  "Summit Professional Lines",
] as const;

const producers = [
  "Mary Donovan",
  "Michael Ruiz",
  "Tomi Okafor",
  "Ellen Marchetti",
] as const;

const statuses = ["ACTIVE", "RENEWAL_DUE", "PROSPECT", "AT_RISK"] as const;
const activityTypes = [
  "CALL",
  "EMAIL",
  "MEETING",
  "RENEWAL_REVIEW",
  "CLAIM_CHECK_IN",
] as const;

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const CLIENT_SEEDS = clientNames.map((client, index) => {
  const [companyName, contactName, industry, city, state, region] = client;
  const first = contactName.split(" ")[0].toLowerCase();
  const last = contactName.split(" ").at(-1)?.toLowerCase();
  const status = statuses[index % statuses.length];
  const dueDay = 19 + (index % 10);
  const dueHour = 9 + (index % 7);

  return {
    slug: slugify(companyName),
    companyName,
    contactName,
    email: `${first}.${last}@${slugify(companyName).replaceAll("-", "")}.com`,
    phone: `+1 (555) ${String(210 + index).padStart(3, "0")}-${String(4400 + index * 37).slice(-4)}`,
    industry,
    city,
    state,
    region,
    mgaName: mgas[index % mgas.length],
    producer: producers[index % producers.length],
    annualPremiumUsd: 180_000 + ((index * 173_411) % 1_420_000),
    policyCount: 1 + (index % 7),
    status,
    notes:
      status === "AT_RISK"
        ? "Claims activity increased; executive check-in required."
        : status === "RENEWAL_DUE"
          ? "Renewal strategy should be agreed before carrier marketing."
          : null,
    followUps: [
      {
        title:
          status === "RENEWAL_DUE"
            ? "Review renewal strategy"
            : status === "AT_RISK"
              ? "Client retention check-in"
              : status === "PROSPECT"
                ? "Follow up on submission"
                : "Quarterly coverage check-in",
        activityType: activityTypes[index % activityTypes.length],
        dueAt: new Date(Date.UTC(2026, 8, dueDay, dueHour, 0)),
        assignedTo: producers[index % producers.length],
        notes:
          status === "AT_RISK"
            ? "Bring the latest claims run and proposed loss-control plan."
            : null,
        isCompleted: false,
      },
      ...(index < 6
        ? [
            {
              title: "Initial account review",
              activityType: "MEETING",
              dueAt: new Date(Date.UTC(2026, 7, 12 + index, 14, 0)),
              assignedTo: producers[index % producers.length],
              notes: null,
              isCompleted: true,
              completedAt: new Date(Date.UTC(2026, 7, 12 + index, 15, 0)),
            },
          ]
        : []),
    ],
  };
});
