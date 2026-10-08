import rules from "../data/matching-rules.json" with { type: "json" };

export function isLinkedInHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "linkedin.com" || host.endsWith(".linkedin.com");
  } catch {
    return /linkedin\.com/i.test(url);
  }
}

export function isLinkedInEasyApply(url: string, pageText = ""): boolean {
  if (!isLinkedInHost(url)) return false;
  const u = url.toLowerCase();
  const copy = pageText.toLowerCase();
  if (rules.linkedinEasyApply.pathHints.some((h) => u.includes(h.toLowerCase()))) return true;
  if (rules.linkedinEasyApply.copyHints.some((h) => copy.includes(h))) return true;
  return /linkedin\.com\/jobs\//i.test(url);
}

/** Fillglen never attaches to LinkedIn Easy Apply. Public LinkedIn viewing is also skipped. */
export function shouldBlockPage(url: string, pageText = ""): "linkedin-easy-apply" | null {
  if (isLinkedInEasyApply(url, pageText) || isLinkedInHost(url)) return "linkedin-easy-apply";
  return null;
}
