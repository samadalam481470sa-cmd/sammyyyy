import { applicationShape } from "./applicationShape.js";
import { attachFileToInput } from "./dom.js";
import { normalize } from "./fuzzy.js";
import { buildDownloadable, profileCoverLetterText } from "./resumeFiles.js";
import { resolveResumeSource, resumeFileFromSource, type ResumeSourceExtras } from "./resumeSource.js";
import type { Profile } from "./types.js";

export type DocumentSlotKind = "resume" | "cover" | "unknown";
export type AttachButtonKind = "attach" | "manual" | "cloud" | "other";

const RESUME_HEAD =
  /^(resume\s*\/\s*cv|resume|cv|curriculum vitae)\b|\bresume\s*\/\s*cv\b|\bupload (your )?(resume|cv)\b/;
const COVER_HEAD = /\bcover\s*letter\b/;
const ATTACH =
  /^(attach|attach file|attach files|upload|upload file|upload files|add file|add files|select file|select files)$/;
const MANUAL = /^(enter manually|type (it )?manually|paste( resume| cv| text)?|enter text|add text)$/;
const CLOUD = /dropbox|google drive|onedrive|one drive|\bbox\b|icloud/;

export function classifyDocumentHeading(text: string): DocumentSlotKind {
  const n = normalize(text);
  if (COVER_HEAD.test(n) && !RESUME_HEAD.test(n.slice(0, 24))) return "cover";
  if (RESUME_HEAD.test(n) || /\b(resume|cv)\b/.test(n)) return "resume";
  if (COVER_HEAD.test(n)) return "cover";
  return "unknown";
}

export function classifyAttachButton(label: string): AttachButtonKind {
  const n = normalize(label);
  if (!n) return "other";
  if (CLOUD.test(n)) return "cloud";
  if (MANUAL.test(n)) return "manual";
  if (ATTACH.test(n) || /^attach$/.test(n)) return "attach";
  return "other";
}

export function slotLooksFilled(nearbyText: string): boolean {
  if (/\.(pdf|docx?|txt|rtf)\b/i.test(nearbyText || "")) return true;
  return /uploaded|attached|selected file|file added/.test(normalize(nearbyText));
}

export function fileMatchesAccept(fileName: string, accept: string): boolean {
  if (!accept || accept === "*") return true;
  const ext = (/\.([a-z0-9]+)$/i.exec(fileName)?.[1] || "").toLowerCase();
  const bits = accept.toLowerCase().split(/[, ]+/).filter(Boolean);
  if (!bits.length) return true;
  if (bits.some((b) => b === `.${ext}` || b.endsWith(`/${ext}`) || b.includes(ext))) return true;
  if (ext === "pdf" && bits.some((b) => /pdf/.test(b))) return true;
  return false;
}

export interface WidgetDocResult {
  did: boolean;
  detail: string;
  resumeAttached: boolean;
  resumePasted: boolean;
  coverAttached: boolean;
  coverPasted: boolean;
}

function fileFromPacked(name: string, mime: string, bytes: Uint8Array): File {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy], name, { type: mime });
}

function filesForProfile(profile: Profile, extras?: ResumeSourceExtras): { resume: File; cover: File; resumeText: string; coverText: string; from: string } {
  const source = resolveResumeSource(profile, extras);
  const packed = resumeFileFromSource(source, profile);
  const coverPacked = buildDownloadable(profile, "cover", "pdf");
  return {
    resume: fileFromPacked(packed.fileName, packed.mime, packed.bytes),
    cover: fileFromPacked(coverPacked.name, coverPacked.mime, coverPacked.bytes),
    resumeText: source.text || packed.text,
    coverText: profileCoverLetterText(profile) || coverPacked.text,
    from: source.from,
  };
}

function tidy(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function headingKind(el: HTMLElement): DocumentSlotKind {
  const own = tidy(el.getAttribute("aria-label") || el.innerText || el.textContent || "").slice(0, 80);
  return classifyDocumentHeading(own);
}

function nearestSlotKind(el: HTMLElement): DocumentSlotKind {
  let n: HTMLElement | null = el;
  for (let i = 0; i < 10 && n; i++, n = n.parentElement) {
    const kind = headingKind(n);
    if (kind !== "unknown") return kind;
    const labeled = n.getAttribute("aria-labelledby");
    if (labeled) {
      const lab = (el.ownerDocument || document).getElementById(labeled);
      if (lab) {
        const k = classifyDocumentHeading(lab.textContent || "");
        if (k !== "unknown") return k;
      }
    }
  }
  return "unknown";
}

function allFileInputs(doc: Document): HTMLInputElement[] {
  return [...doc.querySelectorAll("input[type=file]")].filter((n) => {
    const el = n as HTMLInputElement;
    return !el.disabled && el.type === "file";
  }) as HTMLInputElement[];
}

function inputsForKind(inputs: HTMLInputElement[], kind: DocumentSlotKind): HTMLInputElement[] {
  return inputs.filter((el) => {
    const blob = `${el.accept} ${el.name} ${el.id} ${el.getAttribute("data-automation-id") || ""} ${nearestSlotKind(el)}`;
    const slot = classifyDocumentHeading(blob) !== "unknown" ? classifyDocumentHeading(blob) : nearestSlotKind(el);
    if (kind === "unknown") return true;
    if (slot === "unknown") return kind === "resume";
    return slot === kind;
  });
}

function dropzones(doc: Document): HTMLElement[] {
  return [
    ...doc.querySelectorAll(
      "[data-automation-id*='file-upload'], [data-automation-id*='fileUpload'], [class*='dropzone'], [class*='file-upload'], [class*='FileUpload']"
    ),
  ].filter((n): n is HTMLElement => n instanceof HTMLElement);
}

function attachToInput(el: HTMLInputElement, file: File): boolean {
  if (el.files && el.files.length) return false;
  if (el.accept && !fileMatchesAccept(file.name, el.accept)) {
    const altName = file.name.replace(/\.pdf$/i, ".txt");
    if (el.accept && !fileMatchesAccept(altName, el.accept) && !fileMatchesAccept(file.name, el.accept)) {
      /* still try — many ATS ignore accept */
    }
  }
  return attachFileToInput(el, file);
}

function dropOnZone(zone: HTMLElement, file: File): boolean {
  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    zone.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }));
    zone.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
    zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    return true;
  } catch {
    return false;
  }
}

function clickables(doc: Document): HTMLElement[] {
  return [
    ...doc.querySelectorAll(
      "button, a[href], [role='button'], input[type=button], [data-automation-id], label"
    ),
  ].filter((n): n is HTMLElement => n instanceof HTMLElement);
}

function buttonLabel(el: HTMLElement): string {
  return tidy(el.getAttribute("aria-label") || el.getAttribute("value") || el.textContent || "");
}

function visibleEnough(el: HTMLElement): boolean {
  const s = window.getComputedStyle(el);
  if (el.hasAttribute("hidden") || (el as HTMLButtonElement).disabled) return false;
  if (s.display === "none" || s.visibility === "hidden") return false;
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2;
}

function findButtons(doc: Document, kind: AttachButtonKind, slot: DocumentSlotKind): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const el of clickables(doc)) {
    if (!visibleEnough(el)) continue;
    if (classifyAttachButton(buttonLabel(el)) !== kind) continue;
    const near = nearestSlotKind(el);
    if (slot !== "unknown" && near !== "unknown" && near !== slot) continue;
    out.push(el);
  }
  if (slot !== "unknown" && out.length > 1) {
    const tight = out.filter((el) => nearestSlotKind(el) === slot);
    if (tight.length) return tight;
  }
  return out;
}

function pasteInto(el: HTMLElement, text: string): boolean {
  if (!text.trim()) return false;
  try {
    if (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type !== "file")) {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      desc?.set?.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return Boolean(el.value);
    }
    if (el.isContentEditable) {
      el.focus();
      el.textContent = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
      return Boolean(tidy(el.innerText || ""));
    }
  } catch {
    return false;
  }
  return false;
}

function emptyTextTargets(doc: Document, slot: DocumentSlotKind): HTMLElement[] {
  const nodes = [
    ...doc.querySelectorAll("textarea, [contenteditable='true'], [contenteditable=''], input[type=text]"),
  ].filter((n): n is HTMLElement => n instanceof HTMLElement);
  return nodes.filter((el) => {
    if (!visibleEnough(el)) return false;
    const val =
      el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
        ? el.value
        : tidy(el.innerText || "");
    if (val.trim().length > 40) return false;
    const near = nearestSlotKind(el);
    return near === slot || near === "unknown";
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Click Attach / Enter manually, then inject the same resume we found in the
 * widget, PDF/DOCX, paste box, or saved library. Never opens Dropbox / Drive.
 */
export async function applyWidgetDocuments(
  doc: Document,
  profile: Profile,
  extras?: ResumeSourceExtras
): Promise<WidgetDocResult> {
  const files = filesForProfile(profile, extras);
  const result: WidgetDocResult = {
    did: false,
    detail: "",
    resumeAttached: false,
    resumePasted: false,
    coverAttached: false,
    coverPasted: false,
  };
  if (!files.resumeText && !files.resume.size) return result;

  const url = (doc.location && doc.location.href) || "";
  const shape = applicationShape(url, doc.body?.innerText?.slice(0, 2500) || "");

  const tryAttach = (kind: DocumentSlotKind, file: File): boolean => {
    const inputs = inputsForKind(allFileInputs(doc), kind);
    for (const el of inputs) {
      if (attachToInput(el, file)) return true;
    }
    for (const zone of dropzones(doc)) {
      if (kind !== "unknown" && nearestSlotKind(zone) !== "unknown" && nearestSlotKind(zone) !== kind) continue;
      if (dropOnZone(zone, file)) {
        const nearby = inputsForKind(allFileInputs(doc), kind);
        for (const el of nearby) {
          if (attachToInput(el, file)) return true;
        }
      }
    }
    return false;
  };

  const tryPaste = (kind: DocumentSlotKind, text: string): boolean => {
    for (const el of emptyTextTargets(doc, kind)) {
      if (pasteInto(el, text)) return true;
    }
    return false;
  };

  const clickFirst = async (kind: AttachButtonKind, slot: DocumentSlotKind): Promise<boolean> => {
    const btn = findButtons(doc, kind, slot)[0];
    if (!btn) return false;
    btn.scrollIntoView({ block: "nearest" });
    btn.click();
    await wait(shape.family === "workday" ? 160 : 120);
    return true;
  };

  const already = allFileInputs(doc).some((el) => el.files?.length && nearestSlotKind(el) !== "cover");
  if (already && slotLooksFilled(doc.body?.innerText?.slice(0, 4000) || "")) {
    result.resumeAttached = true;
  }

  if (!result.resumeAttached && !result.resumePasted) {
    const prefer = shape.preferResumeClick;
    if (prefer === "manual" || prefer === "auto") {
      if (await clickFirst("manual", "resume")) {
        result.resumePasted = tryPaste("resume", files.resumeText);
      }
    }
    if (!result.resumePasted && files.resumeText) {
      result.resumePasted = tryPaste("resume", files.resumeText);
    }
    result.resumeAttached = tryAttach("resume", files.resume) || tryAttach("unknown", files.resume);
    if (!result.resumeAttached && !result.resumePasted) {
      if (await clickFirst("attach", "resume")) {
        result.resumeAttached = tryAttach("resume", files.resume) || tryAttach("unknown", files.resume);
      }
      if (!result.resumePasted && (await clickFirst("manual", "resume"))) {
        result.resumePasted = tryPaste("resume", files.resumeText);
      }
    }
  }

  const coverNeeded = /cover\s*letter/i.test(doc.body?.innerText?.slice(0, 6000) || "");
  if (coverNeeded) {
    if (await clickFirst("manual", "cover")) {
      result.coverPasted = tryPaste("cover", files.coverText);
    }
    result.coverAttached = tryAttach("cover", files.cover);
    if (!result.coverAttached && !result.coverPasted && (await clickFirst("attach", "cover"))) {
      result.coverAttached = tryAttach("cover", files.cover);
    }
  }

  const bits = [
    result.resumeAttached ? `attached ${files.resume.name} (${files.from})` : "",
    result.resumePasted ? `pasted resume from ${files.from}` : "",
    result.coverAttached ? "attached cover letter" : "",
    result.coverPasted ? "pasted cover letter" : "",
  ].filter(Boolean);
  result.did = bits.length > 0;
  result.detail = bits.join(" · ") || "resume controls not ready";
  return result;
}
