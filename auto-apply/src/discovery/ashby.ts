import type { Job } from "./types";
import { stripHtml } from "./html";

export async function fetchAshby(company: string, token: string): Promise<Job[]> {
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(`Ashby ${token}: ${res.status}`);
  const data = (await res.json()) as { name?: string; jobs?: any[] };
  const name = data.name || company;
  return (data.jobs || []).map((j) => ({
    id: `ashby-${token}-${j.id}`,
    company: name,
    title: j.title || "",
    location: j.location || j.address?.postalAddress?.addressLocality || "",
    url: j.jobUrl || j.applyUrl || "",
    description: j.descriptionPlain || stripHtml(j.descriptionHtml || ""),
    ats: "ashby" as const,
    postedAt: j.publishedAt || j.updatedAt,
  }));
}
