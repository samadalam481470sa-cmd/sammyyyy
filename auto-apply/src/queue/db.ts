import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { paths, ensureDataDirs } from "../paths";
import type { Job } from "../discovery/types";

let db: Database.Database | null = null;
let dbPathOpen: string | null = null;

export function getDb(): Database.Database {
  const target = paths.db;
  if (db && dbPathOpen === target) return db;
  if (db) {
    db.close();
    db = null;
  }
  ensureDataDirs();
  db = new Database(target);
  dbPathOpen = target;
  db.pragma("journal_mode = WAL");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
  return db;
}

export function insertIfNew(job: Job): boolean {
  const result = getDb()
    .prepare(
      `INSERT OR IGNORE INTO jobs (id, company, title, location, url, ats, description, status)
       VALUES (@id, @company, @title, @location, @url, @ats, @description, 'new')`
    )
    .run(job);
  return result.changes > 0;
}

export function setStatus(jobId: string, status: string, notes = ""): void {
  getDb()
    .prepare(`UPDATE jobs SET status = ?, notes = CASE WHEN ? = '' THEN notes ELSE ? END WHERE id = ?`)
    .run(status, notes, notes, jobId);
}

export function setScore(jobId: string, score: number): void {
  getDb().prepare(`UPDATE jobs SET score = ? WHERE id = ?`).run(score, jobId);
}

export function listByStatus(status: string): any[] {
  return getDb().prepare(`SELECT * FROM jobs WHERE status = ? ORDER BY score DESC, found_at DESC`).all(status);
}

export function getJob(id: string): any | null {
  return getDb().prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) ?? null;
}

export function matchNewJobs(scoreFn: (job: Job) => number, minScore: number): number {
  const rows = getDb().prepare(`SELECT * FROM jobs WHERE status = 'new'`).all() as any[];
  let matched = 0;
  for (const row of rows) {
    const job: Job = {
      id: row.id,
      company: row.company,
      title: row.title,
      location: row.location,
      url: row.url,
      description: row.description,
      ats: row.ats,
      postedAt: row.found_at,
    };
    const score = scoreFn(job);
    setScore(job.id, score);
    if (score >= minScore) {
      setStatus(job.id, "matched");
      matched++;
    } else {
      setStatus(job.id, "skipped", `score ${score} below ${minScore}`);
    }
  }
  return matched;
}

export function submittedToday(): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM applications
       WHERE submitted_at IS NOT NULL AND date(submitted_at) = date('now')`
    )
    .get() as { n: number };
  return row.n;
}

export function submittedThisWeekForCompany(company: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE j.company = ? AND a.submitted_at IS NOT NULL
         AND datetime(a.submitted_at) >= datetime('now', '-7 days')`
    )
    .get(company) as { n: number };
  return row.n;
}

export function alreadySubmittedDuplicate(job: Job): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 AS ok FROM jobs j
       JOIN applications a ON a.job_id = j.id
       WHERE a.submitted_at IS NOT NULL
         AND (j.url = ? OR (lower(j.company) = lower(?) AND lower(j.title) = lower(?)))
       LIMIT 1`
    )
    .get(job.url, job.company, job.title);
  return !!row;
}

/** Approved jobs first, then matched jobs ready to draft. */
export function nextJob(): { job: Job; approved: boolean } | null {
  const approved = getDb()
    .prepare(`SELECT * FROM jobs WHERE status = 'approved' ORDER BY score DESC LIMIT 1`)
    .get() as any;
  if (approved) return { job: rowToJob(approved), approved: true };

  const matched = getDb()
    .prepare(`SELECT * FROM jobs WHERE status = 'matched' ORDER BY score DESC LIMIT 1`)
    .get() as any;
  if (matched) return { job: rowToJob(matched), approved: false };
  return null;
}

function rowToJob(row: any): Job {
  return {
    id: row.id,
    company: row.company,
    title: row.title,
    location: row.location,
    url: row.url,
    description: row.description || "",
    ats: row.ats,
    postedAt: row.found_at,
  };
}

export function saveApplication(
  jobId: string,
  data: {
    resumePath?: string;
    coverLetterPath?: string;
    aiAnswers?: Record<string, string>;
    screenshot?: string;
    submittedAt?: string;
    outcome?: string;
  }
): void {
  getDb()
    .prepare(
      `INSERT INTO applications (job_id, resume_path, cover_letter_path, answers_json, screenshot_path, submitted_at, outcome)
       VALUES (@job_id, @resume_path, @cover_letter_path, @answers_json, @screenshot_path, @submitted_at, @outcome)
       ON CONFLICT(job_id) DO UPDATE SET
         resume_path = COALESCE(excluded.resume_path, applications.resume_path),
         cover_letter_path = COALESCE(excluded.cover_letter_path, applications.cover_letter_path),
         answers_json = COALESCE(excluded.answers_json, applications.answers_json),
         screenshot_path = COALESCE(excluded.screenshot_path, applications.screenshot_path),
         submitted_at = COALESCE(excluded.submitted_at, applications.submitted_at),
         outcome = COALESCE(excluded.outcome, applications.outcome)`
    )
    .run({
      job_id: jobId,
      resume_path: data.resumePath ?? null,
      cover_letter_path: data.coverLetterPath ?? null,
      answers_json: data.aiAnswers ? JSON.stringify(data.aiAnswers) : null,
      screenshot_path: data.screenshot ?? null,
      submitted_at: data.submittedAt ?? null,
      outcome: data.outcome ?? null,
    });
}

export function getApplication(jobId: string): any | null {
  return getDb().prepare(`SELECT * FROM applications WHERE job_id = ?`).get(jobId) ?? null;
}

function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findSavedAnswer(question: string): string | null {
  const normalized = normalizeQuestion(question);
  const exact = getDb()
    .prepare(`SELECT answer FROM saved_answers WHERE lower(question) = ? AND approved = 1`)
    .get(question.toLowerCase().trim()) as { answer: string } | undefined;
  if (exact) return exact.answer;

  const all = getDb()
    .prepare(`SELECT question, answer FROM saved_answers WHERE approved = 1`)
    .all() as { question: string; answer: string }[];
  for (const row of all) {
    const q = normalizeQuestion(row.question);
    if (!q) continue;
    if (normalized === q || normalized.includes(q) || q.includes(normalized)) return row.answer;
  }
  return null;
}

export function saveApprovedAnswer(question: string, answer: string): void {
  getDb()
    .prepare(
      `INSERT INTO saved_answers (question, answer, approved) VALUES (?, ?, 1)
       ON CONFLICT(question) DO UPDATE SET answer = excluded.answer, approved = 1`
    )
    .run(question.trim(), answer.trim());
}

export function pauseSite(host: string, hours: number, reason: string): void {
  const until = new Date(Date.now() + hours * 3600_000).toISOString();
  getDb()
    .prepare(
      `INSERT INTO site_pauses (host, until_ts, reason) VALUES (?, ?, ?)
       ON CONFLICT(host) DO UPDATE SET until_ts = excluded.until_ts, reason = excluded.reason`
    )
    .run(host, until, reason);
}

export function isSitePaused(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    const row = getDb()
      .prepare(`SELECT until_ts FROM site_pauses WHERE host = ?`)
      .get(host) as { until_ts: string } | undefined;
    if (!row) return false;
    return new Date(row.until_ts).getTime() > Date.now();
  } catch {
    return false;
  }
}

export function tracker(filter?: string): any[] {
  if (filter) {
    return getDb()
      .prepare(
        `SELECT j.*, a.resume_path, a.cover_letter_path, a.screenshot_path, a.submitted_at, a.answers_json
         FROM jobs j LEFT JOIN applications a ON a.job_id = j.id
         WHERE j.status = ? ORDER BY j.found_at DESC LIMIT 200`
      )
      .all(filter);
  }
  return getDb()
    .prepare(
      `SELECT j.*, a.resume_path, a.cover_letter_path, a.screenshot_path, a.submitted_at, a.answers_json
       FROM jobs j LEFT JOIN applications a ON a.job_id = j.id
       ORDER BY j.found_at DESC LIMIT 200`
    )
    .all();
}

export function countsByStatus(): Record<string, number> {
  const rows = getDb().prepare(`SELECT status, COUNT(*) AS n FROM jobs GROUP BY status`).all() as {
    status: string;
    n: number;
  }[];
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}
