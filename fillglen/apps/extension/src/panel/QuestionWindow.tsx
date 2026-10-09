import { useMemo, useState } from "react";
import type { Profile, Question, ScanSnapshot } from "@fillglen/core";
import { scoreMatch } from "@fillglen/core";
import { CopyrightNotice, Logo } from "../brand";

export type FilterTab = "all" | "needs-you" | "filled";

export interface DraftState {
  questionId: string;
  text: string;
  usedFacts: string[];
  refused: boolean;
  reason?: string;
}

export interface QuestionWindowProps {
  snapshot: ScanSnapshot | null;
  profile: Profile | null;
  paused: boolean;
  keepApplying?: boolean;
  popout?: boolean;
  drafts?: Record<string, DraftState>;
  onFillPage: () => void;
  onFillOne: (id: string, value: string) => void;
  onFocus: (id: string) => void;
  onSaveAnswer: (pattern: string, answer: string) => void;
  onUndo: (id?: string) => void;
  onPause: () => void;
  onDraft: (id: string) => void;
  onInsertDraft: (id: string, text: string) => void;
  onPopout?: () => void;
  onEdit: (id: string, value: string) => void;
  onStartKeep?: () => void;
  onStopKeep?: () => void;
}

const STATUS_LABEL: Record<Question["status"], string> = {
  filled: "Filled",
  "needs-review": "Needs review",
  "needs-you": "Needs you",
  "ai-draft-ready": "AI draft ready",
  skipped: "Skipped",
  scanning: "Scanning",
};

export function QuestionWindow(props: QuestionWindowProps) {
  const [tab, setTab] = useState<FilterTab>("all");
  const questions = props.snapshot?.questions ?? [];
  const filtered = questions.filter((q) => {
    if (tab === "needs-you") return q.status === "needs-you" || q.status === "needs-review";
    if (tab === "filled") return q.status === "filled" || q.status === "ai-draft-ready";
    return true;
  });
  const answered = questions.filter((q) => q.value && q.status !== "needs-you").length;
  const requiredEmpty = questions.filter((q) => q.required && !q.value);
  const match = useMemo(() => {
    if (!props.snapshot || !props.profile) return null;
    return scoreMatch(props.snapshot.job.description || props.snapshot.job.title, props.profile);
  }, [props.snapshot, props.profile]);

  if (props.snapshot?.blockedReason === "linkedin-easy-apply") {
    return (
      <Shell>
        <Empty
          title="LinkedIn Easy Apply is off-limits"
          body="Fillglen never runs on LinkedIn. LinkedIn’s terms ban automation, including Easy Apply."
        />
      </Shell>
    );
  }

  if (!props.snapshot) {
    return (
      <Shell>
        <Empty
          title="No form on this page"
          body="Open a Greenhouse, Lever, Ashby, Workday, SmartRecruiters, or iCIMS application. The live list appears as questions show up."
        />
      </Shell>
    );
  }

  if (questions.length === 0) {
    return (
      <Shell>
        <JobHeader job={props.snapshot.job} match={match?.score} />
        <Empty title="Scanning…" body="Looking for fields, including shadow DOM and this frame." />
      </Shell>
    );
  }

  const done = requiredEmpty.length === 0 && questions.length > 0;

  return (
    <Shell>
      <JobHeader job={props.snapshot.job} match={match?.score} />
      <div className="progress">
        <div className="progress-top">
          <span>
            {answered} of {questions.length} answered
          </span>
          {props.snapshot.job.stepTotal ? (
            <span>
              Step {props.snapshot.job.stepIndex ?? "?"} of {props.snapshot.job.stepTotal}
              {props.snapshot.job.stepLabel ? `: ${props.snapshot.job.stepLabel}` : ""}
            </span>
          ) : null}
        </div>
        <div className="bar">
          <i style={{ width: `${questions.length ? (answered / questions.length) * 100 : 0}%` }} />
        </div>
      </div>
      <div className="toolbar">
        <button className="primary" onClick={props.onFillPage} disabled={props.paused}>
          Fill this step
        </button>
        {props.keepApplying ? (
          <button onClick={props.onStopKeep}>Stop keep applying</button>
        ) : (
          <button className="primary" onClick={props.onStartKeep} disabled={props.paused}>
            Autofill & keep applying
          </button>
        )}
        <button onClick={() => props.onUndo()}>Undo page</button>
        <button onClick={props.onPause}>{props.paused ? "Resume site" : "Pause this site"}</button>
        {props.onPopout && !props.popout ? <button onClick={props.onPopout}>Pop out</button> : null}
      </div>
      <div className="tabs">
        {(["all", "needs-you", "filled"] as FilterTab[]).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "all" ? "All" : t === "needs-you" ? "Needs you" : "Filled"}
          </button>
        ))}
      </div>
      {props.paused ? <p className="banner">Live filling paused for this site.</p> : null}
      {done && !props.keepApplying ? (
        <p className="banner done">Every required question has an answer. You still click Submit yourself unless Keep applying is on.</p>
      ) : null}
      {props.keepApplying ? (
        <p className="banner done">Keep applying is on. Built-in job list, no 24/7 server needed. Dropdowns, Next, Submit, then the next listing while Chrome stays open. A CAPTCHA waits for you — Fillglen will not solve it.</p>
      ) : null}
      <ul className="qlist">
        {filtered.map((q) => (
          <QuestionRow
            key={q.id}
            q={q}
            draft={props.drafts?.[q.id]}
            onFocus={() => props.onFocus(q.id)}
            onEdit={(v) => props.onEdit(q.id, v)}
            onSave={() => props.onSaveAnswer(q.label, q.value)}
            onUndo={() => props.onUndo(q.id)}
            onDraft={() => props.onDraft(q.id)}
            onInsert={() => props.drafts?.[q.id]?.text && props.onInsertDraft(q.id, props.drafts[q.id].text)}
          />
        ))}
      </ul>
      <button
        className="final-check"
        onClick={() => {
          const first = requiredEmpty[0];
          if (first) props.onFocus(first.id);
        }}
      >
        Final check — {requiredEmpty.length} required still empty. You submit the form.
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fg-root">
      <header className="fg-brand">
        <Logo size={40} />
        <div>
          <strong>Fillglen</strong>
          <span>Live question window</span>
        </div>
      </header>
      {children}
      <CopyrightNotice />
    </div>
  );
}

function JobHeader({ job, match }: { job: ScanSnapshot["job"]; match?: number }) {
  const feed = job.feedScore != null ? job.feedScore : match;
  return (
    <section className="job">
      <h1>{job.title || "Application"}</h1>
      <p>
        {job.company || "Company"} · {job.board}
        {job.feedSource ? ` · ${job.feedSource}` : ""}
        {feed != null ? ` · Match ${feed}` : ""}
      </p>
      {job.feedWhy ? <p className="hint">{job.feedWhy}</p> : null}
    </section>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

function QuestionRow({
  q,
  draft,
  onFocus,
  onEdit,
  onSave,
  onUndo,
  onDraft,
  onInsert,
}: {
  q: Question;
  draft?: DraftState;
  onFocus: () => void;
  onEdit: (v: string) => void;
  onSave: () => void;
  onUndo: () => void;
  onDraft: () => void;
  onInsert: () => void;
}) {
  const writable = q.kind === "textarea" || q.type === "motivation" || q.type === "behavioral" || q.type === "coverLetter";
  return (
    <li className={`qrow ${q.status}`}>
      <button className="qlabel" onClick={onFocus}>
        {q.label}
        {q.required ? <em>required</em> : null}
      </button>
      <textarea value={q.value} onChange={(e) => onEdit(e.target.value)} rows={q.value.length > 80 || writable ? 3 : 1} />
      <div className="meta">
        <span>{q.source === "none" ? "—" : q.source}</span>
        <span>{STATUS_LABEL[q.status]}</span>
        <span>{q.confidence === "high" ? "High" : "Check this"}</span>
      </div>
      {q.error ? <p className="err">{q.error}</p> : null}
      {draft ? (
        <div className="draft">
          {draft.refused ? <p>{draft.reason}</p> : <p>{draft.text}</p>}
          {draft.usedFacts?.length ? <small>Facts used: {draft.usedFacts.join(" · ")}</small> : null}
          {!draft.refused && draft.text ? <button onClick={onInsert}>Insert</button> : null}
        </div>
      ) : null}
      <div className="row-actions">
        <button onClick={onSave} disabled={!q.value}>
          Save to library
        </button>
        <button onClick={onUndo}>Undo</button>
        {writable ? <button onClick={onDraft}>Draft with AI</button> : null}
      </div>
    </li>
  );
}

export { Logo } from "../brand";
