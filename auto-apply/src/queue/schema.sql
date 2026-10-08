CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  company TEXT,
  title TEXT,
  location TEXT,
  url TEXT,
  ats TEXT,
  description TEXT,
  score REAL,
  status TEXT DEFAULT 'new',
  found_at TEXT DEFAULT CURRENT_TIMESTAMP,
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS applications (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id),
  resume_path TEXT,
  cover_letter_path TEXT,
  answers_json TEXT,
  submitted_at TEXT,
  screenshot_path TEXT,
  outcome TEXT
);

CREATE TABLE IF NOT EXISTS saved_answers (
  question TEXT PRIMARY KEY,
  answer TEXT,
  approved INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS site_pauses (
  host TEXT PRIMARY KEY,
  until_ts TEXT NOT NULL,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
