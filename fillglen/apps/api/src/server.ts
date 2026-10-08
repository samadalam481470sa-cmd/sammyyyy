import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import {
  buildAiPrompt,
  EMPTY_PROFILE,
  parseAiDraft,
  parseResumeText,
  scoreMatch,
  tailorResume,
  type Profile,
} from "@fillglen/core";
import { db, decryptField, encryptField, hashToken, id, loadDb, saveDb } from "./db.js";
import { fetchPublicJobs } from "./jobs.js";
import { mountFinder } from "./finder/routes.js";
import { cycle as finderCycle } from "./finder/worker.js";

const PORT = Number(process.env.PORT || 8787);
const SECRET = process.env.FILLGLEN_SECRET || "dev-only-change-me";
const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 40);
const CORS = process.env.CORS_ORIGIN || "http://localhost:5173";

loadDb();

const app = express();
app.use(helmet());
app.use(
  cors({
    origin: [CORS, "http://127.0.0.1:5173", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

function audit(userId: string | null, action: string, meta: Record<string, unknown> = {}) {
  db.insert("audit", { id: id(), userId, action, meta, at: new Date().toISOString() });
}

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Sign in required" });
  const session = db.find("sessions", (s) => s.tokenHash === hashToken(token));
  if (!session) return res.status(401).json({ error: "Invalid session" });
  (req as express.Request & { userId: string }).userId = String(session.userId);
  next();
}

app.get("/health", (_req, res) => res.json({ ok: true, product: "fillglen" }));

app.post("/v1/auth/magic", (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  let user = db.find("users", (u) => u.email === parsed.data.email);
  if (!user) user = db.insert("users", { id: id(), email: parsed.data.email, createdAt: new Date().toISOString() });
  const token = id() + id();
  db.insert("sessions", { id: id(), userId: user.id, tokenHash: hashToken(token), createdAt: new Date().toISOString() });
  audit(String(user.id), "auth.magic");
  // Dev returns the token. Production would email a link instead.
  res.json({ token, userId: user.id, email: user.email });
});

app.get("/v1/me", auth, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const user = db.find("users", (u) => u.id === userId);
  res.json({ user, usageToday: usageToday(userId) });
});

app.get("/v1/profile", auth, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const row = db.find("profiles", (p) => p.userId === userId);
  if (!row) return res.json(EMPTY_PROFILE);
  const profile = row.profile as Profile;
  profile.selfIdentification = JSON.parse(decryptField(String(row.selfEnc), SECRET));
  res.json(profile);
});

app.put("/v1/profile", auth, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const profile = req.body as Profile;
  const selfEnc = encryptField(JSON.stringify(profile.selfIdentification || EMPTY_PROFILE.selfIdentification), SECRET);
  const stored = { ...profile, selfIdentification: EMPTY_PROFILE.selfIdentification };
  const existing = db.find("profiles", (p) => p.userId === userId);
  if (existing) db.update("profiles", (p) => p.userId === userId, { profile: stored, selfEnc, updatedAt: new Date().toISOString() });
  else db.insert("profiles", { userId, profile: stored, selfEnc, updatedAt: new Date().toISOString() });
  audit(userId, "profile.update");
  res.json({ ok: true });
});

app.post("/v1/profile/parse", auth, (req, res) => {
  const parsed = z.object({ text: z.string().min(20) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.json(parseResumeText(parsed.data.text));
});

app.get("/v1/answers", auth, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  res.json(db.filter("answers", (a) => a.userId === userId));
});

app.post("/v1/answers", auth, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const parsed = z.object({ pattern: z.string(), answer: z.string(), tags: z.array(z.string()).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const row = db.insert("answers", { id: id(), userId, ...parsed.data, tags: parsed.data.tags || [], useCount: 0, lastUsedAt: null });
  audit(userId, "answers.create");
  res.json(row);
});

app.delete("/v1/answers/:id", auth, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  db.remove("answers", (a) => a.id === req.params.id && a.userId === userId);
  res.json({ ok: true });
});

app.get("/v1/applications", auth, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const applications = db.filter("applications", (a) => a.userId === userId);
  const jobs = db.filter("jobs", (j) => j.userId === userId);
  res.json({ applications, jobs, events: db.filter("events", () => true) });
});

app.post("/v1/applications", auth, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const body = req.body as { job: Record<string, unknown>; status?: string };
  const jobId = id();
  const now = new Date().toISOString();
  db.insert("jobs", { id: jobId, userId, ...body.job, createdAt: now });
  const application = db.insert("applications", {
    id: id(),
    userId,
    jobId,
    status: body.status || "saved",
    answersSent: [],
    notes: "",
    recruiter: "",
    interviewDates: [],
    followUpOn: null,
    createdAt: now,
    appliedAt: body.status === "applied" ? now : null,
  });
  db.insert("events", { id: id(), applicationId: application.id, status: application.status, at: now });
  audit(userId, "application.create");
  res.json(application);
});

app.patch("/v1/applications/:id", auth, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const row = db.update("applications", (a) => a.id === req.params.id && a.userId === userId, req.body);
  if (req.body.status) db.insert("events", { id: id(), applicationId: req.params.id, status: req.body.status, at: new Date().toISOString() });
  res.json(row);
});

app.get("/v1/applications.csv", auth, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const applications = db.filter("applications", (a) => a.userId === userId);
  const jobs = db.filter("jobs", (j) => j.userId === userId);
  const lines = ["company,title,status,url,createdAt"];
  for (const a of applications) {
    const job = jobs.find((j) => j.id === a.jobId);
    lines.push([job?.company, job?.title, a.status, job?.url, a.createdAt].map((x) => `"${String(x || "").replace(/"/g, '""')}"`).join(","));
  }
  res.setHeader("content-type", "text/csv");
  res.send(lines.join("\n"));
});

app.post("/v1/match", auth, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const row = db.find("profiles", (p) => p.userId === userId);
  const profile = (row?.profile as Profile) || EMPTY_PROFILE;
  res.json(scoreMatch(String(req.body.description || ""), profile));
});

app.post("/v1/tailor", auth, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const row = db.find("profiles", (p) => p.userId === userId);
  const profile = (row?.profile as Profile) || EMPTY_PROFILE;
  const requirements = z.array(z.string()).parse(req.body.requirements || []);
  res.json(tailorResume(profile, String(req.body.description || ""), requirements));
});

app.post("/v1/ai/draft", auth, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (usageToday(userId) >= AI_DAILY_LIMIT) return res.status(429).json({ refused: true, reason: "Daily AI limit reached" });
  const row = db.find("profiles", (p) => p.userId === userId);
  const profile = (row?.profile as Profile) || EMPTY_PROFILE;
  const built = buildAiPrompt(req.body, profile);
  if ("refused" in built) return res.json({ text: "", usedFacts: [], refused: true, reason: built.reason });
  const cacheKey = hashToken(built.user);
  const cached = db.find("aiUsage", (u) => u.userId === userId && u.cacheKey === cacheKey);
  if (cached) return res.json(cached.result);
  const key = process.env.FILLGLEN_LLM_KEY;
  let raw = "NEEDS_HUMAN";
  if (key && process.env.FILLGLEN_LLM_URL) {
    const r = await fetch(process.env.FILLGLEN_LLM_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ system: built.system, user: built.user }),
    });
    raw = String((await r.json() as { text?: string }).text || "NEEDS_HUMAN");
  }
  const draft = parseAiDraft(raw);
  db.insert("aiUsage", { id: id(), userId, tokens: raw.length, day: new Date().toISOString().slice(0, 10), cached: false, cacheKey, result: draft });
  audit(userId, "ai.draft");
  res.json(draft);
});

mountFinder(app, auth);

app.get("/v1/jobs/public", auth, async (req, res) => {
  const q = String(req.query.q || "");
  const location = String(req.query.location || "");
  const remote = String(req.query.remote || "");
  const jobs = await fetchPublicJobs({ q, location, remote });
  res.json({ jobs });
});

app.post("/v1/searches", auth, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const row = db.insert("searches", { id: id(), userId, query: req.body, createdAt: new Date().toISOString() });
  res.json(row);
});

app.get("/v1/export", auth, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  res.json({
    user: db.find("users", (u) => u.id === userId),
    profile: db.find("profiles", (p) => p.userId === userId),
    answers: db.filter("answers", (a) => a.userId === userId),
    jobs: db.filter("jobs", (j) => j.userId === userId),
    applications: db.filter("applications", (a) => a.userId === userId),
  });
});

app.delete("/v1/account", auth, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  for (const table of ["sessions", "profiles", "answers", "jobs", "applications", "documents", "searches", "aiUsage", "feedback", "alerts"] as const) {
    db.remove(table, (r) => r.userId === userId);
  }
  db.remove("users", (u) => u.id === userId);
  audit(null, "account.delete", { userId });
  saveDb();
  res.json({ ok: true });
});

function usageToday(userId: string): number {
  const day = new Date().toISOString().slice(0, 10);
  return db.filter("aiUsage", (u) => u.userId === userId && u.day === day && u.cached === false).length;
}

const isDirect = process.argv[1]?.includes("server");
if (isDirect) {
  app.listen(PORT, () => {
    console.log(`Fillglen API on http://localhost:${PORT}`);
  });
  if (process.env.FINDER_SCHEDULE !== "0") {
    const ms = Number(process.env.FINDER_INTERVAL_MS || 60 * 60 * 1000);
    if (process.env.RUN_FINDER_ON_START !== "false") {
      finderCycle().catch((err) => console.error("finder start", err));
    }
    setInterval(() => finderCycle().catch((err) => console.error("finder", err)), ms);
  }
}

export { app };
