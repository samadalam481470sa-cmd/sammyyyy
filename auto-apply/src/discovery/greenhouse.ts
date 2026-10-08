import type { Job } from "./types";
import { stripHtml } from "./html";

export async function fetchGreenhouse(company: string, token: string): Promise<Job[]> {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`
  );
  if (!res.ok) throw new Error(`Greenhouse ${token}: ${res.status}`);
  const data = (await res.json()) as { jobs?: any[] };
  return (data.jobs || []).map((j) => ({
    id: `gh-${token}-${j.id}`,
    company,
    title: j.title || "",
    location: j.location?.name ?? "",
    url: j.absolute_url || "",
    description: stripHtml(j.content ?? ""),
    ats: "greenhouse" as const,
    postedAt: j.updated_at || j.first_published,
  }));
}
