import {
  assertRealListing,
  classifyWorkMode,
  detectBoardFromCareersUrl,
  geocodeLocation,
  isBlockedJobUrl,
  remoteWhereText,
  type BoardKind,
  type CanonicalListing,
  type EmployerRecord,
} from "@fillglen/core";

function nowIso() {
  return new Date().toISOString();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function fetchEmployerFeed(employer: EmployerRecord): Promise<CanonicalListing[]> {
  if (!employer.slug || employer.board === "unknown") return [];
  if (employer.board === "greenhouse") return fetchGreenhouse(employer);
  if (employer.board === "lever") return fetchLever(employer);
  if (employer.board === "ashby") return fetchAshby(employer);
  if (employer.board === "smartrecruiters") return fetchSmartRecruiters(employer);
  return [];
}

async function fetchGreenhouse(employer: EmployerRecord): Promise<CanonicalListing[]> {
  const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${employer.slug}/jobs?content=true`);
  if (!r.ok) return [];
  const data = (await r.json()) as {
    jobs?: {
      id: number;
      title: string;
      absolute_url: string;
      location?: { name: string };
      updated_at?: string;
      content?: string;
    }[];
  };
  return (data.jobs || []).map((j) => toListing({
    id: `gh-${employer.slug}-${j.id}`,
    title: j.title,
    company: employer.company,
    locationText: j.location?.name || "",
    description: stripHtml(j.content || ""),
    url: j.absolute_url,
    source: "greenhouse",
    postedAt: j.updated_at,
    employerSlug: employer.slug,
    metro: employer.metro,
  }));
}

async function fetchLever(employer: EmployerRecord): Promise<CanonicalListing[]> {
  const r = await fetch(`https://api.lever.co/v0/postings/${employer.slug}?mode=json`);
  if (!r.ok) return [];
  const jobs = (await r.json()) as {
    id: string;
    text: string;
    hostedUrl: string;
    categories?: { location?: string };
    descriptionPlain?: string;
    createdAt?: number;
  }[];
  return jobs.map((j) =>
    toListing({
      id: `lv-${employer.slug}-${j.id}`,
      title: j.text,
      company: employer.company,
      locationText: j.categories?.location || "",
      description: j.descriptionPlain || "",
      url: j.hostedUrl,
      source: "lever",
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : undefined,
      employerSlug: employer.slug,
      metro: employer.metro,
    })
  );
}

async function fetchAshby(employer: EmployerRecord): Promise<CanonicalListing[]> {
  const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${employer.slug}`);
  if (!r.ok) return [];
  const data = (await r.json()) as {
    jobs?: { id: string; title: string; location?: string; jobUrl?: string; descriptionHtml?: string }[];
  };
  return (data.jobs || []).map((j) =>
    toListing({
      id: `as-${employer.slug}-${j.id}`,
      title: j.title,
      company: employer.company,
      locationText: j.location || "",
      description: stripHtml(j.descriptionHtml || ""),
      url: j.jobUrl || `https://jobs.ashbyhq.com/${employer.slug}`,
      source: "ashby",
      employerSlug: employer.slug,
      metro: employer.metro,
    })
  );
}

async function fetchSmartRecruiters(employer: EmployerRecord): Promise<CanonicalListing[]> {
  const r = await fetch(`https://api.smartrecruiters.com/v1/companies/${employer.slug}/postings`);
  if (!r.ok) return [];
  const data = (await r.json()) as {
    content?: { id: string; name: string; releasedDate?: string; location?: { city?: string; region?: string }; ref?: string }[];
  };
  return (data.content || []).map((j) =>
    toListing({
      id: `sr-${employer.slug}-${j.id}`,
      title: j.name,
      company: employer.company,
      locationText: [j.location?.city, j.location?.region].filter(Boolean).join(", "),
      description: "",
      url: `https://jobs.smartrecruiters.com/${employer.slug}/${j.id}`,
      source: "smartrecruiters",
      postedAt: j.releasedDate,
      employerSlug: employer.slug,
      metro: employer.metro,
    })
  );
}

export async function fetchUsaJobs(locationName: string): Promise<CanonicalListing[]> {
  const key = process.env.USAJOBS_API_KEY;
  const email = process.env.USAJOBS_EMAIL;
  if (!key || !email) return [];
  const url = `https://data.usajobs.gov/api/search?LocationName=${encodeURIComponent(locationName)}&ResultsPerPage=25`;
  const r = await fetch(url, { headers: { Host: "data.usajobs.gov", "User-Agent": email, "Authorization-Key": key } });
  if (!r.ok) return [];
  const data = (await r.json()) as {
    SearchResult?: { SearchResultItems?: { MatchedObjectDescriptor?: Record<string, string> }[] };
  };
  const items = data.SearchResult?.SearchResultItems || [];
  return items
    .map((item) => item.MatchedObjectDescriptor)
    .filter(Boolean)
    .map((d) =>
      toListing({
        id: `usa-${d!.PositionID || d!.PositionURI}`,
        title: d!.PositionTitle,
        company: d!.OrganizationName || "USAJOBS",
        locationText: d!.PositionLocationDisplay || locationName,
        description: String(d!.UserArea || d!.QualificationSummary || ""),
        url: d!.PositionURI,
        source: "usajobs",
        metro: "dfw",
      })
    );
}

export async function fetchAdzuna(what: string, where: string): Promise<CanonicalListing[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];
  const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${appId}&app_key=${appKey}&what=${encodeURIComponent(what)}&where=${encodeURIComponent(where)}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = (await r.json()) as {
    results?: { id: string; title: string; company?: { display_name?: string }; location?: { display_name?: string }; redirect_url?: string; description?: string; created?: string }[];
  };
  return (data.results || [])
    .filter((j) => j.redirect_url && !isBlockedJobUrl(j.redirect_url))
    .map((j) =>
      toListing({
        id: `adz-${j.id}`,
        title: j.title,
        company: j.company?.display_name || "Unknown",
        locationText: j.location?.display_name || where,
        description: j.description || "",
        url: j.redirect_url!,
        source: "adzuna",
        postedAt: j.created,
        metro: "dfw",
      })
    );
}

function toListing(input: {
  id: string;
  title: string;
  company: string;
  locationText: string;
  description: string;
  url: string;
  source: BoardKind | string;
  postedAt?: string;
  employerSlug?: string;
  metro: string;
}): CanonicalListing {
  if (isBlockedJobUrl(input.url)) {
    throw new Error("blocked source");
  }
  const geo = geocodeLocation(input.locationText, input.metro === "austin" ? "austin" : "dfw");
  const seen = nowIso();
  const listing: CanonicalListing = {
    id: input.id,
    title: input.title,
    company: input.company,
    locationText: input.locationText,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    workMode: classifyWorkMode(input.title, input.locationText, input.description),
    remoteWhere: remoteWhereText(input.locationText, input.description),
    description: input.description,
    url: input.url,
    source: input.source,
    sources: [{ source: input.source, url: input.url }],
    firstSeenAt: seen,
    lastCheckedAt: seen,
    postedAt: input.postedAt,
    status: "open",
    employerSlug: input.employerSlug,
  };
  assertRealListing(listing);
  return listing;
}

export function employerFromCareersLink(careersUrl: string, company: string, metro = "dfw"): EmployerRecord {
  const detected = detectBoardFromCareersUrl(careersUrl);
  return {
    company,
    metro,
    careersUrl,
    board: detected?.board || "unknown",
    slug: detected?.slug || "",
    sourceKind: "user-added",
  };
}
