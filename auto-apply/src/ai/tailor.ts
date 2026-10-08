import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { paths, ensureDataDirs } from "../paths";
import { callModel } from "./client";
import type { Job } from "../discovery/types";
import type { Profile } from "../filler/fillForm";

export async function renderPdf(html: string, outPath: string) {
  ensureDataDirs();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.pdf({ path: outPath, format: "Letter", printBackground: true });
  } finally {
    await browser.close();
  }
}

/**
 * Tailor resume HTML for a job. Without an AI key, returns the base resume
 * unchanged (still rendered to a clean per-job PDF filename). With AI, may
 * reorder emphasis but must not invent experience.
 */
export async function tailorResume(job: Job, profile: Profile): Promise<string> {
  ensureDataDirs();
  const base = fs.readFileSync(paths.baseResume, "utf8");
  const outDir = path.join(paths.generated, job.id.replace(/[^a-zA-Z0-9_-]/g, "_"));
  fs.mkdirSync(outDir, { recursive: true });
  const fileName = profile.resumeFileName || "Samad-Alam-Resume.pdf";
  const outPath = path.join(outDir, fileName);

  let html = base;
  if (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
    const prompt = `Rewrite this resume HTML for the role below.
Rules:
- You may reorder bullets and emphasize matching skills already present.
- You may NOT add skills, tools, metrics, employers, titles, or dates that are not already in the resume.
- Return ONLY the full HTML document.

ROLE: ${job.title} at ${job.company}
DESCRIPTION: ${job.description.slice(0, 4000)}

RESUME HTML:
${base}`;
    const drafted = await callModel(prompt);
    if (drafted && drafted !== "NEEDS_HUMAN" && /<html/i.test(drafted)) {
      html = drafted;
    }
  }

  await renderPdf(html, outPath);
  fs.writeFileSync(path.join(outDir, "resume.html"), html);
  return outPath;
}

export async function writeCoverLetter(job: Job, profile: Profile): Promise<string> {
  ensureDataDirs();
  const outDir = path.join(paths.generated, job.id.replace(/[^a-zA-Z0-9_-]/g, "_"));
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "Samad-Alam-Cover-Letter.pdf");

  const name = profile.fields.fullName || `${profile.fields.firstName} ${profile.fields.lastName}`.trim();
  let body = `Dear ${job.company} Hiring Team,

I am applying for the ${job.title} role. My background includes ${profile.fields.skills || "the skills listed on my resume"}, and I am currently ${profile.fields.currentCompany ? `at ${profile.fields.currentCompany}` : "building experience as a software engineer intern"}.

[ADD 1-2 SENTENCES about why this specific role or company interests you.]

Thank you for your time.

Best regards,
${name}`;

  if (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
    const base = fs.existsSync(paths.baseResume) ? fs.readFileSync(paths.baseResume, "utf8") : "";
    const prompt = `Write a cover letter under 300 words for this applicant.
Use ONLY facts from the profile and resume. Do not invent. Include a [BRACKETED] placeholder for a personal note about the company.
Return plain text only.

ROLE: ${job.title} at ${job.company}
DESCRIPTION: ${job.description.slice(0, 3000)}
PROFILE: ${JSON.stringify(profile.fields)}
RESUME: ${base.slice(0, 4000)}`;
    const drafted = await callModel(prompt);
    if (drafted && drafted !== "NEEDS_HUMAN") body = drafted;
  }

  const html = `<!DOCTYPE html><html><body style="font-family:Georgia,serif;margin:48px;font-size:11pt;white-space:pre-wrap;">${body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</body></html>`;
  await renderPdf(html, outPath);
  fs.writeFileSync(path.join(outDir, "cover-letter.txt"), body);
  return outPath;
}
