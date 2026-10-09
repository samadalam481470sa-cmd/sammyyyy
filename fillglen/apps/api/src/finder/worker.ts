/**
 * Always-on local finder. Run on the server (or a cloud scheduler every hour).
 * Chrome MV3 workers cannot keep this alive.
 */
import { loadDb } from "../db.js";
import { archiveFinderCycle } from "../database.js";
import { runFetch, recheckOpen } from "./pipeline.js";
import { runMapDiscovery } from "./maps.js";

loadDb();

const hour = Number(process.env.FINDER_INTERVAL_MS || 60 * 60 * 1000);

async function cycle() {
  const maps = await runMapDiscovery({ maxTiles: 2, maxSites: 12 }).catch(() => null);
  const fetch = await runFetch({ includeUsa: true, includeAdzuna: true });
  const recheck = await recheckOpen();
  console.log(
    `Fillglen finder: fetched=${fetch.fetched} stored=${fetch.stored} closed=${recheck.closed} maps=${maps?.companiesSeen ?? 0}`
  );
  archiveFinderCycle({
    fetched: fetch.fetched,
    stored: fetch.stored,
    closed: recheck.closed,
    maps: maps?.companiesSeen ?? 0,
    via: "api",
    note: `fetched=${fetch.fetched} stored=${fetch.stored} closed=${recheck.closed} maps=${maps?.companiesSeen ?? 0}`,
  });
}

if (process.argv[1]?.includes("worker")) {
  await cycle();
  if (process.env.FINDER_LOOP === "1") {
    setInterval(() => {
      cycle().catch((err) => console.error(err));
    }, hour);
  }
}

export { cycle };
