import type { Page } from "playwright";

/** Detect common human-check widgets. The bot never solves these — it stops. */
export async function hasHumanCheck(page: Page): Promise<boolean> {
  const frames = page.locator(
    'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"], iframe[title*="challenge"]'
  );
  if ((await frames.count()) > 0) return true;

  const text = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  if (/verify you are human|are you a robot|complete the security check/i.test(text.slice(0, 2000))) {
    return true;
  }
  return false;
}

export async function looksBlocked(page: Page): Promise<boolean> {
  const statusish = await page.title().catch(() => "");
  if (/access denied|attention required|just a moment/i.test(statusish)) return true;
  const body = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  return /too many requests|rate limit|access denied/i.test(body.slice(0, 1500));
}
