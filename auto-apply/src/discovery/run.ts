import { configPath, readJson } from "../paths";
import { insertIfNew } from "../queue/db";
import type { Company } from "./types";
import { fetchGreenhouse } from "./greenhouse";
import { fetchLever } from "./lever";
import { fetchAshby } from "./ashby";

const fetchers = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runDiscovery(): Promise<{ inserted: number; failed: string[] }> {
  const companies = readJson<Company[]>(configPath("companies.json"));
  let inserted = 0;
  const failed: string[] = [];

  for (const c of companies) {
    const fetcher = fetchers[c.ats];
    if (!fetcher) {
      failed.push(`${c.name}: unknown ats ${c.ats}`);
      continue;
    }
    try {
      const jobs = await fetcher(c.name, c.token);
      for (const job of jobs) {
        if (insertIfNew(job)) inserted++;
      }
      console.log(`  ${c.name} (${c.ats}): ${jobs.length} posting(s)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Discovery failed for ${c.name}: ${msg}`);
      failed.push(`${c.name}: ${msg}`);
    }
    await sleep(2000);
  }
  return { inserted, failed };
}

if (require.main === module) {
  runDiscovery()
    .then((r) => {
      console.log(`Inserted ${r.inserted} new job(s).`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
