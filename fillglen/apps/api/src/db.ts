import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Row = Record<string, unknown>;

interface Store {
  users: Row[];
  sessions: Row[];
  profiles: Row[];
  answers: Row[];
  jobs: Row[];
  applications: Row[];
  events: Row[];
  documents: Row[];
  searches: Row[];
  audit: Row[];
  aiUsage: Row[];
  listings: Row[];
  employers: Row[];
  scoreCache: Row[];
  feedback: Row[];
  alerts: Row[];
  harvestLog: Row[];
  localRecords: Row[];
}

const DATA = process.env.FILLGLEN_DATA || path.join(process.cwd(), ".data", "fillglen.json");

function empty(): Store {
  return {
    users: [],
    sessions: [],
    profiles: [],
    answers: [],
    jobs: [],
    applications: [],
    events: [],
    documents: [],
    searches: [],
    audit: [],
    aiUsage: [],
    listings: [],
    employers: [],
    scoreCache: [],
    feedback: [],
    alerts: [],
    harvestLog: [],
    localRecords: [],
  };
}

let mem: Store = empty();

export function loadDb() {
  mkdirSync(path.dirname(DATA), { recursive: true });
  if (existsSync(DATA)) mem = { ...empty(), ...JSON.parse(readFileSync(DATA, "utf8")) };
  else saveDb();
}

export function saveDb() {
  mkdirSync(path.dirname(DATA), { recursive: true });
  writeFileSync(DATA, JSON.stringify(mem, null, 2));
}

export function id(): string {
  return randomBytes(12).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function encryptField(plain: string, secret: string): string {
  const salt = secret.slice(0, 16).padEnd(16, "0");
  const key = scryptSync(secret, salt, 32);
  const buf = Buffer.from(plain, "utf8");
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ key[i % key.length];
  return `enc:${out.toString("base64")}`;
}

export function decryptField(cipher: string, secret: string): string {
  if (!cipher.startsWith("enc:")) return cipher;
  const salt = secret.slice(0, 16).padEnd(16, "0");
  const key = scryptSync(secret, salt, 32);
  const buf = Buffer.from(cipher.slice(4), "base64");
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ key[i % key.length];
  return out.toString("utf8");
}

export const db = {
  get mem() {
    return mem;
  },
  insert<K extends keyof Store>(table: K, row: Row): Row {
    mem[table].push(row);
    saveDb();
    return row;
  },
  find<K extends keyof Store>(table: K, pred: (r: Row) => boolean): Row | undefined {
    return mem[table].find(pred);
  },
  filter<K extends keyof Store>(table: K, pred: (r: Row) => boolean): Row[] {
    return mem[table].filter(pred);
  },
  update<K extends keyof Store>(table: K, pred: (r: Row) => boolean, patch: Row): Row | undefined {
    const row = mem[table].find(pred);
    if (!row) return;
    Object.assign(row, patch);
    saveDb();
    return row;
  },
  remove<K extends keyof Store>(table: K, pred: (r: Row) => boolean): void {
    mem[table] = mem[table].filter((r) => !pred(r)) as Store[K];
    saveDb();
  },
  replace<K extends keyof Store>(table: K, rows: Store[K]): Store[K] {
    mem[table] = rows;
    saveDb();
    return mem[table];
  },
};

export function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}

/**
 * PostgreSQL is the production target. Local/dev uses the JSON store above so
 * the API runs without a cluster. SCHEMA.sql documents the Postgres shape.
 */
export const DATABASE_TARGET = process.env.DATABASE_URL ? "postgres" : "local-json";
