import { base64ToBytes, buildDownloadable, extOf, mimeForName, profileResumeText } from "./resumeFiles.js";
import { normalize } from "./fuzzy.js";
import type { DocumentFile, Profile } from "./types.js";

export type ResumeOrigin = "pdf" | "docx" | "txt" | "paste" | "profile" | "library";

export interface ResumeSourceExtras {
  paste?: string;
  library?: string[];
}

export interface ResumeSource {
  text: string;
  fileName: string;
  mime: string;
  bytes: Uint8Array | null;
  from: ResumeOrigin;
}

function docHasPayload(d: DocumentFile): boolean {
  return Boolean((d.base64 && d.base64.length > 20) || (d.text && d.text.trim().length > 40));
}

function originForName(name: string, mime = ""): ResumeOrigin {
  const ext = extOf(name);
  if (ext === "pdf" || /pdf/i.test(mime)) return "pdf";
  if (ext === "docx" || ext === "doc" || /word/i.test(mime)) return "docx";
  if (ext === "txt" || ext === "rtf") return "txt";
  return "profile";
}

function fromDocument(doc: DocumentFile): ResumeSource {
  const name = doc.name || "resume.pdf";
  const mime = doc.mime || mimeForName(name);
  return {
    text: (doc.text || "").trim(),
    fileName: name,
    mime,
    bytes: doc.base64 ? base64ToBytes(doc.base64) : null,
    from: originForName(name, mime),
  };
}

function looksLikeResumeBlob(text: string): boolean {
  const n = normalize(text);
  if (n.length < 40) return false;
  return /experience|education|skills|engineer|developer|resume|curriculum|vitae/.test(n);
}

/**
 * Walk the widget, uploaded docs/PDF, pasted text, then saved library/DB answers
 * until we find the resume the applicant actually provided.
 */
export function resolveResumeSource(profile: Profile, extras: ResumeSourceExtras = {}): ResumeSource {
  const docs = profile.documents || [];
  const pdf = docs.find((d) => d.kind === "master-resume" && docHasPayload(d) && originForName(d.name, d.mime) === "pdf");
  if (pdf) return fromDocument(pdf);
  const master = docs.find((d) => d.kind === "master-resume" && docHasPayload(d));
  if (master) return fromDocument(master);
  const tailored = docs.find((d) => d.kind === "tailored-resume" && docHasPayload(d));
  if (tailored) return fromDocument(tailored);
  const anyDoc = docs.find((d) => d.kind !== "cover-letter" && docHasPayload(d));
  if (anyDoc) return fromDocument(anyDoc);

  const paste = (extras.paste || "").trim();
  if (paste.length > 40) {
    return { text: paste, fileName: "resume.txt", mime: "text/plain", bytes: null, from: "paste" };
  }
  if ((profile.rawResumeText || "").trim().length > 40) {
    return {
      text: profile.rawResumeText.trim(),
      fileName: "resume.txt",
      mime: "text/plain",
      bytes: null,
      from: "paste",
    };
  }

  const library = [
    ...(extras.library || []),
    ...profile.answers
      .filter((a) => /resume|cv|curriculum/i.test(a.pattern) || looksLikeResumeBlob(a.answer))
      .map((a) => a.answer),
  ];
  const libHit = library.find((t) => looksLikeResumeBlob(t));
  if (libHit) {
    return { text: libHit.trim(), fileName: "resume.txt", mime: "text/plain", bytes: null, from: "library" };
  }

  const synthesized = profileResumeText(profile);
  if (synthesized.length > 20) {
    const packed = buildDownloadable(profile, "resume", "pdf");
    return { text: synthesized, fileName: packed.name, mime: packed.mime, bytes: packed.bytes, from: "profile" };
  }
  return { text: "", fileName: "resume.pdf", mime: "application/pdf", bytes: null, from: "profile" };
}

export function resumeFileFromSource(source: ResumeSource, profile: Profile): { fileName: string; mime: string; bytes: Uint8Array; text: string } {
  if (source.bytes && source.bytes.byteLength > 20) {
    return { fileName: source.fileName, mime: source.mime, bytes: source.bytes, text: source.text };
  }
  const packed = buildDownloadable(
    { ...profile, rawResumeText: source.text || profile.rawResumeText },
    "resume",
    /pdf/i.test(source.fileName) || !source.text ? "pdf" : "txt"
  );
  return { fileName: packed.name, mime: packed.mime, bytes: packed.bytes, text: source.text || packed.text };
}
