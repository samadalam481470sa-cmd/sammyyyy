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
    return /myworkdayjobs\.com|workday\.com/i.test(url);
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

export const ADAPTERS: BoardAdapter[] = [
  greenhouseAdapter,
  leverAdapter,
  ashbyAdapter,
  smartRecruitersAdapter,
  icimsAdapter,
  workdayAdapter,
];

export function adapterFor(url: string): BoardAdapter | null {
  return ADAPTERS.find((a) => a.detect(url)) ?? null;
}

export function isSupportedApplyUrl(url: string): boolean {
  return Boolean(adapterFor(url)) || /\/(apply|application)(\/|$|\?)/i.test(url);
}
