import { adapterFor } from "./adapters.js";
import { normalize } from "./fuzzy.js";

export type ApplicationFamily =
  | "workday"
  | "enterprise"
  | "standard"
  | "basic"
  | "generic";

export interface ApplicationShape {
  family: ApplicationFamily;
  board: string;
  multiStep: boolean;
  fieldsPerTick: number;
  waitAfterResumeMs: number;
  preferResumeClick: "manual" | "attach" | "auto";
  complexity: number;
}

const ENTERPRISE =
  /myworkdayjobs|myworkdaysite|workdayjobs|successfactors|sapsf|taleo\.net|icims\.com|oraclecloud|jobs2web|phenom|eightfold|brassring|kenexa|avature|csod\.com|ukg\.(net|com)|ultipro|adp\.com/;
const STANDARD = /greenhouse\.io|lever\.co|ashbyhq|smartrecruiters|jobvite|bamboohr/;
const BASIC = /fountain\.com|workstream\.us|jazzhr|applytojob|workable\.com|recruitee|teamtailor/;

const STRONG_TITLE =
  /\b(senior|staff|principal|lead|architect|manager|director|sre|site reliability|platform|security engineer|cloud engineer|systems engineer)\b/;
const BASIC_TITLE =
  /\b(intern|help desk|cashier|barista|receptionist|warehouse|crew member|retail associate|associate i|entry level)\b/;

export function applicationFamily(url: string, bodyText = ""): ApplicationFamily {
  const blob = `${url} ${bodyText}`.toLowerCase();
  if (/myworkdayjobs|myworkdaysite|workdayjobs/.test(blob)) return "workday";
  if (ENTERPRISE.test(blob)) return "enterprise";
  if (STANDARD.test(blob)) return "standard";
  if (BASIC.test(blob)) return "basic";
  const adapter = adapterFor(url);
  if (adapter?.id === "workday") return "workday";
  if (adapter && ["icims", "taleo", "successfactors", "oracle-cloud", "phenom", "eightfold"].includes(adapter.id)) {
    return "enterprise";
  }
  return "generic";
}

export function applicationShape(url: string, bodyText = ""): ApplicationShape {
  const family = applicationFamily(url, bodyText);
  const adapter = adapterFor(url);
  const board = adapter?.id || family;
  if (family === "workday") {
    return {
      family,
      board,
      multiStep: true,
      fieldsPerTick: 3,
      waitAfterResumeMs: adapter?.waitAfterResumeMs || 2200,
      preferResumeClick: "manual",
      complexity: 88,
    };
  }
  if (family === "enterprise") {
    return {
      family,
      board,
      multiStep: true,
      fieldsPerTick: 3,
      waitAfterResumeMs: adapter?.waitAfterResumeMs || 2000,
      preferResumeClick: "auto",
      complexity: 80,
    };
  }
  if (family === "standard") {
    return {
      family,
      board,
      multiStep: /step\s+\d+\s+of\s+[3-9]/i.test(bodyText),
      fieldsPerTick: 4,
      waitAfterResumeMs: adapter?.waitAfterResumeMs || 1500,
      preferResumeClick: "attach",
      complexity: 55,
    };
  }
  if (family === "basic") {
    return {
      family,
      board,
      multiStep: false,
      fieldsPerTick: 6,
      waitAfterResumeMs: 800,
      preferResumeClick: "attach",
      complexity: 28,
    };
  }
  return {
    family,
    board,
    multiStep: /step\s+\d+\s+of\s+[3-9]/i.test(bodyText),
    fieldsPerTick: 4,
    waitAfterResumeMs: 1400,
    preferResumeClick: "auto",
    complexity: 40,
  };
}

/** Boost multi-step enterprise ATS and stronger titles; demote basic one-page roles. */
export function jobComplexityBoost(url: string, title: string, source = ""): { boost: number; why: string } {
  const shape = applicationShape(url);
  const n = normalize(`${title} ${source}`);
  let boost = Math.round((shape.complexity - 50) / 4);
  let why = shape.multiStep || shape.family === "workday" || shape.family === "enterprise" ? "multi-step ATS" : "standard board";
  if (STRONG_TITLE.test(n)) {
    boost += 14;
    why = "stronger role on a real ATS";
  }
  if (BASIC_TITLE.test(n)) {
    boost -= 22;
    why = "basic listing";
  }
  if (shape.family === "basic") boost -= 8;
  return { boost, why };
}

export function isBasicListing(title: string, url = ""): boolean {
  return BASIC_TITLE.test(normalize(title)) || applicationFamily(url) === "basic";
}
