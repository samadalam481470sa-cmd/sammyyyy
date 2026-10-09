import { firstEmailInText, isConsentLabel, isGoogleSignInLabel } from "./answers.js";
import {
  classifyAppliedBeforeChoice,
  classifyAuthGate,
  pickAuthGate,
  type AuthGateAction,
} from "./authGate.js";
import { classifyQuestion } from "./classify.js";
import { classifyAdvanceLabel, isCaptchaChallengeFrame, matchOption, pageLooksLikeCaptcha } from "./applyLoop.js";
import {
  dropdownHintsFromAttrs,
  isDropdownFieldKind,
  isDropdownQuestionType,
  optionLabelOf,
  pickVisibleOption,
} from "./dropdown.js";
import {
  filterRealQuestions,
  isNoiseFieldLabel,
  shouldScanControl,
} from "./fieldNoise.js";
import {
  classifyScreenControl,
  controlFingerprint,
  KEEP_SLOW_CHAR_MS,
  pickScreenAction,
  type FillPace,
} from "./screenAct.js";
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
  // Tight selector — do not grab every data-automation-id / aria-expanded (progress scrubbers, tab strips).
  const nodes = root.querySelectorAll(
    "input, textarea, select, [role='combobox'], [role='listbox'], [role='textbox'], [aria-haspopup='listbox'], [aria-haspopup='menu'], [contenteditable='true'], [contenteditable='']"
  );
  nodes.forEach((n) => {
    if (!(n instanceof HTMLElement)) return;
    if (
      !shouldScanControl({
        tag: n.tagName,
        type: n instanceof HTMLInputElement ? n.type : undefined,
        role: n.getAttribute("role") || undefined,
        automationId: n.getAttribute("data-automation-id") || undefined,
        ariaHaspopup: n.getAttribute("aria-haspopup"),
        contentEditable: n.isContentEditable,
      })
    ) {
      return;
    }
    out.push(n);
    const sr = n.shadowRoot;
    if (sr) walkShadow(sr, out);
  });
  root.querySelectorAll("*").forEach((n) => {
    if (n instanceof HTMLElement && n.shadowRoot) walkShadow(n.shadowRoot, out);
  });
}

function walkClickables(root: Document | ShadowRoot | HTMLElement, out: HTMLElement[]): void {
  const nodes = root.querySelectorAll(
    "button, a, input[type=button], input[type=submit], input[type=reset], [role='button'], [role='link'], [role='menuitem'], [role='tab'], [role='switch'], label, [data-automation-id]"
  );
  nodes.forEach((n) => {
    if (n instanceof HTMLElement) out.push(n);
    const sr = (n as HTMLElement).shadowRoot;
    if (sr) walkClickables(sr, out);
  });
  root.querySelectorAll("*").forEach((n) => {
    if (n instanceof HTMLElement && n.shadowRoot) walkClickables(n.shadowRoot, out);
  });
}

function kindOf(el: HTMLElement): FieldKind {
  if (el instanceof HTMLSelectElement) return "select";
  if (el instanceof HTMLTextAreaElement) return "textarea";
  if (el instanceof HTMLInputElement) {
    if (el.type === "file") return "file";
    if (el.type === "radio") return "radio";
    if (el.type === "checkbox") return "checkbox";
    if (el.type === "date" || el.type === "month") return "date";
  }
  if (
    dropdownHintsFromAttrs({
      role: el.getAttribute("role") || undefined,
      ariaHaspopup: el.getAttribute("aria-haspopup"),
      ariaExpanded: el.getAttribute("aria-expanded"),
      ariaAutocomplete: el.getAttribute("aria-autocomplete"),
      automationId: el.getAttribute("data-automation-id"),
      className: typeof el.className === "string" ? el.className : "",
      tag: el.tagName.toLowerCase(),
    })
  ) {
    return el.getAttribute("aria-autocomplete") === "list" || el.getAttribute("aria-autocomplete") === "both"
      ? "typeahead"
      : "custom-select";
  }
  if (el.isContentEditable) return "textarea";
  return "text";
}

function elementLooksLikeDropdown(el: HTMLElement): boolean {
  return isDropdownFieldKind(kindOf(el));
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
    if (isNoiseFieldLabel(label || "", el.getAttribute("name") || el.id || "")) continue;
    if (el instanceof HTMLInputElement && el.type === "range") continue;
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
    } else if (el.isContentEditable) {
      value = tidy(el.innerText || el.textContent || "");
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
  return filterRealQuestions(questions);
}

function nativeSet(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function setContentEditable(el: HTMLElement, value: string): string {
  el.focus();
  el.textContent = value;
  el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return tidy(el.innerText || el.textContent || "");
}

export function setFieldById(id: string, value: string): { ok: boolean; readBack: string; error?: string } {
  const el = document.querySelector(`[data-fillglen-id="${CSS.escape(id)}"]`) as HTMLElement | null;
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
      pickNativeSelect(el, value);
    } else if (elementLooksLikeDropdown(el)) {
      // Open the menu and click the choice — do not type into the field.
      openAndPickCustom(el, value);
    } else if (el.isContentEditable) {
      setContentEditable(el, value);
    } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      nativeSet(el, value);
    } else {
      openAndPickCustom(el, value);
    }
    const readBack =
      el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")
        ? String(el.checked)
        : el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
          ? el.value
          : tidy(el.innerText || el.textContent || "");
    const formEl = el as HTMLInputElement;
    const invalid =
      (typeof formEl.checkValidity === "function" && !formEl.checkValidity()) ||
      el.getAttribute("aria-invalid") === "true";
    if (invalid) return { ok: false, readBack, error: formEl.validationMessage || "Site rejected this value." };
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

function pointerClick(el: HTMLElement): void {
  try {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  } catch {
    /* detached */
  }
  el.focus?.();
  const opts: MouseEventInit = { bubbles: true, cancelable: true, view: window, buttons: 1 };
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"] as const) {
    el.dispatchEvent(type.startsWith("pointer") ? new PointerEvent(type, { ...opts, pointerType: "mouse" }) : new MouseEvent(type, opts));
  }
}

function pickNativeSelect(el: HTMLSelectElement, value: string): boolean {
  const texts = Array.from(el.options).map((o) => o.text);
  const picked = pickVisibleOption(value, texts);
  const opt = picked
    ? Array.from(el.options).find((o) => o.text === picked || normalize(o.text) === normalize(picked))
    : Array.from(el.options).find((o) => normalize(o.value) === normalize(value));
  if (!opt) return false;
  el.focus();
  for (const o of Array.from(el.options)) o.selected = false;
  opt.selected = true;
  el.selectedIndex = opt.index;
  // Some ATS listen for click on the <option> itself.
  try {
    opt.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    opt.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    opt.click();
  } catch {
    /* option.click unsupported */
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function findDropdownTrigger(el: HTMLElement): HTMLElement {
  if (
    el.getAttribute("role") === "combobox" ||
    el.getAttribute("aria-haspopup") ||
    el.getAttribute("aria-expanded") != null ||
    el instanceof HTMLButtonElement
  ) {
    return el;
  }
  const wrap =
    el.closest(
      "[role='combobox'], [aria-haspopup], [aria-expanded], [data-automation-id*='select'], [data-automation-id*='Select'], [class*='select'], [class*='Select']"
    ) || el.parentElement;
  if (wrap instanceof HTMLElement && wrap !== el) {
    const btn = wrap.querySelector(
      "button, [role='button'], [role='combobox'], [aria-haspopup], [class*='indicator'], [class*='arrow'], [class*='caret'], [data-automation-id*='icon'], [data-automation-id*='arrow']"
    ) as HTMLElement | null;
    if (btn && visible(btn)) return btn;
    if (dropdownHintsFromAttrs({
      role: wrap.getAttribute("role") || undefined,
      ariaHaspopup: wrap.getAttribute("aria-haspopup"),
      ariaExpanded: wrap.getAttribute("aria-expanded"),
      automationId: wrap.getAttribute("data-automation-id"),
      className: typeof wrap.className === "string" ? wrap.className : "",
      tag: wrap.tagName.toLowerCase(),
    })) {
      return wrap;
    }
  }
  return el;
}

const OPTION_SELECTORS = [
  "[role='option']",
  "[role='treeitem']",
  "[role='menuitem']",
  "[role='menuitemradio']",
  "[role='listbox'] li",
  "[role='listbox'] > div",
  "[role='menu'] li",
  "[data-automation-id='promptOption']",
  "[data-automation-id*='promptOption']",
  "[data-automation-id*='PromptOption']",
  "[data-uxi-widget-type='selectoption']",
  "[data-test='select-option']",
  ".select__option",
  "[class*='select__option']",
  "[class*='SelectOption']",
  "[class*='dropdown-option']",
  "[class*='DropdownOption']",
  "li[data-value]",
  "div[data-value][tabindex]",
];

function collectOpenOptions(root: ParentNode = document): HTMLElement[] {
  const out: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  const push = (n: Element) => {
    if (!(n instanceof HTMLElement) || seen.has(n)) return;
    if (!visible(n)) return;
    const label = optionLabelOf({
      text: n.textContent || "",
      ariaLabel: n.getAttribute("aria-label") || undefined,
      title: n.getAttribute("title") || undefined,
    });
    if (!label || label.length > 280) return;
    if (/^select( one)?$|^choose|^please select$/i.test(label)) return;
    seen.add(n);
    out.push(n);
  };
  for (const sel of OPTION_SELECTORS) {
    root.querySelectorAll(sel).forEach(push);
  }
  if (root instanceof Document || root instanceof ShadowRoot || root instanceof HTMLElement) {
    root.querySelectorAll("*").forEach((n) => {
      if (n instanceof HTMLElement && n.shadowRoot) {
        for (const opt of collectOpenOptions(n.shadowRoot)) push(opt);
      }
    });
  }
  return out;
}

async function waitForOpenOptions(timeoutMs = 900): Promise<HTMLElement[]> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const opts = collectOpenOptions();
    if (opts.length) return opts;
    await new Promise((r) => setTimeout(r, 40));
  }
  return collectOpenOptions();
}

function clickOptionNode(node: HTMLElement): void {
  pointerClick(node);
  const inner = node.querySelector(
    "[data-automation-id='promptOption'], div, span, label"
  ) as HTMLElement | null;
  if (inner && inner !== node && visible(inner)) pointerClick(inner);
}

/** Sync best-effort: open menu and click a matching option (no typing). */
function openAndPickCustom(el: HTMLElement, value: string): boolean {
  if (el instanceof HTMLSelectElement) return pickNativeSelect(el, value);
  const trigger = findDropdownTrigger(el);
  pointerClick(trigger);
  trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  const options = collectOpenOptions();
  const texts = options.map((o) =>
    optionLabelOf({
      text: o.textContent || "",
      ariaLabel: o.getAttribute("aria-label") || undefined,
      title: o.getAttribute("title") || undefined,
    })
  );
  const picked = pickVisibleOption(value, texts);
  if (!picked) return false;
  const node = options.find((o) => {
    const t = optionLabelOf({
      text: o.textContent || "",
      ariaLabel: o.getAttribute("aria-label") || undefined,
      title: o.getAttribute("title") || undefined,
    });
    return normalize(t) === normalize(picked) || t === picked;
  });
  if (!node) return false;
  clickOptionNode(node);
  return true;
}

/**
 * Open a dropdown of any shape/size, wait for options, and click the matching
 * choice. Never types the answer into the control.
 */
export async function selectDropdownById(id: string, value: string): Promise<boolean> {
  const el = document.querySelector(`[data-fillglen-id="${CSS.escape(id)}"]`) as HTMLElement | null;
  if (!el) return false;
  if (el instanceof HTMLSelectElement) return pickNativeSelect(el, value);
  if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) {
    return setFieldById(id, value).ok;
  }

  const trigger = findDropdownTrigger(el);
  // Clear any typed filter text that might have been left in a combobox input.
  if (el instanceof HTMLInputElement && el.value && elementLooksLikeDropdown(el)) {
    try {
      nativeSet(el, "");
    } catch {
      /* ignore */
    }
  }

  pointerClick(trigger);
  await new Promise((r) => setTimeout(r, 50));
  trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));

  let options = await waitForOpenOptions(950);
  if (!options.length) {
    const wrap = el.closest("div, li, fieldset, section") || el.parentElement;
    const alts = wrap
      ? ([
          ...wrap.querySelectorAll(
            "button, [role='button'], [role='combobox'], [aria-haspopup], [class*='indicator'], [class*='Dropdown'], [data-automation-id*='icon'], [data-automation-id*='arrow']"
          ),
        ] as HTMLElement[])
      : [];
    for (const alt of alts) {
      if (!visible(alt) || alt === trigger) continue;
      pointerClick(alt);
      options = await waitForOpenOptions(700);
      if (options.length) break;
    }
  }

  const texts = options.map((o) =>
    optionLabelOf({
      text: o.textContent || "",
      ariaLabel: o.getAttribute("aria-label") || undefined,
      title: o.getAttribute("title") || undefined,
    })
  );
  const picked = pickVisibleOption(value, texts);
  if (!picked) {
    // Last resort for typeaheads that filter on keypress — type only to filter, then still click.
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      nativeSet(el, value.slice(0, 24));
      options = await waitForOpenOptions(700);
      const filtered = options.map((o) =>
        optionLabelOf({
          text: o.textContent || "",
          ariaLabel: o.getAttribute("aria-label") || undefined,
          title: o.getAttribute("title") || undefined,
        })
      );
      const again = pickVisibleOption(value, filtered);
      if (again) {
        const node = options.find((o) => {
          const t = optionLabelOf({
            text: o.textContent || "",
            ariaLabel: o.getAttribute("aria-label") || undefined,
            title: o.getAttribute("title") || undefined,
          });
          return normalize(t) === normalize(again);
        });
        if (node) {
          clickOptionNode(node);
          await new Promise((r) => setTimeout(r, 40));
          return true;
        }
      }
    }
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  }

  const node = options.find((o) => {
    const t = optionLabelOf({
      text: o.textContent || "",
      ariaLabel: o.getAttribute("aria-label") || undefined,
      title: o.getAttribute("title") || undefined,
    });
    return normalize(t) === normalize(picked) || t === picked;
  });
  if (!node) return false;
  clickOptionNode(node);
  await new Promise((r) => setTimeout(r, 50));
  // Close leftover menus so the next dropdown can open cleanly.
  document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  return true;
}

export async function clickMatchingDropdown(id: string, value: string): Promise<boolean> {
  return selectDropdownById(id, value);
}

export function fieldShouldUseDropdown(kind: FieldKind, type: Question["type"]): boolean {
  return isDropdownFieldKind(kind) || isDropdownQuestionType(type);
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
  const labeled = clickableControls(doc)
    .filter((el) => visible(el) && isInnermostClickable(el))
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

function clickableControls(doc: Document): HTMLElement[] {
  const found: HTMLElement[] = [];
  walkClickables(doc, found);
  const seen = new Set<HTMLElement>();
  const out: HTMLElement[] = [];
  for (const el of found) {
    if (seen.has(el)) continue;
    seen.add(el);
    out.push(el);
  }
  return out;
}

function isInnermostClickable(el: HTMLElement): boolean {
  return !el.querySelector("button, a[href], [role='button'], input[type=button], input[type=submit]");
}

function controlLabel(el: HTMLElement): string {
  return tidy(el.getAttribute("value") || el.getAttribute("aria-label") || el.getAttribute("data-automation-id") || el.textContent || "");
}

function automationAction(el: HTMLElement): AuthGateAction | null {
  const id = normalize(el.getAttribute("data-automation-id") || "");
  if (!id) return null;
  if (/lastapplication|previousapplication|useinforfromlast|autofillwithlast|applywithlast/.test(id)) {
    return "last-application";
  }
  if (/createaccount|signup|register|newuser|startnewapplication|createnewaccount/.test(id)) return "create-account";
  if (/signin|loginlink|signInLink/i.test(el.getAttribute("data-automation-id") || "") || /signin|loginlink/.test(id)) {
    return "sign-in";
  }
  if (/guestapply|continueasguest/.test(id)) return "guest";
  return classifyAuthGate(id.replace(/[_-]+/g, " "));
}

export function collectAuthButtons(doc: Document): { el: HTMLElement; label: string; action: AuthGateAction }[] {
  const out: { el: HTMLElement; label: string; action: AuthGateAction }[] = [];
  const seen = new Set<HTMLElement>();
  for (const el of clickableControls(doc)) {
    if (!visible(el) || seen.has(el)) continue;
    const label = controlLabel(el);
    const action = classifyAuthGate(label) || automationAction(el);
    if (!action) continue;
    seen.add(el);
    out.push({ el, label: label || action, action });
  }
  return out;
}

export function clickAuthGate(
  doc: Document,
  returning: boolean,
  canSignIn = true
): { action: AuthGateAction; label: string } | null {
  const buttons = collectAuthButtons(doc);
  const picked = pickAuthGate(
    buttons.map((b) => ({ label: b.label, action: b.action })),
    returning,
    canSignIn
  );
  if (!picked) return null;
  const node = buttons.find((b) => b.action === picked.action && normalize(b.label) === normalize(picked.label)) || buttons.find((b) => b.action === picked.action);
  if (!node) return null;
  node.el.scrollIntoView({ block: "nearest" });
  node.el.click();
  return { action: picked.action, label: node.label };
}

export function clickAppliedBefore(doc: Document, returning: boolean): "yes" | "no" | null {
  const want = returning ? "yes" : "no";
  const radios = [...doc.querySelectorAll("input[type=radio], input[type=checkbox]")] as HTMLInputElement[];
  for (const el of radios) {
    if (!visible(el)) continue;
    const choice = classifyAppliedBeforeChoice(optionText(el) || labelFor(el) || el.value);
    if (choice !== want) continue;
    if (!el.checked) el.click();
    return choice;
  }
  for (const el of clickableControls(doc)) {
    if (!visible(el)) continue;
    const choice = classifyAppliedBeforeChoice(controlLabel(el));
    if (choice !== want) continue;
    el.click();
    return choice;
  }
  return null;
}

export function findFileInputs(doc: Document): HTMLInputElement[] {
  return [...doc.querySelectorAll("input[type=file]")].filter((n) => {
    const el = n as HTMLInputElement;
    if (el.disabled) return false;
    const s = window.getComputedStyle(el);
    return s.display !== "none";
  }) as HTMLInputElement[];
}

export function attachFileToInput(el: HTMLInputElement, file: File): boolean {
  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    el.files = dt.files;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return Boolean(el.files?.length);
  } catch {
    return false;
  }
}

export function clickScreenAction(
  doc: Document,
  skip: string[] = []
): { label: string; fingerprint: string } | null {
  const buttons: { el: HTMLElement; label: string; automationId: string }[] = [];
  for (const el of clickableControls(doc)) {
    if (!visible(el) || !isInnermostClickable(el)) continue;
    const label = controlLabel(el);
    const automationId = el.getAttribute("data-automation-id") || "";
    if (classifyAdvanceLabel(label)) continue;
    if (classifyAuthGate(label) || automationAction(el)) continue;
    if (classifyScreenControl(label, automationId) !== "act") continue;
    buttons.push({ el, label, automationId });
  }
  const picked = pickScreenAction(
    buttons.map((b) => ({ label: b.label, automationId: b.automationId })),
    skip
  );
  if (!picked) return null;
  const node =
    buttons.find((b) => controlFingerprint(b.label, b.automationId) === picked.fingerprint) ||
    buttons.find((b) => normalize(b.label) === normalize(picked.label));
  if (!node) return null;
  node.el.scrollIntoView({ block: "nearest" });
  node.el.click();
  return { label: node.label, fingerprint: picked.fingerprint };
}

export async function setFieldPaced(
  id: string,
  value: string,
  pace: FillPace = "fast"
): Promise<{ ok: boolean; readBack: string; error?: string }> {
  const el = document.querySelector(`[data-fillglen-id="${CSS.escape(id)}"]`) as HTMLElement | null;
  if (!el) return { ok: false, readBack: "", error: "Field left the page." };
  // Dropdowns: open + click the option. Never character-type into a select.
  if (el instanceof HTMLSelectElement || elementLooksLikeDropdown(el)) {
    const ok = await selectDropdownById(id, value);
    const readBack =
      el instanceof HTMLSelectElement
        ? el.options[el.selectedIndex]?.text || el.value
        : tidy(el.getAttribute("aria-label") || el.textContent || (el as HTMLInputElement).value || value);
    return { ok, readBack: readBack || value, error: ok ? undefined : "Could not open dropdown and select that option." };
  }
  if (pace !== "slow") return setFieldById(id, value);
  if (
    el.isContentEditable ||
    (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio" || el.type === "file" || el.type === "password"))
  ) {
    return setFieldById(id, value);
  }
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    return setFieldById(id, value);
  }
  nativeSet(el, "");
  let acc = "";
  for (const ch of value) {
    acc += ch;
    nativeSet(el, acc);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: ch, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { key: ch, bubbles: true }));
    await new Promise((r) => setTimeout(r, KEEP_SLOW_CHAR_MS));
  }
  return { ok: true, readBack: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : value };
}

export function fillBoardLogin(doc: Document, email: string, password: string): { filledEmail: boolean; filledPassword: boolean } {
  const inputs = [...doc.querySelectorAll("input")] as HTMLInputElement[];
  let filledEmail = false;
  let filledPassword = false;
  for (const el of inputs) {
    if (!visible(el)) continue;
    const t = (el.type || "text").toLowerCase();
    const auto = (el.getAttribute("autocomplete") || "").toLowerCase();
    const blob = normalize(`${labelFor(el)} ${el.name || ""} ${el.id || ""} ${auto} ${el.placeholder || ""}`);
    if (t === "password" || auto.includes("password") || /password|passcode/.test(blob)) {
      el.setAttribute("autocomplete", /current|sign.?in|log.?in/.test(blob) ? "current-password" : "new-password");
      nativeSet(el, password);
      filledPassword = true;
      continue;
    }
    if (!email) continue;
    if (t === "email" || auto.includes("username") || auto.includes("email") || /e-?mail|username|user name|sign in id|login id/.test(blob)) {
      el.setAttribute("autocomplete", "username");
      nativeSet(el, email);
      filledEmail = true;
    }
  }
  return { filledEmail, filledPassword };
}
