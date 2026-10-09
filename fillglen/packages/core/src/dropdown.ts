import { matchOption } from "./applyLoop.js";
import { normalize } from "./fuzzy.js";
import type { FieldKind, QuestionType } from "./types.js";

/** Question types that almost always render as a dropdown / multi-select, never free text. */
const DROPDOWN_TYPES = new Set<QuestionType>([
  "gender",
  "race",
  "veteran",
  "disability",
  "transgender",
  "sexualOrientation",
  "firstGeneration",
  "country",
  "state",
  "citizenship",
  "workAuthorization",
  "visaSponsorship",
  "relocation",
  "remote",
]);

export function isDropdownQuestionType(type: QuestionType): boolean {
  return DROPDOWN_TYPES.has(type);
}

export function isDropdownFieldKind(kind: FieldKind): boolean {
  return kind === "select" || kind === "custom-select" || kind === "typeahead";
}

/** Heuristic from attributes/classes — works across Workday, Greenhouse, React-Select, etc. */
export function dropdownHintsFromAttrs(input: {
  role?: string;
  ariaHaspopup?: string | null;
  ariaExpanded?: string | null;
  ariaAutocomplete?: string | null;
  automationId?: string | null;
  className?: string;
  tag?: string;
}): boolean {
  const role = normalize(input.role || "");
  if (role === "combobox" || role === "listbox") return true;
  if (input.tag === "select") return true;
  const popup = normalize(input.ariaHaspopup || "");
  if (popup === "listbox" || popup === "menu" || popup === "true") return true;
  const auto = normalize(input.ariaAutocomplete || "");
  if (auto === "list" || auto === "both") return true;
  if (input.ariaExpanded != null && input.ariaExpanded !== "") return true;
  const id = normalize(input.automationId || "");
  if (/select|dropdown|multiselect|combobox|promptoption|dropdown/.test(id)) return true;
  const cls = normalize(input.className || "");
  if (/select control|react select|dropdown|combobox|wd select|MuiSelect|ant select/.test(cls)) return true;
  return false;
}

/** Match a desired answer against currently visible option labels. */
export function pickVisibleOption(value: string, optionLabels: string[]): string | null {
  return matchOption(value, optionLabels);
}

export function optionLabelOf(node: { text?: string; ariaLabel?: string; title?: string }): string {
  return (node.ariaLabel || node.title || node.text || "").replace(/\s+/g, " ").trim().slice(0, 220);
}
