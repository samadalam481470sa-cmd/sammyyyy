const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'newport.db');

const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS mgas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pipeline', 'acquired')),
  years_of_experience INTEGER NOT NULL CHECK (years_of_experience >= 0),
  headquarters TEXT,
  principal_contact TEXT,
  notes TEXT,
  acquired_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mga_financials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mga_id INTEGER NOT NULL REFERENCES mgas(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  ebitda REAL NOT NULL,
  UNIQUE (mga_id, fiscal_year)
);

CREATE TABLE IF NOT EXISTS insurance_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mga_id INTEGER NOT NULL REFERENCES mgas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  line_of_business TEXT NOT NULL,
  coverage_type TEXT NOT NULL,
  geographic_region TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS retail_agencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mga_id INTEGER NOT NULL REFERENCES mgas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  principal TEXT,
  state TEXT,
  annual_premium REAL
);

CREATE INDEX IF NOT EXISTS idx_financials_mga ON mga_financials(mga_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_programs_mga ON insurance_programs(mga_id);
CREATE INDEX IF NOT EXISTS idx_agencies_mga ON retail_agencies(mga_id);
`);

module.exports = db;
