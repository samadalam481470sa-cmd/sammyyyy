import type { Page } from "playwright";
import { matchField, needsPause } from "../fieldMap";
import type { Profile } from "../fillForm";

/**
 * Best-effort radio/checkbox filling from profile keys and EEO answers.
 * Never guesses — unmatched groups are returned as unfilled.
 */
export async function fillRadiosAndCheckboxes(page: Page, profile: Profile) {
  const unfilled: string[] = [];

  // Group radios by name
  const radios = page.locator('input[type="radio"]');
  const count = await radios.count();
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    const el = radios.nth(i);
    const name = (await el.getAttribute("name")) || `anon-${i}`;
    if (seen.has(name)) continue;
    seen.add(name);

    const safeName = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const group = page.locator(`input[type="radio"][name="${safeName}"]`);
    const first = group.first();
    const question = await first.evaluate((node: HTMLElement) => {
      const fieldset = node.closest("fieldset");
      const legend = fieldset?.querySelector("legend")?.textContent;
      if (legend) return legend.trim();
      const labelled = node.getAttribute("aria-label");
      if (labelled) return labelled;
      return node.getAttribute("name") || "";
    });

    const key = matchField(question);
    let desired =
      (key && profile.fields[key]) ||
      (needsPause(question)
        ? Object.entries(profile.eeo || {}).find(([k]) => question.toLowerCase().includes(k))?.[1]
        : null);

    if (!desired || /FILL_ME/i.test(desired)) {
      unfilled.push(question || name);
      continue;
    }

    const n = await group.count();
    let clicked = false;
    for (let j = 0; j < n; j++) {
      const opt = group.nth(j);
      const optLabel = await opt.evaluate((node: HTMLElement) => {
        const id = node.getAttribute("id");
        const byFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent : null;
        const wrap = node.closest("label")?.textContent;
        return (byFor || wrap || node.getAttribute("value") || "").trim();
      });
      if (optLabel.toLowerCase().includes(desired.toLowerCase()) || desired.toLowerCase().includes(optLabel.toLowerCase())) {
        await opt.check({ force: true }).catch(() => {});
        clicked = true;
        break;
      }
    }
    if (!clicked) unfilled.push(question || name);
  }

  return { unfilled };
}
