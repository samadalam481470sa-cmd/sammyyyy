import { chromium } from "/workspace/auto-apply/node_modules/playwright/index.mjs";
import fs from "node:fs";

const out = "/opt/cursor/artifacts";
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  headless: false,
  channel: "chrome",
  args: ["--no-first-run", "--no-default-browser-check"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto("http://127.0.0.1:5173/live", { waitUntil: "networkidle" });
await page.waitForSelector("text=Fill this step");
await page.screenshot({ path: `${out}/fillglen_live_before_fill.png`, fullPage: true });

await page.getByRole("button", { name: "Fill this step" }).click();
await page.waitForTimeout(600);

const first = await page.locator('form input').first().inputValue();
const email = await page.locator('form input').nth(2).inputValue();
if (!first.includes("Sam") || !email.includes("@")) {
  throw new Error(`Fill failed: first="${first}" email="${email}"`);
}

const submitClicked = await page.evaluate(() => document.activeElement?.textContent === "Submit application");
if (submitClicked) throw new Error("Submit button stole focus / was clicked");
if (!page.url().includes("/live")) throw new Error("Navigated away from /live");

await page.screenshot({ path: `${out}/fillglen_live_after_fill.png`, fullPage: true });

const draftBtn = page.getByRole("button", { name: "Draft with AI" });
await draftBtn.scrollIntoViewIfNeeded();
await draftBtn.click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Insert" }).click();
await page.waitForTimeout(300);
const why = await page.locator("form textarea").inputValue();
if (!why.toLowerCase().includes("typescript")) throw new Error(`Insert failed: ${why}`);

await page.screenshot({ path: `${out}/fillglen_live_after_insert.png`, fullPage: true });

await page.getByRole("link", { name: "Privacy" }).click().catch(async () => {
  await page.goto("http://127.0.0.1:5173/privacy");
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/fillglen_privacy.png`, fullPage: true });

await page.goto("http://127.0.0.1:5173/");
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/fillglen_home.png` });

console.log(JSON.stringify({ first, email, why: why.slice(0, 80), url: page.url() }, null, 2));
await browser.close();
