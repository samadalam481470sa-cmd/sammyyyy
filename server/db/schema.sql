-- Newport Specialty Partners Acquisition CRM Database
-- SQLite database for acquisition deal tracking (confidential M&A data).
-- Schema is the source of truth; replace SQLite with Postgres in production.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'partner', 'analyst', 'viewer')),
  initials TEXT NOT NULL,
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Exactly five API key slots for application access (keys provisioned by security team).
-- Only hashed keys are stored. Plaintext keys are never persisted.
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  slot INTEGER NOT NULL UNIQUE CHECK (slot BETWEEN 1 AND 5),
  label TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'revoked')),
  created_by TEXT,
  last_used_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  auth_method TEXT NOT NULL CHECK (auth_method IN ('demo', 'api_key', 'password')),
  api_key_id TEXT REFERENCES api_keys(id),
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  project_number INTEGER NOT NULL UNIQUE,
  project_name TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT NOT NULL,
  deal_lead TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  geography TEXT NOT NULL,
  nwp REAL NOT NULL DEFAULT 0,
  net_revenue REAL NOT NULL DEFAULT 0,
  pf_ebitda REAL NOT NULL DEFAULT 0,
  next_action TEXT,
  next_action_date TEXT,
  priority TEXT NOT NULL DEFAULT 'C',
  last_activity_date TEXT NOT NULL,
  needs_attention INTEGER NOT NULL DEFAULT 0,
  attention_reasons TEXT NOT NULL DEFAULT '[]',
  outstanding_items TEXT NOT NULL DEFAULT '[]',
  diligence_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  detail TEXT NOT NULL,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
