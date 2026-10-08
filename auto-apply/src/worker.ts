import "dotenv/config";
import cron from "node-cron";
import { chromium } from "playwright";
import { ensureDataDirs, paths } from "./paths";
import { loadRules } from "./matching/score";
import { runDiscovery } from "./discovery/run";
import { runMatching } from "./matching/run";
import {
  nextJob,
  submittedToday,
  submittedThisWeekForCompany,
  alreadySubmittedDuplicate,
  setStatus,
  isSitePaused,
} from "./queue/db";
import { tailorResume } from "./ai/tailor";
import { applyToJob } from "./worker/apply";
import { notify } from "./notify/notify";
import { loadProfile } from "./loadProfile";
import { startDashboard } from "./dashboard/server";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let paused = false;

// Electron / parent process can pause/resume the worker.
(process as any).parentPort?.on("message", (e: any) => {
  if (e?.data?.type === "pause") paused = true;
  if (e?.data?.type === "resume") paused = false;
});
process.on("message", (msg: any) => {
  if (msg?.type === "pause") paused = true;
  if (msg?.type === "resume") paused = false;
});

async function discoverAndMatch() {
  console.log("[cron] discovery start");
  await runDiscovery();
  runMatching();
}

async function main() {
  ensureDataDirs();
  const rules = loadRules();
  const profile = loadProfile();

  startDashboard();

  cron.schedule("0 * * * *", () => {
    discoverAndMatch().catch((err) => console.error(err));
  });
  cron.schedule("0 8 * * *", () => notify("Daily summary ready on the dashboard"));

  // First discovery on boot (non-blocking for browser loop if slow)
  discoverAndMatch().catch((err) => console.error(err));

  const launchOpts: Parameters<typeof chromium.launchPersistentContext>[1] = {
    headless: process.env.HEADLESS === "true",
    viewport: { width: 1280, height: 900 },
  };
  // Prefer system Chrome when available (smaller Electron install); fall back to bundled Chromium.
  if (process.env.PLAYWRIGHT_CHANNEL) {
    (launchOpts as any).channel = process.env.PLAYWRIGHT_CHANNEL;
  }

  const context = await chromium.launchPersistentContext(paths.browserProfile, launchOpts);
  console.log(
    `Worker running. dryRun=${rules.dryRun} dailyCap=${rules.dailyCap} gap=${rules.minutesBetweenApplications}m`
  );

  while (true) {
    if (paused) {
      await sleep(60_000);
      continue;
    }

    if (submittedToday() >= rules.dailyCap) {
      console.log(`[cap] daily Cap ${rules.dailyCap} reached — sleeping 30m`);
      await sleep(30 * 60_000);
      continue;
    }

    const next = nextJob();
    if (!next) {
      await sleep(5 * 60_000);
      continue;
    }

    if (alreadySubmittedDuplicate(next.job)) {
      setStatus(next.job.id, "skipped", "duplicate already submitted");
      continue;
    }
    if (submittedThisWeekForCompany(next.job.company) >= rules.maxPerCompanyPerWeek) {
      setStatus(next.job.id, "skipped", "company weekly cap");
      continue;
    }
    if (isSitePaused(next.job.url)) {
      setStatus(next.job.id, "skipped", "site paused 24h");
      continue;
    }

    const page = await context.newPage();
    try {
      const resumePath = await tailorResume(next.job, profile);
      await applyToJob(page, next.job, profile, resumePath, next.approved);
    } catch (err) {
      setStatus(next.job.id, "failed", String(err));
      await page
        .screenshot({ path: `${paths.screenshots}/${next.job.id.replace(/[^a-zA-Z0-9_-]/g, "_")}-error.png` })
        .catch(() => {});
      await notify(`Failed on ${next.job.company}: ${String(err)}`);
    } finally {
      await page.close().catch(() => {});
    }

    await sleep(rules.minutesBetweenApplications * 60_000);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { main, paused };
