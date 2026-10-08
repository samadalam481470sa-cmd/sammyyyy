import { scoreJob, loadRules } from "../matching/score";
import { writeCoverLetter, tailorResume } from "../ai/tailor";
import { saveApplication, setStatus } from "../queue/db";
import { notify } from "../notify/notify";
import type { Job } from "../discovery/types";
import type { Profile } from "../filler/fillForm";

export async function handleUnsupported(job: Job, profile: Profile) {
  const score = scoreJob(job, loadRules());
  const resumePath = await tailorResume(job, profile);
  const coverLetterPath = await writeCoverLetter(job, profile);
  saveApplication(job.id, { resumePath, coverLetterPath, outcome: "unsupported" });
  setStatus(job.id, "unsupported", `score ${score}`);
  await notify(
    `Apply by hand: ${job.title} at ${job.company}, score ${score}. Resume and cover letter are ready. ${job.url}`
  );
}
