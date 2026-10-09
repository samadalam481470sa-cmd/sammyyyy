import { firstEmailInText, isConsentLabel, isGoogleSignInLabel } from "./answers.js";
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
  const nodes = root.querySelectorAll(
    "input, textarea, select, [role='combobox'], [role='listbox'], [aria-haspopup='listbox'], [data-automation-id]"
  );
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

function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 220);
}

export function labelFor(el: HTMLElement): string {
  const id = el.id;
  if (id) {
    const byFor = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (byFor?.textContent) return tidy(byFor.textContent);
  }
  const wrap = el.closest("label");
  if (wrap?.textContent) return tidy(wrap.textContent);
  const aria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
  if (aria && !el.getAttribute("aria-labelledby")) return tidy(aria);
  if (el.getAttribute("aria-labelledby")) {
    const ids = el.getAttribute("aria-labelledby")!.split(/\s+/);
    const text = ids
      .map((i) => document.getElementById(i)?.textContent || "")
      .join(" ")
      .trim();
    if (text) return tidy(text);
  }
  const prev = el.closest("div, li, fieldset")?.querySelector("label, legend, span, p");
  return tidy(el.getAttribute("placeholder") || prev?.textContent || el.getAttribute("name") || "");
}

export function groupLabel(el: HTMLElement): string {
  const legend = el.closest("fieldset")?.querySelector("legend");
  if (legend?.textContent) return tidy(legend.textContent);
  const field = el.closest(".field, .application-question, [class*='question'], [class*='Question']");
  const heading = field?.querySelector(":scope > label, :scope > h3, :scope > h4, :scope > .label");
  if (heading?.textContent) return tidy(heading.textContent);
  return labelFor(el);
}

function optionText(el: HTMLInputElement): string {
  const wrap = el.closest("label");
  if (wrap?.textContent) return tidy(wrap.textContent);
  const next = el.nextElementSibling;
  if (next?.textContent) return tidy(next.textContent);
  return tidy(el.getAttribute("aria-label") || el.value || "");
}

export function scanDocument(doc: Document, frameId = "top", profile?: Profile): Question[] {
  const found: HTMLElement[] = [];
  walkShadow(doc, found);
  const questions: Question[] = [];
  const seenRadio = new Set<string>();
  let position = 0;
  for (const el of found) {
    if (!visible(el)) continue;
    if (el instanceof HTMLInputElement && ["hidden", "submit", "button", "image"].includes(el.type)) continue;
    const controlLabel = el.getAttribute("value") || el.textContent || "";
    if (isFinalSubmitLabel(controlLabel) || classifyAdvanceLabel(controlLabel)) continue;
    if (el instanceof HTMLInputElement && el.type === "radio") {
      const key = el.name || el.id || `radio-${position}`;
      if (seenRadio.has(key)) continue;
      seenRadio.add(key);
    }
    const isRadio = el instanceof HTMLInputElement && el.type === "radio";
    const radioGroup = isRadio
      ? ((el.name
          ? [...doc.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`)]
          : [el]) as HTMLInputElement[])
      : [];
    const label = isRadio ? groupLabel(el) : el instanceof HTMLSelectElement ? groupLabel(el) : labelFor(el);
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
    let value = "";
    let options: string[] | undefined;
    if (isRadio) {
      options = radioGroup.map(optionText);
      const checked = radioGroup.find((r) => r.checked);
      value = checked ? optionText(checked) : "";
    } else if (el instanceof HTMLInputElement && el.type === "checkbox") {
      value = el.checked ? optionText(el) || "Yes" : "";
    } else if (el instanceof HTMLSelectElement) {
      options = Array.from(el.options).map((o) => o.text);
      value = el.options[el.selectedIndex]?.text || el.value;
    } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      value = el.value;
    } else {
      value = tidy(el.textContent || "");
    }
    const required =
      el.hasAttribute("required") ||
      el.getAttribute("aria-required") === "true" ||
      radioGroup.some((r) => r.hasAttribute("required") || r.getAttribute("aria-required") === "true") ||
      /\*/.test(label);
    const id = stableQuestionId({ label, name: el.getAttribute("name") || el.id, position, frameId });
    questions.push({
      id,
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
    const stamp = [el, ...radioGroup];
    for (const node of stamp) node.setAttribute("data-fillglen-id", id);
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
    if (el instanceof HTMLInputElement && el.type === "radio") {
      const group = (el.name
        ? ([...document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`)] as HTMLInputElement[])
        : [el]);
      const texts = group.map(optionText);
      const picked = matchOption(value, texts);
      const node = group.find((r) => {
        const t = optionText(r);
        return picked
          ? normalize(t) === normalize(picked) || t === picked
          : normalize(t) === normalize(value) || r.value === value;
      });
      if (node && !node.checked) node.click();
      else if (node) {
        node.checked = true;
        node.dispatchEvent(new Event("input", { bubbles: true }));
        node.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } else if (el instanceof HTMLInputElement && el.type === "checkbox") {
      const label = labelFor(el);
      const hit =
        isConsentLabel(label) ||
        isConsentLabel(value) ||
        /^(true|yes|on|1)$/i.test(value) ||
        Boolean(matchOption(value, [el.value, label, optionText(el), "Yes"]));
      if (hit !== el.checked) el.click();
      else {
        el.checked = hit;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
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
  if (el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox"))) {
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
  found.el.scrollIntoView({ block: "nearest" });
  found.el.click();
  return { kind: found.kind };
}

export function clickGoogleSignIn(doc: Document): boolean {
  const els = [...doc.querySelectorAll("button, a, [role='button'], div[role='link']")] as HTMLElement[];
  for (const el of els) {
    if (!visible(el)) continue;
    const label = tidy(el.getAttribute("aria-label") || el.getAttribute("value") || el.textContent || "");
    if (!isGoogleSignInLabel(label)) continue;
    el.click();
    return true;
  }
  return false;
}

export function clickVisibleGoogleAccount(doc: Document): boolean {
  const identified = [...doc.querySelectorAll("[data-identifier], [data-email]")] as HTMLElement[];
  const rows = identified.filter((el) => {
    if (!visible(el)) return false;
    const ident = el.getAttribute("data-identifier") || el.getAttribute("data-email") || "";
    const text = el.textContent || "";
    if (/use another account|add account/.test(normalize(text))) return false;
    return ident.includes("@") || Boolean(firstEmailInText(text));
  });
  const target = rows[0];
  if (target) {
    target.click();
    return true;
  }
  const fallback = [...doc.querySelectorAll("div[role='link'], li, button")] as HTMLElement[];
  const withEmail = fallback
    .filter((el) => visible(el) && firstEmailInText(el.textContent || "") && !/use another account|add account/.test(normalize(el.textContent || "")))
    .sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
  if (!withEmail[0]) return false;
  withEmail[0].click();
  return true;
}

export function readWorkdayStep(): { label: string; index?: number; total?: number } {
  const progress = document.querySelector("[data-automation-id='progressBar'], [data-automation-id='wizardProgress']");
  const heading = document.querySelector("h1, h2, [data-automation-id='pageHeader']");
  const text = (progress?.textContent || heading?.textContent || "").replace(/\s+/g, " ").trim();
  const m = /(?:step\s*)?(\d+)\s*(?:of|\/)\s*(\d+)/i.exec(text);
  return { label: text.slice(0, 80), index: m ? Number(m[1]) : undefined, total: m ? Number(m[2]) : undefined };
}
