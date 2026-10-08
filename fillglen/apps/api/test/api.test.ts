import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import http from "node:http";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.FILLGLEN_DATA = path.join(mkdtempSync(path.join(os.tmpdir(), "fg-")), "db.json");
process.env.FILLGLEN_SECRET = "test-secret";

const { app } = await import("../src/server.ts");
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, resolve));
const addr = server.address();
const port = typeof addr === "object" && addr ? addr.port : 0;
const base = `http://127.0.0.1:${port}`;

async function json(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  return { status: res.status, body: await res.json() };
}

describe("Fillglen API", () => {
  let token = "";
  it("health", async () => {
    const r = await json(`${base}/health`);
    assert.equal(r.body.ok, true);
  });
  it("magic link issues a hashed session", async () => {
    const r = await json(`${base}/v1/auth/magic`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "sam@fillglen.test" }),
    });
    assert.equal(r.status, 200);
    token = r.body.token;
    assert.ok(token);
  });
  it("rejects bad email", async () => {
    const r = await json(`${base}/v1/auth/magic`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nope" }),
    });
    assert.equal(r.status, 400);
  });
  it("AI draft refuses self-id without calling a model", async () => {
    const r = await json(`${base}/v1/ai/draft`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: "Gender?", type: "gender", jobTitle: "E", company: "C", jobDescription: "" }),
    });
    assert.equal(r.body.refused, true);
  });
  it("match score explains itself", async () => {
    const r = await json(`${base}/v1/match`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ description: "Required: TypeScript" }),
    });
    assert.match(r.body.explanation, /not a prediction/i);
  });
  it("export and delete account", async () => {
    const exp = await json(`${base}/v1/export`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(exp.body.user.email, "sam@fillglen.test");
    const del = await json(`${base}/v1/account`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
    assert.equal(del.body.ok, true);
  });
});

after(() => server.close());
