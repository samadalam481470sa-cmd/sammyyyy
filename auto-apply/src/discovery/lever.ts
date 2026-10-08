import type { Job } from "./types";
import { stripHtml } from "./html";

export async function fetchLever(company: string, token: string): Promise<Job[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`);
  if (!res.ok) throw new Error(`Lever ${token}: ${res.status}`);
  const data = (await res.json()) as any[];
  return (Array.isArray(data) ? data : []).map((j) => ({
    id: `lever-${token}-${j.id}`,
    company,
    title: j.text || "",
    location: j.categories?.location ?? "",
    url: j.hostedUrl || j.applyUrl || "",
    description: j.descriptionPlain || stripHtml(j.description || ""),
    ats: "lever" as const,
    postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : undefined,
  }));
}
