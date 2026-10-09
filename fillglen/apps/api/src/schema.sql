-- Fillglen production schema (PostgreSQL).
-- Local development uses the JSON store in db.ts when DATABASE_URL is unset.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  contact JSONB NOT NULL,
  work JSONB NOT NULL DEFAULT '[]',
  education JSONB NOT NULL DEFAULT '[]',
  skills JSONB NOT NULL DEFAULT '[]',
  preferences JSONB NOT NULL,
  self_identification_enc TEXT NOT NULL,
  raw_resume_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE saved_answers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]',
  use_count INT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  board TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  resume_version_id TEXT,
  answers_sent JSONB NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  recruiter TEXT NOT NULL DEFAULT '',
  interview_dates JSONB NOT NULL DEFAULT '[]',
  follow_up_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at TIMESTAMPTZ
);

CREATE TABLE status_events (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  application_id TEXT,
  text TEXT NOT NULL
);

CREATE TABLE saved_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}',
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tokens INT NOT NULL,
  day DATE NOT NULL,
  cached BOOLEAN NOT NULL DEFAULT false
);

-- 24/7 local finder (server-side). AI never inserts rows here.
CREATE TABLE listings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location_text TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  work_mode TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  sources JSONB NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_checked_at TIMESTAMPTZ NOT NULL,
  posted_at TIMESTAMPTZ,
  status TEXT NOT NULL
);

CREATE TABLE employers (
  company TEXT NOT NULL,
  metro TEXT NOT NULL,
  careers_url TEXT NOT NULL,
  board TEXT NOT NULL,
  slug TEXT NOT NULL,
  source_kind TEXT NOT NULL
);

CREATE TABLE score_cache (
  key TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  card JSONB NOT NULL,
  at TIMESTAMPTZ NOT NULL
);

CREATE TABLE listing_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id TEXT,
  company TEXT,
  sentiment TEXT NOT NULL,
  reason TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE finder_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL,
  score INT NOT NULL,
  why TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  timing TEXT NOT NULL
);

-- In-app database archive. The hourly finder writes here 24/7; the extension
-- dual-writes the same shape into IndexedDB while Chrome is open.
CREATE TABLE harvest_log (
  id TEXT PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL,
  fetched INT NOT NULL DEFAULT 0,
  stored INT NOT NULL DEFAULT 0,
  closed INT NOT NULL DEFAULT 0,
  maps INT NOT NULL DEFAULT 0,
  via TEXT NOT NULL DEFAULT 'finder',
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE local_records (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  score INT,
  why TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  opened_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  text TEXT NOT NULL DEFAULT '',
  meta JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX local_records_kind_idx ON local_records (kind);
CREATE INDEX local_records_last_seen_idx ON local_records (last_seen_at DESC);
CREATE INDEX local_records_company_idx ON local_records (company);
CREATE INDEX local_records_text_idx ON local_records USING gin (to_tsvector('simple', text));
