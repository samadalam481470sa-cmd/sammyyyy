import {
  adapterFor,
  diffQuestions,
  EMPTY_PROFILE,
  feedMetaForUrl,
  fieldLooksFilled,
  hydrateProfile,
  KEEP_FILL_GAP_MS,
  KEEP_INTERVAL_MS,
  KEEP_MUTATION_DEBOUNCE_MS,
  KEEP_SCAN_BURST_MS,
  KEEP_STUCK_TICKS,
  looksLikeApplicationPage,
  mayAdvance,
  planPage,
  shouldBlockPage,
  type Profile,
  type Question,
  type ScanSnapshot,
} from "@fillglen/core";
import {
  clickAdvance,
  clickGoogleSignIn,
  clickMatchingDropdown,
  clickVisibleGoogleAccount,
  detectCaptcha,
  findAdvanceControl,
  flashAndScroll,
  readWorkdayStep,
  scanDocument,
  setFieldById,
} from "../../../../packages/core/src/dom";
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

function pageTextNow(): string {
  return document.body?.innerText?.slice(0, 2500) || "";
}

function isVisibleTab(): boolean {
  return document.visibilityState === "visible";
}

function boot() {
  const url = location.href;
  const blocked = shouldBlockPage(url, pageTextNow());
  const applyLike = looksLikeApplicationPage(url, pageTextNow()) || looksLikeApplicationPage(url);
  const frameId = window === window.top ? "top" : `frame:${location.host}${location.pathname.slice(0, 40)}`;

  let port: chrome.runtime.Port | null = null;
  const undoStack: { id: string; prev: string }[] = [];
  let last: Question[] = [];
  let paused = false;
  let keepTimer: number | undefined;
  let stuckTicks = 0;
  let waitingOnCaptcha = false;
  let keepBusy = false;
  let googleClicked = false;

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
      if (msg.type === "keep-tick") keepCycle().catch(() => {});
    });
    port.onDisconnect.addListener(() => {
      port = null;
      setTimeout(connect, 120);
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
    const profile = hydrateProfile((stored.profile as Profile) || EMPTY_PROFILE);
    const questions = scanDocument(document, frameId, profile);
    if (reason === "full" || last.length === 0) {
      last = questions;
      post({ type: "scan", snapshot: snapshot(questions, stored.finderMatches as Parameters<typeof snapshot>[1]) });
      if (window === window.top && isVisibleTab() && questions.length > 0) {
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

  async function keepCycle() {
    if (window !== window.top || keepBusy || !isVisibleTab()) return;
    keepBusy = true;
    try {
      const stored = await chrome.storage.local.get(["keepApplying", "profile", "pausedOrigins"]);
      const originPaused = ((stored.pausedOrigins as string[]) || []).includes(location.origin);
      if (!stored.keepApplying || paused || originPaused || blocked) return;
      if (
        !looksLikeApplicationPage(location.href, document.body?.innerText?.slice(0, 2500) || "") &&
        !/accounts\.google\.com/i.test(location.host)
      ) {
        return;
      }
      if (clickVisibleGoogleAccount(document)) {
        stuckTicks = 0;
        return;
      }
      if (detectCaptcha(document)) {
        if (!waitingOnCaptcha) {
          waitingOnCaptcha = true;
          post({ type: "keep-status", status: "captcha", url });
        }
        return;
      }
      if (waitingOnCaptcha) {
        waitingOnCaptcha = false;
        post({ type: "keep-status", status: "fill", url, detail: "captcha cleared by you" });
      }
      const profile = hydrateProfile((stored.profile as Profile) || EMPTY_PROFILE);
      const questions = scanDocument(document, frameId, profile);
      last = questions;
      const filledCount = questions.filter((q) => fieldLooksFilled(q.kind, q.value)).length;
      const signupWall = /sign up|create (an )?account|continue with google|sign in with google/i.test(
        document.body?.innerText?.slice(0, 2000) || ""
      );
      if (!googleClicked && signupWall && filledCount < 3 && clickGoogleSignIn(document)) {
        googleClicked = true;
        stuckTicks = 0;
        post({ type: "keep-status", status: "fill", url, detail: "google sign-in" });
        return;
      }
      const plans = planPage(questions, profile);
      let hadCustom = false;
      for (const plan of plans) {
        if (!plan.value) continue;
        applyOne(plan.questionId, plan.value);
        const q = questions.find((x) => x.id === plan.questionId);
        if (q && (q.kind === "select" || q.kind === "custom-select" || q.kind === "typeahead" || q.kind === "radio" || q.kind === "checkbox")) {
          if (q.kind === "custom-select" || q.kind === "typeahead") hadCustom = true;
          clickMatchingDropdown(plan.questionId, plan.value);
        }
      }
      await new Promise((r) => setTimeout(r, hadCustom ? Math.max(40, KEEP_FILL_GAP_MS) : KEEP_FILL_GAP_MS));
      const after = scanDocument(document, frameId, profile);
      const stillEmpty = after.filter((q) => q.required && !fieldLooksFilled(q.kind, q.value));
      const found = findAdvanceControl(document, "keep-applying");
      if (!mayAdvance(found?.kind ?? null, stillEmpty.length)) {
        stuckTicks += 1;
        if (stuckTicks >= KEEP_STUCK_TICKS) {
          stuckTicks = 0;
          post({ type: "keep-status", status: "stuck", url, detail: `${stillEmpty.length} required empty` });
        }
        return;
      }
      const clicked = clickAdvance("keep-applying");
      if (clicked?.kind === "next") {
        stuckTicks = 0;
        post({ type: "keep-status", status: "advanced", url });
        return;
      }
      if (clicked?.kind === "submit") {
        stuckTicks = 0;
        post({ type: "keep-status", status: "submitted", url });
        return;
      }
      if (stillEmpty.length) {
        stuckTicks += 1;
        if (stuckTicks >= KEEP_STUCK_TICKS) {
          stuckTicks = 0;
          post({ type: "keep-status", status: "stuck", url, detail: `${stillEmpty.length} required empty` });
        }
      }
    } finally {
      keepBusy = false;
    }
  }

  function startKeepLoop() {
    if (keepTimer || window !== window.top) return;
    keepTimer = window.setInterval(() => {
      keepCycle().catch(() => {});
    }, KEEP_INTERVAL_MS);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.keepApplying) return;
    if (changes.keepApplying.newValue) startKeepLoop();
    else if (keepTimer) {
      clearInterval(keepTimer);
      keepTimer = undefined;
    }
  });

  chrome.storage.local.get(["keepApplying"], (r) => {
    if (r.keepApplying) startKeepLoop();
  });

  let watching = false;
  function watchPage() {
    if (watching) return;
    watching = true;
    if (window === window.top) mountFab();
    scan("full");
    KEEP_SCAN_BURST_MS.forEach((ms) => setTimeout(() => scan("full"), ms));
    const obs = new MutationObserver(() => {
      clearTimeout((obs as unknown as { t?: number }).t);
      (obs as unknown as { t?: number }).t = window.setTimeout(() => {
        scan("delta");
        if (!paused) keepCycle().catch(() => {});
      }, KEEP_MUTATION_DEBOUNCE_MS) as unknown as number;
    });
    obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });
  }

  function whenReady(fn: () => void) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  whenReady(() => {
    if (applyLike || looksLikeApplicationPage(url, pageTextNow())) watchPage();
    chrome.storage.local.get(["keepApplying"], (r) => {
      if (r.keepApplying) {
        watchPage();
        startKeepLoop();
        keepCycle().catch(() => {});
      }
    });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.keepApplying?.newValue) {
      whenReady(() => {
        watchPage();
        startKeepLoop();
        keepCycle().catch(() => {});
      });
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!isVisibleTab()) return;
    chrome.storage.local.get(["keepApplying"], (r) => {
      if (!r.keepApplying) return;
      whenReady(() => {
        watchPage();
        startKeepLoop();
        keepCycle().catch(() => {});
      });
    });
  });
  window.addEventListener("pageshow", () => {
    if (!isVisibleTab()) return;
    keepCycle().catch(() => {});
  });

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
