import { useEffect, useMemo, useState } from "react";
import type { ApplyQueueItem, Profile, Question, ScanSnapshot } from "@fillglen/core";
import { scoreMatch } from "@fillglen/core";
import { CopyrightNotice, Logo } from "../brand";
import { DatabaseView } from "../shared/DatabaseView";
import { ResumeFiles } from "../shared/ResumeFiles";

export type FilterTab = "all" | "needs-you" | "filled" | "live" | "database";

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
  onStartKeep: () => void;
  onStopKeep: () => void;
  liveJobs?: ApplyQueueItem[];
  onOpenLiveJob?: (url: string) => void;
}

const STATUS_LABEL: Record<Question["status"], string> = {
  filled: "Filled",
  "needs-review": "Needs review",
  "needs-you": "Needs you",
  "ai-draft-ready": "AI draft ready",
  skipped: "Skipped",
  scanning: "Scanning",
};

type ChromeLite = {
  storage?: {
    local?: {
      set: (items: Record<string, unknown>) => void;
      get: (keys: string[], cb: (r: Record<string, unknown>) => void) => void;
    };
    onChanged?: {
      addListener: (fn: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => void;
      removeListener: (fn: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => void;
    };
  };
  runtime?: { sendMessage: (msg: unknown) => void };
};

function chromeApi(): ChromeLite | undefined {
  return (globalThis as { chrome?: ChromeLite }).chrome;
}

function persistLocal(key: string, value: unknown) {
  try {
    const local = chromeApi()?.storage?.local;
    if (local) {
      local.set({ [key]: value });
      return;
    }
  } catch {
    /* extension storage unavailable */
  }
  try {
    localStorage.setItem("fillglen:ui:" + key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

function readLocal<T>(key: string, fallback: T, cb: (value: T) => void) {
  try {
    const local = chromeApi()?.storage?.local;
    if (local) {
      local.get([key], (r) => cb((r[key] as T) ?? fallback));
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    const raw = localStorage.getItem("fillglen:ui:" + key);
    if (raw != null) {
      cb(JSON.parse(raw) as T);
      return;
    }
  } catch {
    /* ignore */
  }
  cb(fallback);
}

export function QuestionWindow(props: QuestionWindowProps) {
  const [tab, setTab] = useState<FilterTab>("all");
  const [storedLive, setStoredLive] = useState<ApplyQueueItem[]>([]);
  const [savedAt, setSavedAt] = useState("");
  useEffect(() => {
    readLocal<FilterTab>("panelTab", "all", (v) => {
      if (v === "all" || v === "needs-you" || v === "filled" || v === "live" || v === "database") setTab(v);
    });
    readLocal<ApplyQueueItem[]>("liveJobs", [], (v) => {
      if (Array.isArray(v)) setStoredLive(v);
    });
    readLocal<string>("sessionSavedAt", "", (v) => {
      if (typeof v === "string") setSavedAt(v);
    });
    const onChanged = chromeApi()?.storage?.onChanged;
    if (!onChanged) return;
    const onChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== "local") return;
      if (Array.isArray(changes.liveJobs?.newValue)) setStoredLive(changes.liveJobs.newValue as ApplyQueueItem[]);
      if (typeof changes.sessionSavedAt?.newValue === "string") setSavedAt(changes.sessionSavedAt.newValue);
      const nextTab = changes.panelTab?.newValue;
      if (
        nextTab === "all" ||
        nextTab === "needs-you" ||
        nextTab === "filled" ||
        nextTab === "live" ||
        nextTab === "database"
      ) {
        setTab(nextTab);
      }
    };
    onChanged.addListener(onChange);
    return () => onChanged.removeListener(onChange);
  }, []);
  function setTabPersist(next: FilterTab) {
    setTab(next);
    persistLocal("panelTab", next);
  }
  const liveJobs = props.liveJobs ?? storedLive;
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

  if (tab === "database") {
    return (
      <Shell savedAt={savedAt}>
        <DatabaseView onBack={() => setTabPersist("all")} persistKey="panel" />
      </Shell>
    );
  }

  if (tab === "live") {
    return (
      <Shell savedAt={savedAt}>
        <div className="toolbar">
          <button onClick={() => setTabPersist("all")}>Back to form</button>
          <button className="primary" onClick={() => setTabPersist("live")}>
            Live jobs
          </button>
          <button className="primary" onClick={() => setTabPersist("database")}>
            Database
          </button>
        </div>
        <LiveJobList
          jobs={liveJobs}
          onOpen={(url) => {
            if (props.onOpenLiveJob) props.onOpenLiveJob(url);
            else chromeApi()?.runtime?.sendMessage({ type: "open-live-job", url });
          }}
        />
      </Shell>
    );
  }

  if (props.snapshot?.blockedReason === "linkedin-easy-apply") {
    return (
      <Shell savedAt={savedAt}>
        <div className="toolbar">
          <button className="primary" onClick={() => setTabPersist("live")}>
            Live jobs
          </button>
          <button className="primary" onClick={() => setTabPersist("database")}>
            Database
          </button>
        </div>
        <Empty
          title="LinkedIn Easy Apply is off-limits"
          body="Fillglen never runs on LinkedIn. LinkedIn’s terms ban automation, including Easy Apply."
        />
      </Shell>
    );
  }

  if (!props.snapshot) {
    return (
      <Shell savedAt={savedAt}>
        <div className="toolbar">
          <button className="primary" onClick={() => setTabPersist("live")}>
            Live jobs
          </button>
          <button className="primary" onClick={() => setTabPersist("database")}>
            Database
          </button>
        </div>
        <Empty
          title="No form on this page"
          body="Open a Greenhouse, Lever, Ashby, Workday, SmartRecruiters, or iCIMS application. The live list appears as questions show up. Live jobs stay saved."
        />
      </Shell>
    );
  }

  if (questions.length === 0) {
    return (
      <Shell savedAt={savedAt}>
        <JobHeader job={props.snapshot.job} match={match?.score} />
        <div className="toolbar">
          <button className="primary" onClick={() => setTabPersist("live")}>
            Live jobs
          </button>
          <button className="primary" onClick={() => setTabPersist("database")}>
            Database
          </button>
        </div>
        <Empty title="Scanning…" body="Looking for fields, including shadow DOM and this frame." />
      </Shell>
    );
  }

  const done = requiredEmpty.length === 0 && questions.length > 0;

  return (
    <Shell savedAt={savedAt}>
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
      <button
        type="button"
        className={`fg-bot-toggle${props.keepApplying ? " fg-bot-on" : ""}`}
        disabled={props.paused && !props.keepApplying}
        onClick={() => {
          if (props.keepApplying) props.onStopKeep();
          else props.onStartKeep();
        }}
      >
        {props.keepApplying ? "Pause auto bot" : "Start auto bot"}
        <span>{props.keepApplying ? "Running 24/7 — click to pause" : "Fill, submit, next listing — one button"}</span>
      </button>
      <div className="toolbar">
        <button className="primary" onClick={props.onFillPage} disabled={props.paused}>
          Fill this step
        </button>
        <button onClick={() => props.onUndo()}>Undo page</button>
        {props.onPopout && !props.popout ? <button onClick={props.onPopout}>Pop out</button> : null}
        <button className="primary" onClick={() => setTabPersist("live")}>
          Live jobs
        </button>
        <button className="primary" onClick={() => setTabPersist("database")}>
          Database
        </button>
      </div>
      <div className="tabs">
        {(["all", "needs-you", "filled"] as const).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTabPersist(t)}>
            {t === "all" ? "All" : t === "needs-you" ? "Needs you" : "Filled"}
          </button>
        ))}
      </div>
      {props.paused ? <p className="banner">Live filling paused for this site.</p> : null}
      {done && !props.keepApplying ? (
        <p className="banner done">Every required question has an answer. Turn on Keep applying to submit and continue 24/7.</p>
      ) : null}
      {props.keepApplying ? (
        <p className="banner done">Keep applying is on 24/7 while Chrome is open. It uses last resume when you have applied on this board before, otherwise it signs up, saves the login to Chrome, fills, submits, then opens the next listing. If a page looks like it detected automation, Fillglen slows down and keeps going. A CAPTCHA waits for you — Fillglen will not solve it.</p>
      ) : null}
      {props.profile ? (
        <ResumeFiles
          profile={props.profile}
          paste={props.profile.rawResumeText}
          onProfile={(next) => persistLocal("profile", next)}
          onPaste={(text) => persistLocal("popupPaste", text)}
          onStatus={(text) => persistLocal("popupStatus", text)}
        />
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
        Final check — {requiredEmpty.length} required still empty. Keep applying submits when this hits zero.
      </button>
    </Shell>
  );
}

function LiveJobList({ jobs, onOpen }: { jobs: ApplyQueueItem[]; onOpen: (url: string) => void }) {
  return (
    <section>
      <p className="meta">
        Fillglen keeps looking in the background while Chrome is open. Open a job after you finish an application, or
        leave the list here. It is saved.
      </p>
      <ol className="qlist">
        {jobs.map((m) => (
          <li key={m.url} className="qrow">
            <a href={m.url} target="_blank" rel="noreferrer">
              {m.title}
            </a>
            <div className="meta">
              {m.company}
              {m.location ? ` · ${m.location}` : ""}
              {m.source ? ` · ${m.source}` : ""}
              {m.score != null ? ` · ${m.score}` : ""}
              {m.appliedAt ? " · applied" : m.openedAt ? " · opened" : " · new"}
            </div>
            {m.why ? <p className="hint">{m.why}</p> : null}
            <div className="toolbar">
              <button className="primary" onClick={() => onOpen(m.url)}>
                Open job
              </button>
            </div>
          </li>
        ))}
      </ol>
      {!jobs.length ? <p className="meta">No live jobs yet. Keep Chrome open — the list fills in the background.</p> : null}
    </section>
  );
}

function Shell({ children, savedAt }: { children: React.ReactNode; savedAt?: string }) {
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
      <p className="meta">
        Switching tabs keeps this listing, typed answers, and keep applying.
        {savedAt ? ` Last saved ${new Date(savedAt).toLocaleTimeString()}.` : ""}
      </p>
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
