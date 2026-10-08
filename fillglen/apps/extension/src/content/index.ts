import {
  adapterFor,
  diffQuestions,
  EMPTY_PROFILE,
  feedMetaForUrl,
  planPage,
  shouldBlockPage,
  type Profile,
  type Question,
  type ScanSnapshot,
} from "@fillglen/core";
import { flashAndScroll, readWorkdayStep, scanDocument, setFieldById } from "../../../../packages/core/src/dom";
import type { ToBackground, ToContent } from "../shared/messages";

declare global {
  interface Window {
    __fillglen?: boolean;
  }
}

if (!window.__fillglen) {
  window.__fillglen = true;
  boot();
}

function boot() {
  const url = location.href;
  const blocked = shouldBlockPage(url, document.body?.innerText?.slice(0, 2000) || "");
  const frameId = window === window.top ? "top" : `frame:${location.host}${location.pathname.slice(0, 40)}`;

  let port: chrome.runtime.Port | null = null;
  const undoStack: { id: string; prev: string }[] = [];
  let last: Question[] = [];
  let paused = false;

  function connect() {
    port = chrome.runtime.connect({ name: "fillglen-content" });
    port.onMessage.addListener((msg: ToContent) => {
      if (msg.type === "pause") paused = true;
      if (paused) return;
      if (msg.type === "fill-one") applyOne(msg.questionId, msg.value);
      if (msg.type === "fill-plans") {
        for (const plan of msg.plans) {
          if (plan.value) applyOne(plan.questionId, plan.value);
        }
      }
      if (msg.type === "focus") flashAndScroll(msg.questionId);
      if (msg.type === "undo") undo(msg.questionId);
    });
    port.onDisconnect.addListener(() => {
      port = null;
      setTimeout(connect, 500);
    });
  }
  connect();

  function post(msg: ToBackground) {
    try {
      port?.postMessage(msg);
    } catch {
      connect();
    }
  }

  function snapshot(
    questions: Question[],
    finderMatches?: { lookup?: { url: string; score: number; why?: string; source?: string }[]; top?: { url: string; score: number; why?: string; source?: string }[] }
  ): ScanSnapshot {
    const adapter = adapterFor(url);
    const step = adapter?.id === "workday" ? readWorkdayStep() : undefined;
    const heading = document.querySelector("h1, h2")?.textContent?.trim() || document.title;
    const job = adapter
      ? adapter.readJobMeta({
          url,
          title: document.title,
          heading,
          bodyText: document.body?.innerText?.slice(0, 8000),
        })
      : {
          company: location.hostname,
          title: heading,
          board: "unknown",
          url,
          description: document.body?.innerText?.slice(0, 8000) || "",
        };
    if (step) {
      job.stepLabel = step.label;
      job.stepIndex = step.index;
      job.stepTotal = step.total;
    }
    const lookup = [...(finderMatches?.lookup || []), ...(finderMatches?.top || [])];
    const feed = feedMetaForUrl(url, lookup);
    if (feed) Object.assign(job, feed);
    return { job, questions, blockedReason: blocked || undefined };
  }

  async function scan(reason: "full" | "delta") {
    if (blocked) {
      if (window === window.top) post({ type: "scan", snapshot: snapshot([]) });
      return;
    }
    const stored = await chrome.storage.local.get(["profile", "pausedOrigins", "finderMatches"]);
    const origin = location.origin;
    paused = ((stored.pausedOrigins as string[]) || []).includes(origin);
    if (paused) return;
    const profile = (stored.profile as Profile) || EMPTY_PROFILE;
    const questions = scanDocument(document, frameId, profile);
    if (reason === "full" || last.length === 0) {
      last = questions;
      post({ type: "scan", snapshot: snapshot(questions, stored.finderMatches as Parameters<typeof snapshot>[1]) });
      if (window === window.top && questions.length > 0) {
        const plans = planPage(questions, profile).filter((p) => p.value);
        for (const plan of plans) applyOne(plan.questionId, plan.value);
      }
      return;
    }
    const diff = diffQuestions(last, questions);
    last = questions;
    if (diff.added.length || diff.removed.length || diff.changed.length) {
      post({ type: "delta", questions });
    }
  }

  function applyOne(id: string, value: string) {
    const el = document.querySelector(`[data-fillglen-id="${CSS.escape(id)}"]`) as HTMLInputElement | null;
    const prev = el ? el.value : "";
    undoStack.push({ id, prev });
    const result = setFieldById(id, value);
    const q = last.find((x) => x.id === id);
    if (q) {
      q.value = result.readBack || value;
      q.status = result.ok ? "filled" : "needs-review";
      q.error = result.error;
      q.source = "profile";
    }
    post({ type: "delta", questions: last });
  }

  function undo(id?: string) {
    const item = id ? [...undoStack].reverse().find((u) => u.id === id) : undoStack.pop();
    if (!item) return;
    setFieldById(item.id, item.prev);
  }

  if (window === window.top) mountFab();

  scan("full");
  [200, 600, 1500, 3000, 6000].forEach((ms) => setTimeout(() => scan("full"), ms));

  const obs = new MutationObserver(() => {
    clearTimeout((obs as unknown as { t?: number }).t);
    (obs as unknown as { t?: number }).t = window.setTimeout(() => scan("delta"), 200) as unknown as number;
  });
  obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });

  document.addEventListener(
    "input",
    (ev) => {
      const t = ev.target as HTMLElement | null;
      const id = t?.getAttribute("data-fillglen-id");
      if (!id) return;
      const value = (t as HTMLInputElement).value;
      post({ type: "typed", questionId: id, value });
    },
    true
  );

  function mountFab() {
    if (document.getElementById("fillglen-fab")) return;
    const root = document.createElement("div");
    root.id = "fillglen-fab";
    root.style.cssText = "all:initial; position:fixed; bottom:20px; right:20px; z-index:2147483647;";
    const btn = document.createElement("button");
    btn.textContent = "Fg";
    btn.title = "Open Fillglen live question window";
    btn.style.cssText =
      "width:44px;height:44px;border-radius:14px;border:none;background:#1b3a2f;color:#f6f1e8;font:700 14px/1 ui-serif, Georgia, serif;cursor:pointer;box-shadow:0 8px 20px rgba(20,34,28,.28);";
    btn.addEventListener("click", () => post({ type: "open-panel" }));
    root.appendChild(btn);
    document.documentElement.appendChild(root);
  }
}
