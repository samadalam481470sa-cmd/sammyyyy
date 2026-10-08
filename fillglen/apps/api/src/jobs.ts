export interface PublicJob {
  id: string;
  company: string;
  title: string;
  location: string;
  remote: boolean;
  url: string;
  board: "greenhouse" | "lever" | "ashby";
  postedAt: string;
  description: string;
}

const DFW_AUSTIN_BOARDS: { company: string; board: PublicJob["board"]; slug: string }[] = [
  { company: "Example DFW tech", board: "greenhouse", slug: "fillglen-demo" },
];

export async function fetchPublicJobs(filter: { q: string; location: string; remote: string }): Promise<PublicJob[]> {
  const out: PublicJob[] = [];
  for (const c of DFW_AUSTIN_BOARDS) {
    try {
      if (c.board === "greenhouse") {
        const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`);
        if (!r.ok) continue;
        const data = (await r.json()) as { jobs?: { id: number; title: string; absolute_url: string; location?: { name: string }; updated_at: string; content?: string }[] };
        for (const job of data.jobs || []) {
          out.push({
            id: `gh-${job.id}`,
            company: c.company,
            title: job.title,
            location: job.location?.name || "",
            remote: /remote/i.test(job.location?.name || job.title),
            url: job.absolute_url,
            board: "greenhouse",
            postedAt: job.updated_at,
            description: String(job.content || "").replace(/<[^>]+>/g, " ").slice(0, 4000),
          });
        }
      }
    } catch {
      /* public feed may 404 for demo slug */
    }
  }
  return out.filter((j) => {
    if (filter.q && !`${j.title} ${j.company}`.toLowerCase().includes(filter.q.toLowerCase())) return false;
    if (filter.location && !j.location.toLowerCase().includes(filter.location.toLowerCase())) return false;
    if (filter.remote === "true" && !j.remote) return false;
    return true;
  });
}

export const COMPANY_SEED = DFW_AUSTIN_BOARDS;
