import express from "express";
import fs from "node:fs";
import path from "node:path";
import {
  listByStatus,
  getJob,
  getApplication,
  setStatus,
  saveApprovedAnswer,
  tracker,
  countsByStatus,
} from "../queue/db";
import { paths } from "../paths";
import { loadRules } from "../matching/score";

function esc(s: any) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(title: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:960px;margin:24px auto;padding:0 16px;background:#f7f7fb;color:#1a1a2e}
nav a{margin-right:12px;color:#4338ca;text-decoration:none;font-weight:600}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin:12px 0}
.badge{display:inline-block;background:#ede9fe;color:#4338ca;border-radius:999px;padding:2px 8px;font-size:12px}
button,.btn{background:#4338ca;color:#fff;border:0;border-radius:8px;padding:8px 12px;margin:4px 4px 4px 0;cursor:pointer;text-decoration:none;display:inline-block;font-size:13px}
.btn.secondary{background:#e5e7eb;color:#111}
textarea{width:100%;min-height:80px;margin:6px 0}
.warn{background:#fffbeb;border:1px solid #fde68a;padding:10px;border-radius:8px;font-size:13px}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:6px;border-bottom:1px solid #eee;text-align:left}
img{max-width:100%;border:1px solid #ddd;border-radius:6px}
</style></head><body>
<nav>
  <a href="/">Review</a>
  <a href="/tracker">Tracker</a>
  <a href="/unsupported">Unsupported</a>
  <a href="/needs_human">Needs human</a>
</nav>
${body}</body></html>`;
}

export function startDashboard() {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  const password = process.env.DASHBOARD_PASSWORD;
  if (password) {
    app.use((req, res, next) => {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Basic ") ? Buffer.from(header.slice(6), "base64").toString() : "";
      if (token === `admin:${password}`) return next();
      res.setHeader("WWW-Authenticate", 'Basic realm="auto-apply"');
      res.status(401).send("Auth required");
    });
  }

  app.get("/", (_req, res) => {
    const rules = loadRules();
    const jobs = listByStatus("awaiting_review");
    const counts = countsByStatus();
    const cards = jobs
      .map((j) => {
        const appRow = getApplication(j.id);
        const answers = appRow?.answers_json ? JSON.parse(appRow.answers_json) : {};
        const answerFields = Object.entries(answers)
          .map(
            ([q, a]) =>
              `<label>${esc(q)}</label><textarea name="answer__${esc(Buffer.from(q).toString("base64url"))}">${esc(
                a
              )}</textarea>`
          )
          .join("");
        return `<div class="card">
          <div><span class="badge">${esc(j.score)}</span> <strong>${esc(j.title)}</strong> @ ${esc(j.company)}</div>
          <div><a href="${esc(j.url)}" target="_blank">Open posting</a></div>
          ${appRow?.screenshot_path && fs.existsSync(appRow.screenshot_path) ? `<p><img src="/shot/${esc(j.id)}" alt="filled form"></p>` : ""}
          <form method="POST" action="/approve/${encodeURIComponent(j.id)}">
            ${answerFields || "<p class='warn'>No AI drafts — approve to queue for submit (or dry-run).</p>"}
            <button type="submit">Approve</button>
            <button class="btn secondary" formaction="/skip/${encodeURIComponent(j.id)}">Skip</button>
          </form>
        </div>`;
      })
      .join("");

    res.send(
      layout(
        "Review",
        `<h1>Review queue</h1>
        <div class="warn">dryRun=${rules.dryRun}. When true, approved jobs are filled and screenshotted but never submitted.
        Caps: ${rules.dailyCap}/day, ${rules.maxPerCompanyPerWeek}/company/week, ${rules.minutesBetweenApplications}m gap.
        Counts: ${esc(JSON.stringify(counts))}</div>
        ${cards || "<p>No jobs awaiting review.</p>"}`
      )
    );
  });

  app.post("/approve/:id", (req, res) => {
    const id = req.params.id;
    const job = getJob(id);
    if (!job) return res.status(404).send("Not found");
    for (const [key, value] of Object.entries(req.body || {})) {
      if (!key.startsWith("answer__")) continue;
      const q = Buffer.from(key.slice("answer__".length), "base64url").toString("utf8");
      if (typeof value === "string" && value.trim()) saveApprovedAnswer(q, value);
    }
    setStatus(id, "approved");
    res.redirect("/");
  });

  app.post("/skip/:id", (req, res) => {
    setStatus(req.params.id, "skipped", "skipped from dashboard");
    res.redirect("/");
  });

  app.get("/tracker", (req, res) => {
    const filter = typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = tracker(filter);
    const table = rows
      .map(
        (r) => `<tr>
        <td>${esc(r.status)}</td><td>${esc(r.score)}</td>
        <td>${esc(r.title)}<br><span style="color:#666">${esc(r.company)}</span></td>
        <td><a href="${esc(r.url)}" target="_blank">job</a>
        ${r.screenshot_path ? ` · <a href="/shot/${esc(r.id)}">shot</a>` : ""}
        ${r.resume_path ? ` · <a href="/file?p=${encodeURIComponent(r.resume_path)}">resume</a>` : ""}
        </td></tr>`
      )
      .join("");
    res.send(
      layout(
        "Tracker",
        `<h1>Tracker</h1>
        <p>Filter:
          ${["", "matched", "drafted", "awaiting_review", "approved", "submitted", "needs_human", "unsupported", "failed", "skipped"]
            .map((s) => `<a href="/tracker${s ? `?status=${s}` : ""}">${s || "all"}</a>`)
            .join(" · ")}
        </p>
        <table><thead><tr><th>Status</th><th>Score</th><th>Role</th><th>Links</th></tr></thead><tbody>${table}</tbody></table>`
      )
    );
  });

  app.get("/unsupported", (_req, res) => {
    const jobs = listByStatus("unsupported");
    const cards = jobs
      .map((j) => {
        const appRow = getApplication(j.id);
        return `<div class="card">
          <strong>${esc(j.title)}</strong> @ ${esc(j.company)} <span class="badge">${esc(j.score)}</span>
          <div>
            <a class="btn" href="${esc(j.url)}" target="_blank">Open job</a>
            ${appRow?.resume_path ? `<a class="btn secondary" href="/file?p=${encodeURIComponent(appRow.resume_path)}">Resume</a>` : ""}
            ${appRow?.cover_letter_path ? `<a class="btn secondary" href="/file?p=${encodeURIComponent(appRow.cover_letter_path)}">Cover letter</a>` : ""}
            <form style="display:inline" method="POST" action="/mark-applied/${encodeURIComponent(j.id)}">
              <button type="submit">Mark as applied</button>
            </form>
            <form style="display:inline" method="POST" action="/skip/${encodeURIComponent(j.id)}">
              <button class="btn secondary" type="submit">Skip</button>
            </form>
          </div>
        </div>`;
      })
      .join("");
    res.send(layout("Unsupported", `<h1>Unsupported sites</h1>${cards || "<p>None.</p>"}`));
  });

  app.get("/needs_human", (_req, res) => {
    const jobs = listByStatus("needs_human");
    const cards = jobs
      .map(
        (j) => `<div class="card"><strong>${esc(j.title)}</strong> @ ${esc(j.company)}
        <div>${esc(j.notes)}</div>
        <a href="${esc(j.url)}" target="_blank">Open</a>
        <form style="display:inline" method="POST" action="/mark-applied/${encodeURIComponent(j.id)}"><button>Mark applied</button></form>
        <form style="display:inline" method="POST" action="/skip/${encodeURIComponent(j.id)}"><button class="btn secondary">Skip</button></form>
        </div>`
      )
      .join("");
    res.send(layout("Needs human", `<h1>Needs human</h1>${cards || "<p>None.</p>"}`));
  });

  app.post("/mark-applied/:id", (req, res) => {
    const { saveApplication } = require("../queue/db");
    saveApplication(req.params.id, { submittedAt: new Date().toISOString(), outcome: "manual" });
    setStatus(req.params.id, "submitted", "marked applied by hand");
    res.redirect(req.get("Referer") || "/tracker");
  });

  app.get("/shot/:id", (req, res) => {
    const appRow = getApplication(req.params.id);
    if (!appRow?.screenshot_path || !fs.existsSync(appRow.screenshot_path)) return res.status(404).end();
    res.sendFile(path.resolve(appRow.screenshot_path));
  });

  app.get("/file", (req, res) => {
    const p = typeof req.query.p === "string" ? req.query.p : "";
    const resolved = path.resolve(p);
    // Only allow files under the data root
    if (!resolved.startsWith(path.resolve(paths.root))) return res.status(403).end();
    if (!fs.existsSync(resolved)) return res.status(404).end();
    res.sendFile(resolved);
  });

  const host = process.env.DASHBOARD_HOST || "127.0.0.1";
  const port = Number(process.env.DASHBOARD_PORT || 3000);
  app.listen(port, host, () => {
    console.log(`Dashboard http://${host}:${port}`);
  });
}

if (require.main === module) {
  startDashboard();
}
