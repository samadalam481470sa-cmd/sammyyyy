import { inflate } from "pako";
import { parseResumeText } from "./parseResume.js";
import { zipRead, zipStore } from "./zipMini.js";
import { splitName, type DocumentFile, type Profile } from "./types.js";
import { bestEffortAnswer } from "./answers.js";

export type PackedKind = DocumentFile["kind"];

export interface PackedBytes {
  name: string;
  mime: string;
  bytes: Uint8Array;
  text: string;
}

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  return (m?.[1] || "").toLowerCase();
}

export function mimeForName(name: string): string {
  const ext = extOf(name);
  if (ext === "pdf") return PDF_MIME;
  if (ext === "docx") return DOCX_MIME;
  if (ext === "doc") return "application/msword";
  if (ext === "rtf") return "application/rtf";
  if (ext === "html" || ext === "htm") return "text/html";
  return "text/plain";
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  if (typeof btoa === "function") return btoa(bin);
  return Buffer.from(bytes).toString("base64");
}

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function latin1(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

function pdfOperatorsToText(src: string): string {
  const out: string[] = [];
  const tj = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tj.exec(src))) {
    const inner = m[0].slice(1, m[0].lastIndexOf(")"));
    out.push(inner.replace(/\\n/g, "\n").replace(/\\([()\\])/g, "$1"));
  }
  const arr = /\[(.*?)\]\s*TJ/gs;
  while ((m = arr.exec(src))) {
    const parts = m[1].match(/\((?:\\.|[^\\)])*\)/g) || [];
    out.push(parts.map((p) => p.slice(1, -1).replace(/\\([()\\])/g, "$1")).join(""));
  }
  return out.join(" ");
}

export function extractPdfText(bytes: Uint8Array): string {
  const src = latin1(bytes);
  const chunks: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const header = src.slice(Math.max(0, m.index - 280), m.index);
    const body = m[1];
    if (/\/FlateDecode/.test(header)) {
      try {
        const raw = new Uint8Array(body.length);
        for (let i = 0; i < body.length; i++) raw[i] = body.charCodeAt(i) & 255;
        chunks.push(pdfOperatorsToText(latin1(inflate(raw))));
      } catch {
        /* skip a bad stream */
      }
    } else {
      chunks.push(pdfOperatorsToText(body));
    }
  }
  chunks.push(pdfOperatorsToText(src));
  return chunks
    .join("\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function xmlText(xml: string): string {
  return xml
    .replace(/<w:tab\b[^/]*\/>/g, "\t")
    .replace(/<w:br\b[^/]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractDocxText(bytes: Uint8Array): string {
  const files = zipRead(bytes);
  const xml = new TextDecoder().decode(files["word/document.xml"] || new Uint8Array());
  return xmlText(xml);
}

export function extractRtfText(raw: string): string {
  return raw
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-z]+\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractHtmlText(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+\n/g, "\n")
    .trim();
}

export function extractDocBinary(bytes: Uint8Array): string {
  const out: string[] = [];
  let run = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    if (code >= 32 && code < 127) run += String.fromCharCode(code);
    else if (run.length >= 4) {
      out.push(run);
      run = "";
    } else run = "";
  }
  if (run.length >= 4) out.push(run);
  return out.join("\n").trim();
}

export function extractResumeText(name: string, bytes: Uint8Array): string {
  const ext = extOf(name);
  const asText = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (ext === "pdf" || asText.slice(0, 5) === "%PDF-") return extractPdfText(bytes);
  if (ext === "docx" || (bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    const docx = extractDocxText(bytes);
    if (docx.length > 20) return docx;
  }
  if (ext === "rtf" || asText.startsWith("{\\rtf")) return extractRtfText(asText);
  if (ext === "html" || ext === "htm") return extractHtmlText(asText);
  if (ext === "doc") return extractDocBinary(bytes) || asText;
  return asText.replace(/\u0000/g, "").trim();
}

export async function parseResumeFile(name: string, bytes: Uint8Array): Promise<Profile> {
  const text = extractResumeText(name, bytes);
  const profile = parseResumeText(text);
  profile.rawResumeText = text;
  const packed: DocumentFile = {
    id: "master-resume",
    kind: "master-resume",
    name,
    text,
    mime: mimeForName(name),
    base64: bytesToBase64(bytes),
  };
  profile.documents = [packed, ...profile.documents.filter((d) => d.kind !== "master-resume")];
  return profile;
}

function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function textToPdf(text: string, title = "Resume"): Uint8Array {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.slice(0, 110))
    .slice(0, 70);
  const ops = ["BT", "/F1 12 Tf", "50 760 Td", `(${pdfEscape(title)}) Tj`, "/F1 10 Tf"];
  for (const line of lines) {
    ops.push("0 -14 Td", `(${pdfEscape(line || " ")}) Tj`);
  }
  ops.push("ET");
  const stream = ops.join("\n");
  const objs = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objs) {
    offsets.push(body.length);
    body += obj + "\n";
  }
  const xrefAt = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return new TextEncoder().encode(body);
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function textToDocx(text: string): Uint8Array {
  const paras = (text || " ").split(/\n/).map((line) => {
    return `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`;
  });
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras.join("")}<w:sectPr/></w:body></w:document>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const enc = new TextEncoder();
  return zipStore([
    { name: "[Content_Types].xml", data: enc.encode(types) },
    { name: "_rels/.rels", data: enc.encode(rels) },
    { name: "word/document.xml", data: enc.encode(document) },
  ]);
}

export function profileResumeText(profile: Profile): string {
  const c = profile.contact;
  const names = splitName(c.legalName);
  const lines = [
    c.legalName || [names.first, names.last].filter(Boolean).join(" "),
    [c.email, c.phone, [c.city, c.state].filter(Boolean).join(", ")].filter(Boolean).join(" · "),
    [c.linkedin, c.github, c.portfolio].filter(Boolean).join(" · "),
    "",
    profile.rawResumeText || "",
  ];
  if (!profile.rawResumeText) {
    if (profile.skills.length) lines.push("Skills: " + profile.skills.map((s) => s.name).join(", "));
    for (const w of profile.work) {
      lines.push(`${w.title}${w.company ? " — " + w.company : ""}`);
      for (const b of w.bullets || []) if (b.text) lines.push(`• ${b.text}`);
    }
  }
  return lines.filter((l, i, arr) => l || arr[i - 1]).join("\n").trim();
}

export function profileCoverLetterText(profile: Profile): string {
  const q = {
    id: "cover",
    label: "Cover letter",
    required: false,
    kind: "textarea" as const,
    type: "coverLetter" as const,
    value: "",
    source: "none" as const,
    status: "needs-you" as const,
    confidence: "check-this" as const,
    position: 0,
  };
  return bestEffortAnswer(q, profile) || profileResumeText(profile).slice(0, 1200);
}

export function buildDownloadable(profile: Profile, kind: "resume" | "cover", format: "txt" | "pdf" | "docx"): PackedBytes {
  const text = kind === "cover" ? profileCoverLetterText(profile) : profileResumeText(profile);
  const base = (profile.contact.legalName || "resume").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "resume";
  const stem = kind === "cover" ? `${base}-cover-letter` : `${base}-resume`;
  if (format === "pdf") return { name: `${stem}.pdf`, mime: PDF_MIME, bytes: textToPdf(text, stem), text };
  if (format === "docx") return { name: `${stem}.docx`, mime: DOCX_MIME, bytes: textToDocx(text), text };
  return { name: `${stem}.txt`, mime: "text/plain", bytes: new TextEncoder().encode(text), text };
}

export function packedFromProfile(profile: Profile, prefer: PackedKind = "master-resume"): DocumentFile | null {
  return (
    profile.documents.find((d) => d.kind === prefer && (d.base64 || d.text)) ||
    profile.documents.find((d) => d.base64 || d.text) ||
    null
  );
}

export function bytesForUpload(profile: Profile): PackedBytes {
  const packed = packedFromProfile(profile, "master-resume");
  if (packed?.base64) {
    return {
      name: packed.name || "resume.pdf",
      mime: packed.mime || mimeForName(packed.name || "resume.pdf"),
      bytes: base64ToBytes(packed.base64),
      text: packed.text || profile.rawResumeText,
    };
  }
  return buildDownloadable(profile, "resume", "pdf");
}

export const RESUME_ACCEPT = ".pdf,.doc,.docx,.txt,.rtf,.html,.htm";
