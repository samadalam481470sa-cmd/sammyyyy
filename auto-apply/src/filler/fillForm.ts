import type { Page, Locator } from "playwright";
import { matchField, needsPause } from "./fieldMap";
import { getAnswer } from "../ai/answers";
import { fillRadiosAndCheckboxes } from "./adapters/common";

async function labelFor(el: Locator): Promise<string> {
  return el.evaluate((node: HTMLElement) => {
    const id = node.getAttribute("id");
    const byFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent : null;
    const byAria = node.getAttribute("aria-label");
    const lb = node.getAttribute("aria-labelledby");
    const byLabelledBy = lb
      ? lb
          .split(/\s+/)
          .map((x) => document.getElementById(x)?.textContent || "")
          .join(" ")
      : null;
    const wrapped = node.closest("label")?.textContent;
    const placeholder = node.getAttribute("placeholder");
    return (byFor || byAria || byLabelledBy || wrapped || placeholder || node.getAttribute("name") || "").trim();
  });
}

export type Profile = {
  fields: Record<string, string>;
  eeo?: Record<string, string>;
  fieldsOff?: string[];
  experience?: any[];
  resumeFileName?: string;
};

export async function fillForm(page: Page, profile: Profile, job: any, resumePath: string) {
  const unfilled: string[] = [];
  const aiAnswers: Record<string, string> = {};
  const fieldsOff = new Set(profile.fieldsOff || []);

  // File uploads first
  const fileInputs = page.locator('input[type="file"]');
  const fileCount = await fileInputs.count();
  for (let i = 0; i < fileCount; i++) {
    const el = fileInputs.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = await labelFor(el);
    if (/resume|cv/i.test(label) || i === 0) {
      await el.setInputFiles(resumePath).catch(() => unfilled.push(label || "resume upload"));
    }
  }

  const fields = page.locator(
    "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=radio]):not([type=checkbox]):not([type=file]), textarea, select"
  );
  const count = await fields.count();

  for (let i = 0; i < count; i++) {
    const el = fields.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    if (await el.isDisabled().catch(() => true)) continue;

    const tag = await el.evaluate((n) => n.tagName.toLowerCase());
    const label = await labelFor(el);
    if (!label) continue;

    // Never invent on sensitive topics — leave for human / saved answers only.
    if (needsPause(label)) {
      const savedKey = matchField(label);
      const fromProfile = savedKey ? profile.fields[savedKey] : null;
      const eeoKey = Object.keys(profile.eeo || {}).find((k) => label.toLowerCase().includes(k));
      const fromEeo = eeoKey ? profile.eeo![eeoKey] : null;
      const value = fromProfile || fromEeo;
      if (!value || /FILL_ME/i.test(value)) {
        unfilled.push(label);
        continue;
      }
      if (tag === "select") {
        await el.selectOption({ label: value }).catch(async () => {
          await el.selectOption({ value }).catch(() => unfilled.push(label));
        });
      } else {
        await el.fill(value).catch(() => unfilled.push(label));
      }
      continue;
    }

    const key = matchField(label);
    if (key && fieldsOff.has(key)) {
      unfilled.push(label);
      continue;
    }

    let value = key ? profile.fields[key] : null;
    if (value && /FILL_ME/i.test(value)) value = null;

    if (!value && tag === "textarea") {
      value = await getAnswer(label, job, profile);
      if (value) aiAnswers[label] = value;
    }

    if (!value) {
      unfilled.push(label);
      continue;
    }

    if (tag === "select") {
      await el.selectOption({ label: value }).catch(async () => {
        await el.selectOption({ value }).catch(() => unfilled.push(label));
      });
    } else {
      await el.fill(value).catch(() => unfilled.push(label));
    }
  }

  const radioResult = await fillRadiosAndCheckboxes(page, profile);
  unfilled.push(...radioResult.unfilled);

  return { unfilled, aiAnswers };
}
