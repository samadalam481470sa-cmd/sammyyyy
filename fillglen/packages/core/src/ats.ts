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
  return /\/(apply|application|job-app|jobapp|candidateexperience|careers\/.+\/apply|cx\/job|requisition)(\/|$|\?)/i.test(
    url
  );
}

/**
 * True when this tab is a US job application (any ATS or a generic apply form).
 * LinkedIn is never treated as an application we may fill.
 */
export function looksLikeApplicationPage(url: string, bodyText = ""): boolean {
  if (isLinkedInHost(url)) return false;
  if (isKnownAtsHost(url)) return true;
  if (looksLikeApplyPath(url)) return true;
  const blob = bodyText.toLowerCase();
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
