import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_SESSION,
  SESSION_ACTION_CAP,
  appendAction,
  forgetTabId,
  hydrateSession,
  overlaySavedValues,
  pageKeepForUrl,
  putTabSnapshot,
  rememberKeep,
  rememberPageKeep,
  rememberWarmup,
  snapshotForTab,
  snapshotForUrl,
  snapshotsFromSession,
  type Question,
} from "../src/index.js";

function q(id: string, label: string, value = ""): Question {
  return {
    id,
    label,
    required: true,
    kind: "text",
    type: "unknown",
    value,
    source: value ? "user" : "none",
    status: value ? "filled" : "needs-you",
    confidence: "high",
    position: 0,
  };
}

describe("session memory across tabs", () => {
  it("saves a listing snapshot and restores it after a tab switch", () => {
    const snap = {
      job: {
        company: "Acme",
        title: "IT Support",
        board: "greenhouse",
        url: "https://boards.greenhouse.io/acme/jobs/1?gh_src=x",
        description: "Help desk",
      },
      questions: [q("1", "Email", "sam@example.com")],
    };
    const mem = putTabSnapshot(EMPTY_SESSION, snap, 12);
    const fromTab = snapshotForTab(mem, 12);
    const fromUrl = snapshotForUrl(mem, "https://boards.greenhouse.io/acme/jobs/1");
    assert.equal(fromTab?.job.title, "IT Support");
    assert.equal(fromTab?.questions[0].value, "sam@example.com");
    assert.equal(fromUrl?.job.company, "Acme");
    assert.equal(mem.lastTabId, 12);
    const restored = snapshotsFromSession(mem);
    assert.equal(restored[0]?.tabId, 12);
    assert.equal(restored[0]?.snap.questions[0].value, "sam@example.com");
  });

  it("overlays saved answers onto a fresh scan of the same job", () => {
    const saved = [q("1", "First name", "Sam"), q("2", "Email", "sam@example.com")];
    const fresh = [q("1", "First name", ""), q("2", "Email", "")];
    const merged = overlaySavedValues(fresh, saved);
    assert.equal(merged[0].value, "Sam");
    assert.equal(merged[1].value, "sam@example.com");
    const typed = overlaySavedValues([q("1", "First name", "Alex")], saved);
    assert.equal(typed[0].value, "Alex");
  });

  it("keeps a ring of actions including keep-applying status", () => {
    let mem = EMPTY_SESSION;
    for (let i = 0; i < SESSION_ACTION_CAP + 20; i++) {
      mem = appendAction(mem, {
        at: `2026-10-09T00:00:${String(i % 60).padStart(2, "0")}.000Z`,
        type: "open-job",
        url: `https://jobs.example/${i}`,
        title: "Role",
        company: "Co",
        detail: String(i),
      });
    }
    assert.equal(mem.actions.length, SESSION_ACTION_CAP);
    mem = rememberKeep(mem, "submitted", "https://jobs.example/9", "done", 3);
    assert.equal(mem.keepStatus, "submitted");
    assert.equal(mem.lastTabId, 3);
    assert.ok(mem.actions.at(-1)?.detail.includes("submitted"));
  });

  it("restores keep-loop flags after leaving a tab", () => {
    const mem = rememberPageKeep(EMPTY_SESSION, {
      url: "https://jobs.example/42?src=x",
      stuckTicks: 5,
      googleClicked: true,
      waitingOnCaptcha: true,
      undoStack: [{ id: "1", prev: "" }],
    });
    const keep = pageKeepForUrl(mem, "https://jobs.example/42");
    assert.equal(keep?.stuckTicks, 5);
    assert.equal(keep?.googleClicked, true);
    assert.equal(keep?.waitingOnCaptcha, true);
    assert.equal(keep?.undoStack[0].id, "1");
  });

  it("keeps a job snapshot when the tab id is forgotten after close", () => {
    const snap = {
      job: { company: "Acme", title: "IT Support", board: "greenhouse", url: "https://jobs.example/1", description: "" },
      questions: [q("1", "Email", "sam@example.com")],
    };
    let mem = putTabSnapshot(EMPTY_SESSION, snap, 9);
    mem = forgetTabId(mem, 9);
    assert.equal(snapshotForTab(mem, 9), undefined);
    assert.equal(snapshotForUrl(mem, "https://jobs.example/1")?.questions[0].value, "sam@example.com");
  });

  it("remembers warmup tab across a service-worker restart hydrate", () => {
    const mem = rememberWarmup(EMPTY_SESSION, 44, "https://jobs.example/next");
    const again = hydrateSession(JSON.parse(JSON.stringify(mem)));
    assert.equal(again.warmupTabId, 44);
    assert.equal(again.warmupUrl, "https://jobs.example/next");
  });

  it("hydrates missing storage as an empty session", () => {
    const mem = hydrateSession(null);
    assert.equal(mem.actions.length, 0);
    assert.deepEqual(Object.keys(mem.tabs), []);
    assert.deepEqual(Object.keys(mem.pageKeep), []);
  });
});
