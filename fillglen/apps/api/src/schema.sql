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
