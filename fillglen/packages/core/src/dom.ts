import { classifyQuestion } from "./classify.js";
import { classifyAdvanceLabel, isCaptchaChallengeFrame, matchOption, pageLooksLikeCaptcha } from "./applyLoop.js";
import { isFinalSubmitLabel, mayAutoClick } from "./submitGuard.js";
import { stableQuestionId } from "./questionId.js";
import { normalize } from "./fuzzy.js";
import type { FieldKind, Profile, Question } from "./types.js";

function visible(el: HTMLElement): boolean {
  const s = window.getComputedStyle(el);
  if (el.getAttribute("type") === "hidden") return false;
  if (el.hasAttribute("hidden") || (el as HTMLInputElement).disabled) return false;
  return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
}

function walkShadow(root: Document | ShadowRoot | HTMLElement, out: HTMLElement[]): void {
  const nodes = root.querySelectorAll("input, textarea, select, [role='combobox'], [role='listbox'], [data-automation-id]");
  nodes.forEach((n) => {
    if (n instanceof HTMLElement) out.push(n);
    const sr = (n as HTMLElement).shadowRoot;
    if (sr) walkShadow(sr, out);
  });
  root.querySelectorAll("*").forEach((n) => {
    if (n instanceof HTMLElement && n.shadowRoot) walkShadow(n.shadowRoot, out);
  });
}

function kindOf(el: HTMLElement): FieldKind {
  const role = el.getAttribute("role") || "";
  if (role === "combobox" || role === "listbox") return "custom-select";
  if (el instanceof HTMLSelectElement) return "select";
  if (el instanceof HTMLTextAreaElement) return "textarea";
  if (el instanceof HTMLInputElement) {
    if (el.type === "file") return "file";
    if (el.type === "radio") return "radio";
    if (el.type === "checkbox") return "checkbox";
    if (el.type === "date" || el.type === "month") return "date";
  }
  if (el.getAttribute("aria-autocomplete") === "list") return "typeahead";
  return "text";
}

function labelFor(el: HTMLElement): string {
  const id = el.id;
  if (id) {
    const byFor = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (byFor?.textContent) return byFor.textContent.trim();
  }
  const wrap = el.closest("label");
  if (wrap?.textContent) return wrap.textContent.trim().replace(/\s+/g, " ").slice(0, 200);
  const aria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
  if (aria && !el.getAttribute("aria-labelledby")) return aria;
  if (el.getAttribute("aria-labelledby")) {
    const ids = el.getAttribute("aria-labelledby")!.split(/\s+/);
    const text = ids
      .map((i) => document.getElementById(i)?.textContent || "")
      .join(" ")
      .trim();
    if (text) return text;
  }
  const prev = el.closest("div, li, fieldset")?.querySelector("label, legend, span, p");
  return (el.getAttribute("placeholder") || prev?.textContent || el.getAttribute("name") || "").trim().slice(0, 200);
}

export function scanDocument(doc: Document, frameId = "top", profile?: Profile): Question[] {
  const found: HTMLElement[] = [];
  walkShadow(doc, found);
  const questions: Question[] = [];
  let position = 0;
  for (const el of found) {
    if (!visible(el)) continue;
    if (el instanceof HTMLInputElement && ["hidden", "submit", "button", "image"].includes(el.type)) continue;
    const controlLabel = el.getAttribute("value") || el.textContent || "";
    if (isFinalSubmitLabel(controlLabel) || classifyAdvanceLabel(controlLabel)) continue;
    const label = labelFor(el);
    if (!label && kindOf(el) === "text" && !(el instanceof HTMLInputElement)) continue;
    const classified = classifyQuestion(
      {
        label,
        name: el.getAttribute("name") || el.id,
        placeholder: el.getAttribute("placeholder") || undefined,
        inputType: el instanceof HTMLInputElement ? el.type : undefined,
        autocomplete: el.getAttribute("autocomplete") || undefined,
      },
      profile?.answers
    );
    const value =
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
        ? el.value
        : (el.textContent || "").trim();
    const required = el.hasAttribute("required") || el.getAttribute("aria-required") === "true" || /\*/.test(label);
    const options =
      el instanceof HTMLSelectElement ? Array.from(el.options).map((o) => o.text) : undefined;
    questions.push({
      id: stableQuestionId({ label, name: el.getAttribute("name") || el.id, position, frameId }),
      label: label || "(unlabeled field)",
      required,
      kind: kindOf(el),
      type: classified.type,
      value,
      source: value ? "user" : "none",
      status: value ? "filled" : "needs-you",
      confidence: classified.via === "unknown" ? "check-this" : "high",
      frameId,
      name: el.getAttribute("name") || el.id,
      placeholder: el.getAttribute("placeholder") || undefined,
      options,
      position,
    });
    el.setAttribute("data-fillglen-id", questions[questions.length - 1].id);
    position += 1;
  }
  return questions;
}

function nativeSet(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function setFieldById(id: string, value: string): { ok: boolean; readBack: string; error?: string } {
  const el = document.querySelector(`[data-fillglen-id="${CSS.escape(id)}"]`) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | null;
  if (!el) return { ok: false, readBack: "", error: "Field left the page." };
  try {
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      const label = labelFor(el);
      const hit = matchOption(value, [el.value, label, el.getAttribute("aria-label") || ""]);
      const on = Boolean(hit);
      el.checked = on;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      if (el.type === "radio" && on) el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    } else if (el instanceof HTMLSelectElement) {
      const texts = Array.from(el.options).map((o) => o.text);
      const picked = matchOption(value, texts);
      const match = picked
        ? Array.from(el.options).find((o) => o.text === picked || normalize(o.text) === normalize(picked))
        : Array.from(el.options).find((o) => o.value.toLowerCase() === value.toLowerCase());
      nativeSet(el, match ? match.value : value);
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    } else {
      nativeSet(el, value);
      openAndPickCustom(el, value);
    }
    const readBack =
      el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")
        ? String(el.checked)
        : el.value;
    const invalid = !el.checkValidity?.() || el.getAttribute("aria-invalid") === "true";
    if (invalid) return { ok: false, readBack, error: el.validationMessage || "Site rejected this value." };
    return { ok: true, readBack };
  } catch (err) {
    return { ok: false, readBack: "", error: err instanceof Error ? err.message : String(err) };
  }
}

export function flashAndScroll(id: string): void {
  const el = document.querySelector(`[data-fillglen-id="${CSS.escape(id)}"]`) as HTMLElement | null;
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const prev = el.style.outline;
  el.style.outline = "3px solid #d9763a";
  setTimeout(() => {
    el.style.outline = prev;
  }, 1200);
}

function openAndPickCustom(el: HTMLElement, value: string): boolean {
  el.click();
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  const options = [
    ...document.querySelectorAll("[role='option'], [role='listbox'] li, [data-test='select-option']"),
  ] as HTMLElement[];
  const texts = options.map((o) => (o.textContent || "").trim()).filter(Boolean);
  const picked = matchOption(value, texts);
  if (!picked) return false;
  const node = options.find((o) => normalize(o.textContent || "") === normalize(picked) || (o.textContent || "").trim() === picked);
  if (!node) return false;
  node.click();
  node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  return true;
}

export function clickMatchingDropdown(id: string, value: string): boolean {
  const el = document.querySelector(`[data-fillglen-id="${CSS.escape(id)}"]`) as HTMLElement | null;
  if (!el) return false;
  if (el instanceof HTMLSelectElement) {
    const result = setFieldById(id, value);
    return result.ok;
  }
  return openAndPickCustom(el, value);
}

export function detectCaptcha(doc: Document): boolean {
  const challengeFrames = [...doc.querySelectorAll("iframe")].filter((f) => {
    const r = f.getBoundingClientRect();
    return isCaptchaChallengeFrame(f.src || "", r.width, r.height);
  });
  if (challengeFrames.length) return true;
  return pageLooksLikeCaptcha(doc.body?.innerText?.slice(0, 4000) || "", []);
}

export function findAdvanceControl(
  doc: Document,
  mode: "fill-only" | "keep-applying" = "fill-only"
): { el: HTMLElement; kind: "next" | "submit"; label: string } | null {
  const els = [
    ...doc.querySelectorAll("button, a, input[type=button], input[type=submit], [role='button']"),
  ] as HTMLElement[];
  const labeled = els
    .filter(visible)
    .map((el) => ({
      el,
      label: (el.getAttribute("value") || el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim(),
    }))
    .filter((x) => x.label && classifyAdvanceLabel(x.label));
  const next = labeled.find((x) => classifyAdvanceLabel(x.label) === "next");
  const submit = labeled.find((x) => classifyAdvanceLabel(x.label) === "submit");
  if (next) return { ...next, kind: "next" };
  if (submit && mayAutoClick(submit.label, mode)) return { ...submit, kind: "submit" };
  return null;
}

export function clickAdvance(mode: "fill-only" | "keep-applying" = "fill-only"): { kind: "next" | "submit" } | null {
  const found = findAdvanceControl(document, mode);
  if (!found) return null;
  found.el.scrollIntoView({ block: "center" });
  found.el.click();
  return { kind: found.kind };
}

export function readWorkdayStep(): { label: string; index?: number; total?: number } {
  const progress = document.querySelector("[data-automation-id='progressBar'], [data-automation-id='wizardProgress']");
  const heading = document.querySelector("h1, h2, [data-automation-id='pageHeader']");
  const text = (progress?.textContent || heading?.textContent || "").replace(/\s+/g, " ").trim();
  const m = /(?:step\s*)?(\d+)\s*(?:of|\/)\s*(\d+)/i.exec(text);
  return { label: text.slice(0, 80), index: m ? Number(m[1]) : undefined, total: m ? Number(m[2]) : undefined };
}
