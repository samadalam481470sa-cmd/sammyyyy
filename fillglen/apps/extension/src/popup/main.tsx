import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  EMPTY_DISCOVER,
  EMPTY_PROFILE,
  hydrateProfile,
  parseResumeText,
  type ApplyQueueItem,
  type DiscoverStatus,
  type Profile,
} from "@fillglen/core";
import { CopyrightNotice, Wordmark } from "../brand";
import { DatabaseView } from "../shared/DatabaseView";
import "../panel/styles.css";

type Match = ApplyQueueItem;
type View = "home" | "live" | "database";

function Popup() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [paste, setPaste] = useState("");
  const [status, setStatus] = useState("Paste your resume. Fillglen ranks Texas IT jobs to that resume.");
  const [matches, setMatches] = useState<{ count: number; top: Match[] }>({ count: 0, top: [] });
  const [liveJobs, setLiveJobs] = useState<Match[]>([]);
  const [keepApplying, setKeepApplying] = useState(false);
  const [discover, setDiscover] = useState<DiscoverStatus>(EMPTY_DISCOVER);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>("home");
  const [harvestedAt, setHarvestedAt] = useState("");
  const [dbTotal, setDbTotal] = useState(0);

  useEffect(() => {
    chrome.storage.local.get(
      [
        "profile",
        "apiBase",
        "sessionToken",
        "finderMatches",
        "keepApplying",
        "discoverStatus",
        "liveJobs",
        "popupPaste",
        "popupStatus",
        "popupView",
        "liveJobsHarvestedAt",
        "dbCache",
      ],
      (r) => {
        if (r.profile) setProfile(hydrateProfile(r.profile));
        if (r.finderMatches) setMatches(r.finderMatches);
        if (r.discoverStatus) setDiscover(r.discoverStatus);
        if (Array.isArray(r.liveJobs)) setLiveJobs(r.liveJobs);
        if (typeof r.popupPaste === "string") setPaste(r.popupPaste);
        if (typeof r.popupStatus === "string") setStatus(r.popupStatus);
        if (r.popupView === "live" || r.popupView === "home" || r.popupView === "database") setView(r.popupView);
        if (typeof r.liveJobsHarvestedAt === "string") setHarvestedAt(r.liveJobsHarvestedAt);
        if (r.dbCache?.total != null) setDbTotal(Number(r.dbCache.total) || 0);
        setKeepApplying(Boolean(r.keepApplying));
        const base = r.apiBase || "http://127.0.0.1:8787";
        if (r.sessionToken) {
          fetch(`${base}/v1/finder/matches`, { headers: { authorization: `Bearer ${r.sessionToken}` } })
            .then((res) => res.json())
            .then((body) => {
              setMatches(body);
              chrome.storage.local.set({ finderMatches: body });
            })
            .catch(() => {});
        }
        chrome.runtime.sendMessage({ type: "refresh-queue" }).then((body) => {
          if (body?.liveJobs) setLiveJobs(body.liveJobs);
          if (body?.top) setMatches({ count: body.count || body.top.length, top: body.top });
          if (body?.discover) setDiscover(body.discover);
        }).catch(() => {});
      }
    );
    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== "local") return;
      if (changes.discoverStatus?.newValue) setDiscover(changes.discoverStatus.newValue);
      if (changes.finderMatches?.newValue) setMatches(changes.finderMatches.newValue);
      if (changes.keepApplying) setKeepApplying(Boolean(changes.keepApplying.newValue));
      if (changes.liveJobs?.newValue) setLiveJobs(changes.liveJobs.newValue);
      if (typeof changes.liveJobsHarvestedAt?.newValue === "string") setHarvestedAt(changes.liveJobsHarvestedAt.newValue);
      if (changes.dbCache?.newValue?.total != null) setDbTotal(Number(changes.dbCache.newValue.total) || 0);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  function save(next: Profile) {
    setProfile(next);
    chrome.storage.local.set({ profile: next });
  }

  function persistUi(patch: { paste?: string; status?: string; view?: View }) {
    if (patch.paste != null) setPaste(patch.paste);
    if (patch.status != null) setStatus(patch.status);
    if (patch.view != null) setView(patch.view);
    chrome.storage.local.set({
      popupPaste: patch.paste ?? paste,
      popupStatus: patch.status ?? status,
      popupView: patch.view ?? view,
    });
  }

  async function refreshQueue() {
    const body = await chrome.runtime.sendMessage({ type: "refresh-queue" });
    if (body?.top) {
      setMatches({ count: body.count || body.top.length, top: body.top });
      chrome.storage.local.set({
        finderMatches: { count: body.count, top: body.top, lookup: body.lookup || body.top },
      });
    }
    if (body?.liveJobs) setLiveJobs(body.liveJobs);
    if (body?.discover) setDiscover(body.discover);
  }

  async function openJob(url: string) {
    await chrome.runtime.sendMessage({ type: "open-live-job", url });
  }

  if (view === "database") {
    return (
      <div className="fg-root fg-popup">
        <Wordmark />
        <DatabaseView onBack={() => persistUi({ view: "home" })} persistKey="popup" />
        <CopyrightNotice />
      </div>
    );
  }

  if (view === "live") {
    return (
      <div className="fg-root fg-popup">
        <Wordmark />
        <div className="toolbar fg-actions">
          <button onClick={() => persistUi({ view: "home" })}>Back</button>
          <button className="primary" onClick={() => persistUi({ view: "live" })}>
            Live jobs
          </button>
          <button disabled={busy} onClick={() => refreshQueue()}>
            Refresh
          </button>
          <button className="primary" onClick={() => persistUi({ view: "database" })}>
            Database
          </button>
        </div>
        <section className="fg-card">
          <div className="fg-card-head">
            <strong>Live jobs</strong>
            <span>{liveJobs.length} kept in this list</span>
          </div>
          <p className="meta">
            Fillglen keeps looking in the background while Chrome is open. Open a job now, or leave it here after you
            finish an application. This list is saved.
            {harvestedAt ? ` Last look ${new Date(harvestedAt).toLocaleTimeString()}.` : ""}
          </p>
          <ol className="qlist">
            {liveJobs.map((m) => (
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
                  <button className="primary" onClick={() => openJob(m.url)}>
                    Open job
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {!liveJobs.length ? <p className="meta">No live jobs yet. Keep Chrome open — the list fills in the background.</p> : null}
        </section>
        <CopyrightNotice />
      </div>
    );
  }

  return (
    <div className="fg-root fg-popup">
      <Wordmark />
      <p className="fg-lede">{status}</p>

      <div className="toolbar fg-actions">
        <button className="primary" onClick={() => persistUi({ view: "live" })}>
          Live jobs
        </button>
        <button className="primary" onClick={() => persistUi({ view: "database" })}>
          Database
        </button>
        <span className="meta">{liveJobs.length} saved · {dbTotal} in this extension</span>
      </div>
      <button className="primary fg-db-go" onClick={() => persistUi({ view: "database" })}>
        <strong>Go to Database</strong>
        <span>{dbTotal} stored in this extension — fetch here, not a website</span>
      </button>

      <section className="fg-card fg-discover">
        <div className="fg-card-head">
          <strong>Texas map scan</strong>
          <span>{keepApplying ? "Running while this widget is on" : "Scanning in the background"}</span>
        </div>
        <p className="meta">{discover.note || EMPTY_DISCOVER.note}</p>
        <div className="fg-stats fg-stats-4">
          <div>
            <em>{discover.companiesSeen}</em>
            <span>Companies seen</span>
          </div>
          <div>
            <em>{discover.sitesChecked}</em>
            <span>Career sites</span>
          </div>
          <div>
            <em>{liveJobs.length}</em>
            <span>Live jobs</span>
          </div>
          <div>
            <em>{dbTotal}</em>
            <span>Database</span>
          </div>
        </div>
      </section>

      <section className="fg-card">
        <div className="fg-card-head">
          <strong>Resume</strong>
          <span>Paste, then parse. Matches follow this resume. Saved automatically.</span>
        </div>
        <textarea
          rows={9}
          placeholder="Paste the full resume text here"
          value={paste}
          onChange={(e) => persistUi({ paste: e.target.value })}
        />
        <div className="toolbar">
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              if (!paste.trim()) {
                persistUi({ status: "Paste a resume first." });
                return;
              }
              setBusy(true);
              const parsed = hydrateProfile(parseResumeText(paste));
              save({ ...parsed, rawResumeText: paste });
              persistUi({ status: "Parsed. Ranking Texas IT jobs to this resume…" });
              try {
                await refreshQueue();
                persistUi({ status: "Resume saved. Jobs below are ranked to this resume. Texas IT first." });
              } finally {
                setBusy(false);
              }
            }}
          >
            Parse resume
          </button>
        </div>
        <div className="fg-grid">
          <label>
            Name
            <input
              value={profile.contact.legalName}
              onChange={(e) => save({ ...profile, contact: { ...profile.contact, legalName: e.target.value } })}
            />
          </label>
          <label>
            Email
            <input
              value={profile.contact.email}
              onChange={(e) => save({ ...profile, contact: { ...profile.contact, email: e.target.value } })}
            />
          </label>
        </div>
      </section>

      <div className="toolbar fg-actions">
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            if (!profile.contact.legalName && !paste) {
              persistUi({ status: "Paste a resume and parse it first." });
              return;
            }
            if (paste && !profile.contact.email) {
              const parsed = hydrateProfile(parseResumeText(paste));
              save({ ...parsed, rawResumeText: paste });
            }
            setBusy(true);
            await chrome.runtime.sendMessage({ type: "start-keep-applying" });
            setKeepApplying(true);
            await refreshQueue();
            setBusy(false);
            persistUi({
              status:
                "Keep applying is on. The next listing is warmed in the background so switching is instant. After each application you can open a Live job, or leave the list. Unknown questions use the resume, or No.",
            });
          }}
        >
          Autofill & keep applying
        </button>
        <button
          onClick={async () => {
            await chrome.runtime.sendMessage({ type: "stop-keep-applying" });
            setKeepApplying(false);
            persistUi({ status: "Stopped. Live jobs stay saved." });
          }}
        >
          Stop
        </button>
        <button
          onClick={async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) chrome.sidePanel.open({ tabId: tab.id });
          }}
        >
          Open live window
        </button>
      </div>

      <section className="fg-card">
        <div className="fg-card-head">
          <strong>Jobs tailored to this resume</strong>
          <span>{matches.count || 0} sourced openings</span>
        </div>
        <ol className="qlist">
          {(matches.top || []).map((m) => (
            <li key={m.url} className="qrow">
              <a href={m.url} target="_blank" rel="noreferrer">
                {m.title}
              </a>
              <div className="meta">
                {m.company}
                {m.location ? ` · ${m.location}` : ""}
                {m.source ? ` · ${m.source}` : ""}
                {m.score != null ? ` · ${m.score}` : ""}
              </div>
              {m.why ? <p className="hint">{m.why}</p> : null}
              <div className="toolbar">
                <button className="primary" onClick={() => openJob(m.url)}>
                  Open job
                </button>
              </div>
            </li>
          ))}
        </ol>
        {!(matches.top || []).length ? (
          <p className="meta">Parse a resume. Live jobs also collect in the background.</p>
        ) : null}
      </section>

      <p className="meta fg-foot-note">
        {keepApplying ? "Widget on." : "Keep applying is off."} Live jobs stay if you close this popup. Database is a
        button in this same window — it does not open another site. Unknown form questions use the resume; if the
        resume does not have it, Fillglen answers No. LinkedIn Easy Apply is blocked.
      </p>
      <CopyrightNotice />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>
);
