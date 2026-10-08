/**
 * Always-on local finder. Run on the server (or a cloud scheduler every hour).
 * Chrome MV3 workers cannot keep this alive.
 */
import { loadDb } from "../db.js";
import { runFetch, recheckOpen } from "./pipeline.js";

loadDb();

const hour = Number(process.env.FINDER_INTERVAL_MS || 60 * 60 * 1000);

async function cycle() {
  const fetch = await runFetch({ includeUsa: true, includeAdzuna: true });
  const recheck = await recheckOpen();
  console.log(`Fillglen finder: fetched=${fetch.fetched} stored=${fetch.stored} closed=${recheck.closed}`);
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
