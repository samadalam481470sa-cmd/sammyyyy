import { useRef, useState } from "react";
import {
  RESUME_ACCEPT,
  buildDownloadable,
  hydrateProfile,
  parseResumeFile,
  parseResumeText,
  type Profile,
} from "@fillglen/core";

function downloadBytes(name: string, mime: string, bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function ResumeFiles({
  profile,
  paste,
  onProfile,
  onPaste,
  onStatus,
}: {
  profile: Profile;
  paste: string;
  onProfile: (next: Profile) => void;
  onPaste: (text: string) => void;
  onStatus: (text: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileName = profile.documents.find((d) => d.kind === "master-resume")?.name;

  async function ingest(file: File) {
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = hydrateProfile(await parseResumeFile(file.name, bytes));
      const next = hydrateProfile({
        ...parsed,
        contact: {
          ...parsed.contact,
          legalName: parsed.contact.legalName || profile.contact.legalName,
          email: parsed.contact.email || profile.contact.email,
          phone: parsed.contact.phone || profile.contact.phone,
        },
        rawResumeText: parsed.rawResumeText || paste,
      });
      onProfile(next);
      if (next.rawResumeText) onPaste(next.rawResumeText);
      onStatus(`Loaded ${file.name}. Saved. Jobs rank to this resume.`);
    } catch {
      const text = await file.text();
      const parsed = hydrateProfile(parseResumeText(text));
      onProfile({ ...parsed, rawResumeText: text });
      onPaste(text);
      onStatus(`Read ${file.name} as text and saved it.`);
    } finally {
      setBusy(false);
    }
  }

  function download(kind: "resume" | "cover", format: "txt" | "pdf" | "docx") {
    const packed = buildDownloadable(profile, kind, format);
    downloadBytes(packed.name, packed.mime, packed.bytes);
    onStatus(`Downloaded ${packed.name}.`);
  }

  return (
    <div className="fg-files">
      <div
        className={`fg-drop${hover ? " on" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setHover(false);
          const file = e.dataTransfer.files?.[0];
          if (file) ingest(file).catch(() => {});
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={RESUME_ACCEPT}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) ingest(file).catch(() => {});
          }}
        />
        <button className="primary" disabled={busy} type="button" onClick={() => inputRef.current?.click()}>
          {busy ? "Reading…" : "Upload PDF / DOCX"}
        </button>
        <span className="meta">{fileName ? `Saved ${fileName}` : "PDF, DOCX, DOC, TXT, RTF, HTML. Drag onto this box."}</span>
      </div>
      <div className="toolbar fg-file-dl">
        <button type="button" onClick={() => download("resume", "txt")}>
          Resume TXT
        </button>
        <button type="button" onClick={() => download("resume", "pdf")}>
          Resume PDF
        </button>
        <button type="button" onClick={() => download("resume", "docx")}>
          Resume DOCX
        </button>
        <button type="button" onClick={() => download("cover", "txt")}>
          Cover TXT
        </button>
        <button type="button" onClick={() => download("cover", "pdf")}>
          Cover PDF
        </button>
        <button type="button" onClick={() => download("cover", "docx")}>
          Cover DOCX
        </button>
      </div>
    </div>
  );
}
