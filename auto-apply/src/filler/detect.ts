import type { Page } from "playwright";
import type { Ats } from "../discovery/types";

export function detectAts(url: string): Ats | null {
  try {
    const host = new URL(url).hostname;
    if (host.endsWith("greenhouse.io") || host.endsWith("boards.greenhouse.io")) return "greenhouse";
    if (host === "jobs.lever.co") return "lever";
    if (host === "jobs.ashbyhq.com") return "ashby";
    return null;
  } catch {
    return null;
  }
}

export async function isSupported(page: Page): Promise<boolean> {
  if (detectAts(page.url())) return true;

  // Some Greenhouse jobs sit on the company's own site inside an embedded form.
  const embedded = page.locator('iframe[src*="greenhouse.io"]');
  if ((await embedded.count()) > 0) {
    const src = await embedded.first().getAttribute("src");
    if (src) {
      await page.goto(src, { waitUntil: "domcontentloaded" });
      return true;
    }
  }
  return false;
}

export function applyUrl(job: { ats: string; url: string }): string {
  if (job.ats === "lever") return job.url.replace(/\/$/, "") + "/apply";
  if (job.ats === "ashby") return job.url.replace(/\/$/, "") + "/application";
  return job.url;
}
