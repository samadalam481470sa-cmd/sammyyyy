import { matchNewJobs } from "../queue/db";
import { loadRules, scoreJob } from "./score";

export function runMatching(): number {
  const rules = loadRules();
  const n = matchNewJobs((job) => scoreJob(job, rules), rules.minScore);
  console.log(`Matched ${n} job(s) (minScore ${rules.minScore}).`);
  return n;
}

if (require.main === module) {
  runMatching();
}
