import { isLinkedInHost } from "./linkedin.js";

/** Host suffixes for ATS products and career platforms commonly used on US job applications. */
export const US_ATS_HOSTS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "smartrecruiters.com",
  "icims.com",
  "myworkdayjobs.com",
  "myworkdaysite.com",
  "workday.com",
  "workdayjobs.com",
  "taleo.net",
  "successfactors.com",
  "successfactors.eu",
  "sapsf.com",
  "sapsf.eu",
  "oraclecloud.com",
  "jobs2web.com",
  "jobvite.com",
  "bamboohr.com",
  "workable.com",
  "recruitee.com",
  "paycomonline.net",
  "paylocity.com",
  "adp.com",
  "myadp.com",
  "ultipro.com",
  "ukg.net",
  "ukg.com",
  "dayforcehcm.com",
  "ceridian.com",
  "brassring.com",
  "kenexa.com",
  "phenom.com",
  "phenompeople.com",
  "eightfold.ai",
  "avature.net",
  "rippling.com",
  "comeet.com",
  "comeet.co",
  "jazzhr.com",
  "applytojob.com",
  "resumator.com",
  "applicantpro.com",
  "applicantstack.com",
  "hirebridge.com",
  "jobscore.com",
  "hrmdirect.com",
  "csod.com",
  "cornerstoneondemand.com",
  "silkroad.com",
  "pageuppeople.com",
  "njoyn.com",
  "smashfly.com",
  "gem.com",
  "freshteam.com",
  "zohorecruit.com",
  "teamtailor.com",
  "pinpointhq.com",
  "hireology.com",
  "jobappnetwork.com",
  "selectminds.com",
  "ultiprorecruiting.com",
  "peoplefluent.com",
  "clearcompany.com",
  "jobdiva.com",
  "pcrecruiter.net",
  "fountain.com",
  "workstream.us",
  "usajobs.gov",
  "apply.workable.com",
  "dover.com",
  "greenhouse.com",
  "myworkday.com",
  "workday.net",
  "icims.net",
  "smartrecruiters.com",
  "job-boards.greenhouse.io",
  "boards.greenhouse.io",
  "jobs.lever.co",
  "apply.lever.co",
  "jobs.ashbyhq.com",
  "app.ashbyhq.com",
  "jobs.smartrecruiters.com",
  "jobs.jobvite.com",
  "apply.jobvite.com",
  "boards.eu.greenhouse.io",
  "job-boards.eu.greenhouse.io",
  "apply.greenhouse.io",
  "myworkday.net",
  "workforcenow.adp.com",
  "recruiting.adp.com",
  "workdaycdn.com",
  "successfactors.cn",
  "oraclecloud.com",
  "taleo.com",
  "icims.com",
  "jobvite.net",
  "paycom.com",
  "paylocity.com",
  "bamboohr.com",
  "workable.com",
  "ashbyhq.com",
  "dover.io",
  "gem.com",
  "rippling.com",
  "greenhouse.io",
];

export function atsHostOf(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return US_ATS_HOSTS.find((h) => host === h || host.endsWith(`.${h}`)) || null;
  } catch {
    return null;
  }
}

export function isKnownAtsHost(url: string): boolean {
  return Boolean(atsHostOf(url));
}

export function looksLikeApplyPath(url: string): boolean {
  return (
    /\/(apply|application|applications|job-app|jobapp|jobapplication|applicationform|apply-job|applyjob|candidateexperience|candidate-application|careers\/.+\/apply|cx\/(e|job)|requisition|jobform|job-form|applynow|start-apply)(\/|$|\?)/i.test(
      url
    ) || /[?&](gh_jid|lever-source|ashby_jid|job_id|reqid)=/i.test(url)
  );
}

const FORM_COPY =
  /first name|last name|given name|family name|email address|phone number|phone country|upload (your )?resume|cover letter|work authorization|education|school name|linkedin url/;

const APPLICATION_SIGNALS: RegExp[] = [
  /first name|given name|legal first/,
  /last name|family name|surname/,
  /e-?mail/,
  /phone|mobile|cell/,
  /resume|curriculum vitae|\bcv\b/,
  /cover letter/,
  /work authorization|authorized to work|eligible to work/,
  /linkedin/,
  /\bzip\b|postal code|postcode/,
  /equal employment|\beeo\b|hispanic or latino|veteran status|disability/,
  /education|school name|university|degree/,
  /submit application|apply for this job|start application/,
  /phone country|country code|dialing code/,
  /current location|city,?\s*state/,
];

/** How many distinct application questions the page copy looks like it contains. */
export function applicationSignalCount(text: string): number {
  const blob = (text || "").toLowerCase();
  if (!blob) return 0;
  return APPLICATION_SIGNALS.filter((re) => re.test(blob)).length;
}

/** jobs.*, careers.*, apply.* and known ATS product hosts — not amazon.com checkout. */
export function hostLooksLikeCareers(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (/^(jobs|careers|apply|talent|hire|recruiting|go|boards|job-boards)\./.test(host)) return true;
    if (/\.(jobs|careers)$/.test(host)) return true;
    return /careers?|myworkday|greenhouse|lever|icims|taleo|workable|ashby|smartrecruiters|jobvite|successfactors|phenom|eightfold|bamboohr|workday|ultipro|paycom|paylocity|ukg|oraclecloud|brassring|avature|adp|workforcenow|applicantpro|jobappnetwork/.test(
      host
    );
  } catch {
    return false;
  }
}

/**
 * True when this tab is a job application — known ATS, /apply path, a real form,
 * or listing+Apply. LinkedIn is never treated as an application we may fill.
 */
export function looksLikeApplicationPage(
  url: string,
  bodyText = "",
  extras?: { fields?: number; files?: boolean }
): boolean {
  if (isLinkedInHost(url)) return false;
  if (isKnownAtsHost(url)) return true;
  if (hostLooksLikeCareers(url)) return true;
  if (looksLikeApplyPath(url)) return true;
  if (extras?.files) return true;
  const blob = bodyText.toLowerCase();
  const fields = extras?.fields ?? 0;
  const signals = applicationSignalCount(blob);
  const jobby = /apply|application|resume|\bcv\b|candidate|career|work authorization|cover letter|equal employment|education/.test(
    blob
  );
  if (fields >= 2 && signals >= 2 && jobby) return true;
  if (fields >= 8 && jobby) return true;
  if (signals >= 3 && jobby) return true;
  if (fields >= 12) return true;
  if (FORM_COPY.test(blob) && (blob.includes("apply") || blob.includes("resume") || blob.includes("application"))) {
    return true;
  }
  const hasIdentity = /first name|legal name|given name/.test(blob);
  const hasApply =
    /submit application|upload (your )?resume|work authorization|equal employment|voluntary self|apply for this job/.test(
      blob
    );
  if (hasIdentity && hasApply) return true;
  const listing =
    /job description|about (the|this) role|what you'll do|what you will do|we're hiring|we are hiring|qualifications/.test(
      blob
    );
  const applyCta = /apply now|start application|apply for this job|submit application/.test(blob);
  return listing && applyCta;
}

/** Cheap gate before storage I/O: run the keep loop on applications, not random sites. */
export function shouldKeepCycleOnPage(
  url: string,
  bodyText = "",
  extras?: { fields?: number; files?: boolean }
): boolean {
  if (!url) return false;
  if (isLinkedInHost(url)) return false;
  if (/accounts\.google\.com/i.test(url)) return true;
  return looksLikeApplicationPage(url, bodyText, extras);
}

/** Background keep-ticks: any http(s) tab except LinkedIn and obvious non-apply sites. */
export function looksLikeFillableTab(url: string): boolean {
  if (!url) return false;
  if (isLinkedInHost(url)) return false;
  if (/youtube\.com|facebook\.com|instagram\.com|mail\.google\.com|twitter\.com|x\.com\/home/i.test(url)) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
