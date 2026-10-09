import { atsHostOf, isKnownAtsHost, looksLikeApplyPath } from "./ats.js";
import type { BoardAdapter, JobMeta } from "./types.js";

function meta(
  board: string,
  url: string,
  extra: Partial<JobMeta> & { heading?: string; bodyText?: string } = {}
): JobMeta {
  return {
    company: extra.company || guessCompany(url),
    title: extra.title || extra.heading || "",
    board,
    url,
    description: extra.description || extra.bodyText || "",
    stepLabel: extra.stepLabel,
    stepIndex: extra.stepIndex,
    stepTotal: extra.stepTotal,
  };
}

function hostAdapter(id: string, pattern: RegExp, waitAfterResumeMs = 1800): BoardAdapter {
  return {
    id,
    waitAfterResumeMs,
    detect(url) {
      return pattern.test(url);
    },
    readJobMeta({ url, title, heading, bodyText }) {
      return meta(id, url, { title: heading || title, description: bodyText });
    },
  };
}

function guessCompany(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    if (host.includes("greenhouse.io")) {
      const sub = parts[0];
      return sub === "boards" || sub === "job-boards" ? "" : sub;
    }
    if (host.endsWith("lever.co")) return parts[0] === "jobs" ? parts[0] : parts[0];
    return parts[0];
  } catch {
    return "";
  }
}

export const greenhouseAdapter: BoardAdapter = {
  id: "greenhouse",
  waitAfterResumeMs: 1500,
  detect(url) {
    return /greenhouse\.io/i.test(url);
  },
  readJobMeta({ url, title, heading, bodyText }) {
    return meta("Greenhouse", url, { title: heading || title, description: bodyText });
  },
};

export const leverAdapter: BoardAdapter = {
  id: "lever",
  waitAfterResumeMs: 2500,
  detect(url) {
    return /lever\.co/i.test(url);
  },
  readJobMeta({ url, title, heading, bodyText }) {
    return meta("Lever", url, { title: heading || title, description: bodyText });
  },
};

export const ashbyAdapter: BoardAdapter = {
  id: "ashby",
  waitAfterResumeMs: 1200,
  detect(url) {
    return /ashbyhq\.com/i.test(url);
  },
  readJobMeta({ url, title, heading, bodyText }) {
    return meta("Ashby", url, { title: heading || title, description: bodyText });
  },
};

export const smartRecruitersAdapter: BoardAdapter = {
  id: "smartrecruiters",
  waitAfterResumeMs: 1800,
  detect(url) {
    return /smartrecruiters\.com/i.test(url);
  },
  readJobMeta({ url, title, heading, bodyText }) {
    return meta("SmartRecruiters", url, { title: heading || title, description: bodyText });
  },
};

export const icimsAdapter: BoardAdapter = {
  id: "icims",
  waitAfterResumeMs: 2000,
  detect(url) {
    return /icims\.com/i.test(url);
  },
  readJobMeta({ url, title, heading, bodyText }) {
    return meta("iCIMS", url, { title: heading || title, description: bodyText });
  },
};

export const workdayAdapter: BoardAdapter = {
  id: "workday",
  waitAfterResumeMs: 2200,
  detect(url) {
    return /myworkdayjobs\.com|myworkdaysite\.com|workdayjobs\.com|workday\.com/i.test(url);
  },
  readJobMeta({ url, title, heading, bodyText }) {
    const step = /step\s+(\d+)\s+of\s+(\d+)/i.exec(bodyText || title || "");
    return meta("Workday", url, {
      title: heading || title,
      description: bodyText,
      stepIndex: step ? Number(step[1]) : undefined,
      stepTotal: step ? Number(step[2]) : undefined,
      stepLabel: heading,
    });
  },
};

export const taleoAdapter = hostAdapter("taleo", /taleo\.net/i, 2000);
export const successFactorsAdapter = hostAdapter(
  "successfactors",
  /successfactors\.(com|eu)|sapsf\.(com|eu)/i,
  2000
);
export const oracleCloudAdapter = hostAdapter("oracle-cloud", /oraclecloud\.com|jobs2web\.com/i, 2000);
export const jobviteAdapter = hostAdapter("jobvite", /jobvite\.com/i);
export const bambooHrAdapter = hostAdapter("bamboohr", /bamboohr\.com/i);
export const workableAdapter = hostAdapter("workable", /workable\.com/i);
export const recruiteeAdapter = hostAdapter("recruitee", /recruitee\.com/i);
export const paycomAdapter = hostAdapter("paycom", /paycomonline\.net/i);
export const paylocityAdapter = hostAdapter("paylocity", /paylocity\.com/i);
export const adpAdapter = hostAdapter("adp", /adp\.com|myadp\.com/i, 2000);
export const ukgAdapter = hostAdapter("ukg", /ultipro\.com|ukg\.(net|com)|ultiprorecruiting\.com/i, 2000);
export const dayforceAdapter = hostAdapter("dayforce", /dayforcehcm\.com|ceridian\.com/i);
export const brassringAdapter = hostAdapter("brassring", /brassring\.com|kenexa\.com/i, 2000);
export const phenomAdapter = hostAdapter("phenom", /phenom(people)?\.com/i);
export const eightfoldAdapter = hostAdapter("eightfold", /eightfold\.ai/i);
export const avatureAdapter = hostAdapter("avature", /avature\.net/i, 2000);
export const ripplingAdapter = hostAdapter("rippling", /rippling\.com/i);
export const comeetAdapter = hostAdapter("comeet", /comeet\.co(m)?/i);
export const jazzHrAdapter = hostAdapter("jazzhr", /jazzhr\.com|applytojob\.com|resumator\.com/i);
export const applicantProAdapter = hostAdapter("applicantpro", /applicantpro\.com|applicantstack\.com/i);
export const hirebridgeAdapter = hostAdapter("hirebridge", /hirebridge\.com/i);
export const jobscoreAdapter = hostAdapter("jobscore", /jobscore\.com/i);
export const hrmDirectAdapter = hostAdapter("hrmdirect", /hrmdirect\.com/i);
export const cornerstoneAdapter = hostAdapter("cornerstone", /csod\.com|cornerstoneondemand\.com/i, 2000);
export const silkroadAdapter = hostAdapter("silkroad", /silkroad\.com/i);
export const pageupAdapter = hostAdapter("pageup", /pageuppeople\.com/i);
export const njoynAdapter = hostAdapter("njoyn", /njoyn\.com/i);
export const smashflyAdapter = hostAdapter("smashfly", /smashfly\.com/i);
export const gemAdapter = hostAdapter("gem", /gem\.com/i);
export const zohoAdapter = hostAdapter("zoho", /zohorecruit\.com|freshteam\.com/i);
export const teamtailorAdapter = hostAdapter("teamtailor", /teamtailor\.com/i);
export const pinpointAdapter = hostAdapter("pinpoint", /pinpointhq\.com/i);
export const hireologyAdapter = hostAdapter("hireology", /hireology\.com/i);
export const jobAppNetworkAdapter = hostAdapter("jobappnetwork", /jobappnetwork\.com/i);
export const selectmindsAdapter = hostAdapter("selectminds", /selectminds\.com/i);
export const peoplefluentAdapter = hostAdapter("peoplefluent", /peoplefluent\.com/i);
export const clearCompanyAdapter = hostAdapter("clearcompany", /clearcompany\.com/i);
export const jobdivaAdapter = hostAdapter("jobdiva", /jobdiva\.com/i);
export const pcRecruiterAdapter = hostAdapter("pcrecruiter", /pcrecruiter\.net/i);
export const fountainAdapter = hostAdapter("fountain", /fountain\.com/i);
export const workstreamAdapter = hostAdapter("workstream", /workstream\.us/i);
export const usaJobsAdapter = hostAdapter("usajobs", /usajobs\.gov/i, 2000);

export const genericAtsAdapter: BoardAdapter = {
  id: "ats",
  waitAfterResumeMs: 1600,
  detect(url) {
    return isKnownAtsHost(url) || looksLikeApplyPath(url);
  },
  readJobMeta({ url, title, heading, bodyText }) {
    return meta(atsHostOf(url) || "ats", url, { title: heading || title, description: bodyText });
  },
};

export const ADAPTERS: BoardAdapter[] = [
  greenhouseAdapter,
  leverAdapter,
  ashbyAdapter,
  smartRecruitersAdapter,
  icimsAdapter,
  workdayAdapter,
  taleoAdapter,
  successFactorsAdapter,
  oracleCloudAdapter,
  jobviteAdapter,
  bambooHrAdapter,
  workableAdapter,
  recruiteeAdapter,
  paycomAdapter,
  paylocityAdapter,
  adpAdapter,
  ukgAdapter,
  dayforceAdapter,
  brassringAdapter,
  phenomAdapter,
  eightfoldAdapter,
  avatureAdapter,
  ripplingAdapter,
  comeetAdapter,
  jazzHrAdapter,
  applicantProAdapter,
  hirebridgeAdapter,
  jobscoreAdapter,
  hrmDirectAdapter,
  cornerstoneAdapter,
  silkroadAdapter,
  pageupAdapter,
  njoynAdapter,
  smashflyAdapter,
  gemAdapter,
  zohoAdapter,
  teamtailorAdapter,
  pinpointAdapter,
  hireologyAdapter,
  jobAppNetworkAdapter,
  selectmindsAdapter,
  peoplefluentAdapter,
  clearCompanyAdapter,
  jobdivaAdapter,
  pcRecruiterAdapter,
  fountainAdapter,
  workstreamAdapter,
  usaJobsAdapter,
];

export function adapterFor(url: string): BoardAdapter | null {
  return ADAPTERS.find((a) => a.detect(url)) ?? (genericAtsAdapter.detect(url) ? genericAtsAdapter : null);
}

export function isSupportedApplyUrl(url: string): boolean {
  return Boolean(adapterFor(url));
}
