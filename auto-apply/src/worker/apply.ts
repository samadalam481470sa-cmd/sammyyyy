import type { Page } from "playwright";
import path from "node:path";
import { fillForm, type Profile } from "../filler/fillForm";
import { hasHumanCheck, looksBlocked } from "../filler/checks";
import { isSupported, applyUrl } from "../filler/detect";
import { setStatus, saveApplication, pauseSite } from "../queue/db";
import { notify } from "../notify/notify";
import { handleUnsupported } from "./unsupported";
import { loadRules } from "../matching/score";
import { paths, ensureDataDirs } from "../paths";
import type { Job } from "../discovery/types";

export async function applyToJob(
  page: Page,
  job: Job,
  profile: Profile,
  resumePath: string,
  approved: boolean
) {
  ensureDataDirs();
  const rules = loadRules();

  await page.goto(applyUrl(job), { waitUntil: "domcontentloaded", timeout: 60_000 });

  if (await looksBlocked(page)) {
    try {
      pauseSite(new URL(job.url).hostname, 24, "block/429 page");
    } catch {
      /* ignore */
    }
    setStatus(job.id, "needs_human", "site blocked or rate-limited");
    await notify(`Site pause (block) on ${job.company}: ${job.url}`);
    return;
  }

  if (await hasHumanCheck(page)) {
    setStatus(job.id, "needs_human", "human check / CAPTCHA");
    await notify(`Human check on ${job.company}: ${job.url}`);
    return;
  }

  if (!(await isSupported(page))) {
    await handleUnsupported(job, profile);
    return;
  }

  const fieldCount = await page.locator("input:visible, textarea:visible, select:visible").count();
  if (fieldCount === 0) {
    await handleUnsupported(job, profile);
    return;
  }

  const { unfilled, aiAnswers } = await fillForm(page, profile, job, resumePath);
  const shot = path.join(paths.screenshots, `${job.id.replace(/[^a-zA-Z0-9_-]/g, "_")}-filled.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});

  if (unfilled.length > 0) {
    saveApplication(job.id, { resumePath, aiAnswers, screenshot: shot });
    setStatus(job.id, "needs_human", `unfilled: ${unfilled.slice(0, 8).join("; ")}`);
    await notify(`${job.company} needs you: ${unfilled.slice(0, 5).join(", ")}`);
    return;
  }

  if (Object.keys(aiAnswers).length > 0 && !approved) {
    saveApplication(job.id, { resumePath, aiAnswers, screenshot: shot });
    setStatus(job.id, "awaiting_review");
    await notify(`Review drafts for ${job.title} at ${job.company}`);
    return;
  }

  if (await hasHumanCheck(page)) {
    setStatus(job.id, "needs_human", "human check before submit");
    return;
  }

  // Dry-run: fill + screenshot only — never click Submit.
  if (rules.dryRun) {
    saveApplication(job.id, { resumePath, aiAnswers, screenshot: shot, outcome: "dry_run" });
    setStatus(job.id, "drafted", "dryRun=true — submit disabled");
    console.log(`[dry-run] Would submit ${job.title} at ${job.company}`);
    return;
  }

  const submit = page.getByRole("button", { name: /submit/i }).first();
  if ((await submit.count()) === 0) {
    setStatus(job.id, "needs_human", "no submit button found");
    await notify(`No submit button on ${job.company}: ${job.url}`);
    return;
  }

  await submit.click();
  await page.waitForLoadState("networkidle").catch(() => {});
  const done = path.join(paths.screenshots, `${job.id.replace(/[^a-zA-Z0-9_-]/g, "_")}-submitted.png`);
  await page.screenshot({ path: done, fullPage: true }).catch(() => {});
  saveApplication(job.id, {
    resumePath,
    aiAnswers,
    screenshot: done,
    submittedAt: new Date().toISOString(),
    outcome: "submitted",
  });
  setStatus(job.id, "submitted");
}
