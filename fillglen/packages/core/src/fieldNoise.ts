import { normalize } from "./fuzzy.js";
import type { FieldKind, FillPlan, Question, QuestionType } from "./types.js";

/** Native + custom ATS controls. Used to count fields before a full scan. */
export const FILLABLE_SELECTOR =
  "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=image]):not([type=reset]):not([type=range]), textarea, select, [role='combobox'], [role='listbox'], [role='textbox'], [role='searchbox'], [aria-haspopup='listbox'], [contenteditable='true'], [contenteditable='']";

const NOISE_LABEL =
  /progress scrubber|scrubber|slider|seek bar|volume|zoom|opacity|scroll|carousel|pagination|page indicator|step indicator|wizard progress|breadcrumb|toolbar|skip to content|main menu|side nav|navigation|cookie banner|chat widget|intercom|zendesk|media player|playback|timeline/;

const NAV_BLOBS =
  /general\s*information|information\s*documentation|documentation\s*comments|overview\s*details|my\s*account\s*settings/;

/** Chrome / ATS UI that is not an application question. */
export function isNoiseFieldLabel(label: string, name = ""): boolean {
  const raw = `${label || ""} ${name || ""}`.trim();
  const n = normalize(raw);
  if (!n || n === "unlabeled field" || n === "unlabeled" || n === "field") return true;
  if (NOISE_LABEL.test(n)) return true;
  if (NAV_BLOBS.test(n)) return true;
  // Concatenated tab strips (GeneralInformationDocumentation…)
  const compact = n.replace(/\s+/g, "");
  if (
    /generalinformation|informationdocumentation|documentationcommunity|documentationcomments|progressscrubber/.test(
      compact
    )
  ) {
    return true;
  }
  if (/^(general|information|documentation|comments|community|overview|details|home|profile|inbox)$/.test(n)) {
    return true;
  }
  // Lone digits / scrubber readouts (e.g. "0" on a progress control).
  if (/^\d{1,3}$/.test(n) && !/zip|phone|year|age|gpa|salary/.test(normalize(name))) return true;
  return false;
}

export function isNoiseAutomationId(id: string): boolean {
  const n = normalize(id);
  return /progress|scrubber|slider|tablist|tab bar|navigation|banner|footer|header|toolbar|menu bar|step indicator|wizardProgress|progressBar/.test(
    n
  );
}

export function isNoiseRole(role: string): boolean {
  const n = normalize(role);
  return /^(slider|progressbar|tab|tablist|navigation|banner|contentinfo|complementary|toolbar|scrollbar|presentation|none)$/.test(
    n
  );
}

/** Drop junk from a scanned question list before UI or fill sees it. */
export function filterRealQuestions(questions: Question[]): Question[] {
  return questions.filter((q) => isRealQuestion(q));
}

export function isRealQuestion(q: Pick<Question, "label" | "name" | "kind" | "type" | "required" | "options">): boolean {
  const unlabeled = /unlabeled/i.test(q.label);
  if (isNoiseFieldLabel(q.label, q.name || "") && !(q.required && unlabeled)) return false;
  if (q.type === "unknown" && !q.required && !q.options?.length && unlabeled) return false;
  // Long nav-like labels with no question mark are almost never form fields.
  if (q.type === "unknown" && q.kind === "text" && q.label.length > 90 && !/\?/.test(q.label)) return false;
  return true;
}

/** Gate a fill plan so chrome noise and empty unknowns never get injected. */
export function shouldAutofillPlan(
  plan: Pick<FillPlan, "value" | "confidence" | "type" | "source">,
  q?: Pick<Question, "label" | "name" | "kind" | "type" | "required" | "options" | "value" | "source"> | null
): boolean {
  if (!plan.value?.trim()) return false;
  if (q && !isRealQuestion(q)) return false;
  if (plan.type === "password") return false;
  if (q?.source === "user" && q.value) return false;
  if (q?.type === "unknown" && !q.required && !q.options?.length && plan.confidence !== "high" && plan.source !== "saved") return false;
  // Soft answers on unlabeled optional fields stay out of the auto path.
  if (plan.confidence === "check-this" && q && /unlabeled/i.test(q.label) && !q.required) return false;
  return true;
}

const TYPE_PRIORITY: Record<string, number> = {
  email: 100,
  phone: 95,
  firstName: 94,
  lastName: 93,
  fullName: 92,
  preferredName: 91,
  country: 90,
  zip: 89,
  state: 88,
  city: 87,
  location: 86,
  address: 85,
  workAuthorization: 85,
  visaSponsorship: 84,
  citizenship: 83,
  gender: 70,
  race: 69,
  veteran: 68,
  disability: 67,
  consent: 66,
  school: 60,
  degree: 59,
  major: 58,
  company: 57,
  jobTitle: 56,
  linkedin: 50,
  github: 49,
  portfolio: 48,
  website: 47,
  salary: 40,
  startDate: 39,
  remote: 38,
  relocation: 37,
};

/** Prefer required + high-confidence profile fields so each tick lands accurate values first. */
export function rankFillPlans(
  plans: FillPlan[],
  questions: Question[]
): FillPlan[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return [...plans].sort((a, b) => {
    const qa = byId.get(a.questionId);
    const qb = byId.get(b.questionId);
    const score = (p: FillPlan, q?: Question) => {
      let s = TYPE_PRIORITY[p.type] ?? (p.type === "unknown" ? 5 : 30);
      if (q?.required) s += 40;
      if (p.confidence === "high") s += 20;
      if (p.source === "profile") s += 10;
      else if (p.source === "saved") s += 6;
      if (q && fieldShouldPreferDropdown(q)) s += 4;
      return s;
    };
    return score(b, qb) - score(a, qa);
  });
}

function fieldShouldPreferDropdown(q: Question): boolean {
  return q.kind === "select" || q.kind === "custom-select" || q.kind === "typeahead" || Boolean(q.options?.length);
}

export function shouldScanControl(input: {
  tag: string;
  type?: string;
  role?: string;
  automationId?: string;
  ariaHaspopup?: string | null;
  contentEditable?: boolean;
}): boolean {
  const tag = input.tag.toLowerCase();
  if (tag === "input") {
    const t = (input.type || "text").toLowerCase();
    if (["hidden", "submit", "button", "image", "range", "color", "reset"].includes(t)) return false;
    return true;
  }
  if (tag === "textarea" || tag === "select") return true;
  if (input.contentEditable) return true;
  if (isNoiseRole(input.role || "")) return false;
  if (input.automationId && isNoiseAutomationId(input.automationId)) return false;
  const role = normalize(input.role || "");
  if (role === "combobox" || role === "listbox" || role === "textbox" || role === "searchbox") return true;
  if (input.ariaHaspopup === "listbox" || input.ariaHaspopup === "menu") return true;
  return false;
}

export function confidenceForScan(type: QuestionType, via: string, kind: FieldKind): "high" | "check-this" {
  if (via === "unknown" && kind === "text" && type === "unknown") return "check-this";
  if (via === "unknown") return "check-this";
  return "high";
}
