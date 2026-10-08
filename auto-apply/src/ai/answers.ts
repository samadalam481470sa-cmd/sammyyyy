import fs from "node:fs";
import { findSavedAnswer } from "../queue/db";
import { callModel } from "./client";
import { paths } from "../paths";
import type { Profile } from "../filler/fillForm";

function loadBaseResume(): string {
  try {
    return fs.readFileSync(paths.baseResume, "utf8");
  } catch {
    return "";
  }
}

/**
 * Lookup order:
 * 1. Saved approved answers
 * 2. AI draft from profile/resume facts only (or NEEDS_HUMAN)
 * New AI drafts must go to review before first use (caller enforces).
 */
export async function getAnswer(question: string, job: any, profile: Profile): Promise<string | null> {
  const saved = findSavedAnswer(question);
  if (saved) return saved;

  const baseResume = loadBaseResume();
  const prompt = `You are filling one job application question for the applicant.
Use ONLY facts from the profile and resume below. Do not invent skills, numbers, or experience.
If the facts do not answer the question, reply with exactly: NEEDS_HUMAN
Keep the answer under 150 words, first person, plain sentences.

QUESTION: ${question}
COMPANY: ${job.company}
JOB TITLE: ${job.title}
JOB DESCRIPTION: ${String(job.description || "").slice(0, 4000)}
PROFILE: ${JSON.stringify(profile.fields)}
RESUME: ${baseResume}`;

  const answer = (await callModel(prompt)).trim();
  if (!answer || answer === "NEEDS_HUMAN") return null;
  return answer;
}
