import {
  adapterFor,
  diffQuestions,
  EMPTY_PROFILE,
  ensureVaultSecret,
  feedMetaForUrl,
  fieldLooksFilled,
  hostHasPriorApply,
  isAuthChoiceScreen,
  hydrateProfile,
  hydrateSession,
  bytesForUpload,
  fillPaceForPage,
  KEEP_COOLDOWN_MS,
  KEEP_DROPDOWN_SETTLE_MS,
  KEEP_FIELDS_PER_TICK,
  KEEP_FILL_GAP_MS,
  KEEP_INTERVAL_MS,
  KEEP_MUTATION_DEBOUNCE_MS,
  KEEP_SCAN_BURST_MS,
  KEEP_SLOW_GAP_MS,
  KEEP_STUCK_TICKS,
  looksLikeJobListingCopy,
  SCREEN_CLICK_BUDGET,
  trimScreenSkip,
  loginForFill,
  loginHost,
  looksLikeApplicationPage,
  looksLikeAppliedBeforePrompt,
  looksLikeAuthWall,
  mayAdvance,
  overlaySavedValues,
  pageKeepForUrl,
  planPage,
  priorLogin,
  shouldBlockPage,
  shouldSkipWarmupFill,
  snapshotForUrl,
  upsertBoardLogin,
  type BoardLogin,
  type Profile,
  type Question,
  type ScanSnapshot,
} from "@fillglen/core";
import {
  attachFileToInput,
  clickAdvance,
  clickAppliedBefore,
  clickAuthGate,
  clickGoogleSignIn,
  clickMatchingDropdown,
  clickScreenAction,
  clickVisibleGoogleAccount,
  collectAuthButtons,
  detectCaptcha,
  fillBoardLogin,
  findAdvanceControl,
  findFileInputs,
  flashAndScroll,
  readWorkdayStep,
  scanDocument,
  setFieldById,
  setFieldPaced,
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
  let keepCooldownUntil = 0;
  let googleClicked = false;
  let keepRestored = false;
  let persistTimer: number | undefined;
  let screenSkip: string[] = [];

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
      if (msg.type === "keep-tick") keepCycle({ allowHidden: true }).catch(() => {});
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
    const pageUrl = location.href;
    const adapter = adapterFor(pageUrl);
    const step = adapter?.id === "workday" ? readWorkdayStep() : undefined;
    const heading = document.querySelector("h1, h2")?.textContent?.trim() || document.title;
    const job = adapter
      ? adapter.readJobMeta({
          url: pageUrl,
          title: document.title,
          heading,
          bodyText: document.body?.innerText?.slice(0, 8000),
        })
      : {
          company: location.hostname,
          title: heading,
          board: "unknown",
          url: pageUrl,
          description: document.body?.innerText?.slice(0, 8000) || "",
        };
    if (step) {
      job.stepLabel = step.label;
      job.stepIndex = step.index;
      job.stepTotal = step.total;
    }
    const lookup = [...(finderMatches?.lookup || []), ...(finderMatches?.top || [])];
    const feed = feedMetaForUrl(pageUrl, lookup);
    if (feed) Object.assign(job, feed);
    return { job, questions, blockedReason: blocked || undefined };
  }

  async function savedSession() {
    const stored = await chrome.storage.local.get(["sessionMemory"]);
    return hydrateSession(stored.sessionMemory);
  }

  async function restoreSaved(questions: Question[]): Promise<Question[]> {
    const mem = await savedSession();
    const saved = snapshotForUrl(mem, location.href);
    const merged = overlaySavedValues(questions, saved?.questions || []);
    if (!keepRestored) {
      keepRestored = true;
      const keep = pageKeepForUrl(mem, location.href);
      if (keep) {
        stuckTicks = keep.stuckTicks;
        googleClicked = keep.googleClicked;
        waitingOnCaptcha = keep.waitingOnCaptcha;
        if (keep.undoStack?.length) {
          undoStack.splice(0, undoStack.length, ...keep.undoStack);
        }
      }
    }
    for (const q of merged) {
      const live = questions.find((x) => x.id === q.id);
      if (!q.value || fieldLooksFilled(q.kind, live?.value || "")) continue;
      setFieldById(q.id, q.value);
    }
    return merged;
  }

  function persistPage(reason: "hide" | "typed" | "scan" = "hide") {
    if (window !== window.top) return;
    const snap = last.length ? snapshot(last) : undefined;
    post({ type: "persist-now", snapshot: snap, questions: last });
    const pageUrl = location.href;
    post({
      type: "page-keep",
      keep: {
        url: pageUrl,
        stuckTicks,
        googleClicked,
        waitingOnCaptcha,
        undoStack: undoStack.slice(-80),
      },
    });
    if (reason === "hide" || !port) {
      chrome.runtime.sendMessage({ type: "persist-now", snapshot: snap, questions: last }).catch(() => {});
      chrome.runtime
        .sendMessage({
          type: "page-keep",
          keep: { url: pageUrl, stuckTicks, googleClicked, waitingOnCaptcha, undoStack: undoStack.slice(-80) },
        })
        .catch(() => {});
    }
  }

  function schedulePersist() {
    if (persistTimer) window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => persistPage("typed"), 120);
  }

  async function scan(reason: "full" | "delta") {
    if (blocked) {
      if (window === window.top) post({ type: "scan", snapshot: snapshot([]) });
      return;
    }
    const stored = await chrome.storage.local.get(["profile", "pausedOrigins", "finderMatches", "sessionMemory"]);
    const origin = location.origin;
    paused = ((stored.pausedOrigins as string[]) || []).includes(origin);
    if (paused) return;
    const profile = hydrateProfile((stored.profile as Profile) || EMPTY_PROFILE);
    let questions = scanDocument(document, frameId, profile);
    if (reason === "full" || last.length === 0) {
      questions = await restoreSaved(questions);
      last = questions;
      post({ type: "scan", snapshot: snapshot(questions, stored.finderMatches as Parameters<typeof snapshot>[1]) });
      persistPage("scan");
      if (window === window.top && isVisibleTab() && questions.length > 0) {
        const plans = planPage(questions, profile).filter((p) => {
          if (!p.value) return false;
          const q = questions.find((x) => x.id === p.questionId);
          if (q?.source === "user" && q.value) return false;
          if (fieldLooksFilled(q?.kind || "text", q?.value || "")) return false;
          return true;
        });
        for (const plan of plans) applyOne(plan.questionId, plan.value);
      }
      return;
    }
    const diff = diffQuestions(last, questions);
    last = questions;
    if (diff.added.length || diff.removed.length || diff.changed.length) {
      post({ type: "delta", questions });
      schedulePersist();
    }
  }

  function applyOne(id: string, value: string) {
    applyOnePaced(id, value, "fast").catch(() => {});
  }

  async function applyOnePaced(id: string, value: string, pace: "fast" | "slow") {
    const el = document.querySelector(`[data-fillglen-id="${CSS.escape(id)}"]`) as HTMLInputElement | null;
    const prev = el ? el.value : "";
    undoStack.push({ id, prev });
    const result = await setFieldPaced(id, value, pace);
    const q = last.find((x) => x.id === id);
    if (q) {
      q.value = result.readBack || value;
      q.status = result.ok ? "filled" : "needs-review";
      q.error = result.error;
      q.source = "profile";
    }
    post({ type: "delta", questions: last });
    schedulePersist();
  }

  function undo(id?: string) {
    const item = id ? [...undoStack].reverse().find((u) => u.id === id) : undoStack.pop();
    if (!item) return;
    setFieldById(item.id, item.prev);
    const q = last.find((x) => x.id === item.id);
    if (q) {
      q.value = item.prev;
      q.status = item.prev ? "filled" : "needs-you";
    }
    post({ type: "delta", questions: last });
    persistPage("typed");
  }

  async function keepCycle(_opts?: { allowHidden?: boolean }) {
    if (window !== window.top || keepBusy) return;
    if (Date.now() < keepCooldownUntil) return;
    keepBusy = true;
    try {
      const stored = await chrome.storage.local.get([
        "keepApplying",
        "profile",
        "pausedOrigins",
        "sessionMemory",
        "warmupUrl",
        "boardLogins",
        "boardVaultSecret",
        "liveJobs",
        "applyQueue",
      ]);
      const originPaused = ((stored.pausedOrigins as string[]) || []).includes(location.origin);
      if (!stored.keepApplying || paused || originPaused || blocked) return;
      if (shouldSkipWarmupFill(location.href, stored.warmupUrl as string | undefined)) return;
      const pageBlob = document.body?.innerText?.slice(0, 4000) || "";
      const pace = fillPaceForPage(pageBlob);
      const applyPage =
        looksLikeApplicationPage(location.href, pageBlob) ||
        looksLikeAuthWall(pageBlob) ||
        looksLikeJobListingCopy(pageBlob) ||
        Boolean(document.querySelector("input[type=password]")) ||
        collectAuthButtons(document).length > 0 ||
        findFileInputs(document).length > 0;
      if (!applyPage && !/accounts\.google\.com/i.test(location.host)) return;
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
      for (let n = 0; n < SCREEN_CLICK_BUDGET; n++) {
        const acted = clickScreenAction(document, screenSkip);
        if (!acted) break;
        screenSkip = trimScreenSkip([...screenSkip, acted.fingerprint]);
        stuckTicks = 0;
        post({ type: "keep-status", status: "fill", url, detail: acted.label });
        if (pace === "slow") await new Promise((r) => setTimeout(r, KEEP_SLOW_GAP_MS));
      }
      const profile = hydrateProfile((stored.profile as Profile) || EMPTY_PROFILE);
      const logins = (Array.isArray(stored.boardLogins) ? stored.boardLogins : []) as BoardLogin[];
      const liveJobs = [...((stored.liveJobs as { url: string; appliedAt?: string }[]) || []), ...((stored.applyQueue as { url: string; appliedAt?: string }[]) || [])];
      const host = loginHost(location.href);
      const returning = hostHasPriorApply(host, logins, liveJobs, location.href);
      const canSignIn = Boolean(priorLogin(logins, host) && profile.contact.email);
      if (looksLikeAppliedBeforePrompt(pageBlob) && clickAppliedBefore(document, returning)) {
        stuckTicks = 0;
        post({ type: "keep-status", status: "fill", url, detail: returning ? "applied before" : "first application" });
        return;
      }
      const email = profile.contact.email;
      if (email && document.querySelector("input[type=password]")) {
        const secret = ensureVaultSecret(stored.boardVaultSecret as string | undefined);
        if (secret !== stored.boardVaultSecret) await chrome.storage.local.set({ boardVaultSecret: secret });
        const made = loginForFill(logins, location.href, email, secret);
        const filled = fillBoardLogin(document, email, made.login.password);
        if (filled.filledPassword || filled.filledEmail) {
          await chrome.storage.local.set({ boardLogins: made.logins, boardVaultSecret: secret });
          post({
            type: "store-board-password",
            email,
            password: made.login.password,
            url: location.href,
          });
          stuckTicks = 0;
          post({ type: "keep-status", status: "fill", url, detail: made.created ? "created board login" : "used board login" });
        }
      }
      const authButtons = collectAuthButtons(document);
      const hasPassword = Boolean(document.querySelector("input[type=password]"));
      const visibleFields = [...document.querySelectorAll("input, textarea, select")].filter((n) => {
        const el = n as HTMLInputElement;
        if (el.type === "hidden" || el.disabled) return false;
        const s = window.getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden";
      }).length;
      const authChoiceScreen = isAuthChoiceScreen(authButtons, visibleFields);
      if (hasPassword || looksLikeAppliedBeforePrompt(pageBlob) || authChoiceScreen) {
        const gate = clickAuthGate(document, returning, canSignIn);
        if (gate) {
          stuckTicks = 0;
          post({ type: "keep-status", status: "fill", url, detail: gate.action });
          return;
        }
      }
      const saved = snapshotForUrl(hydrateSession(stored.sessionMemory), location.href);
      const questions = overlaySavedValues(scanDocument(document, frameId, profile), [
        ...(saved?.questions || []),
        ...last,
      ]);
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
      try {
        const packed = bytesForUpload(profile);
        const copy = new Uint8Array(packed.bytes.byteLength);
        copy.set(packed.bytes);
        const file = new File([copy], packed.name, { type: packed.mime });
        for (const input of findFileInputs(document)) {
          if (input.files && input.files.length) continue;
          if (attachFileToInput(input, file)) {
            stuckTicks = 0;
            post({ type: "keep-status", status: "fill", url, detail: `uploaded ${packed.name}` });
          }
        }
      } catch {
        /* File/DataTransfer unavailable */
      }
      const plans = planPage(questions, profile).filter((plan) => {
        if (!plan.value) return false;
        const q = questions.find((x) => x.id === plan.questionId);
        if (!q) return false;
        if (fieldLooksFilled(q.kind, q.value)) return false;
        return true;
      });
      const batch = plans.slice(0, KEEP_FIELDS_PER_TICK);
      let hadCustom = false;
      for (const plan of batch) {
        await applyOnePaced(plan.questionId, plan.value, pace);
        const q = questions.find((x) => x.id === plan.questionId);
        if (q && (q.kind === "select" || q.kind === "custom-select" || q.kind === "typeahead" || q.kind === "radio" || q.kind === "checkbox")) {
          if (q.kind === "custom-select" || q.kind === "typeahead") hadCustom = true;
          clickMatchingDropdown(plan.questionId, plan.value);
          await new Promise((r) => setTimeout(r, KEEP_DROPDOWN_SETTLE_MS));
        }
        await new Promise((r) => setTimeout(r, pace === "slow" ? KEEP_SLOW_GAP_MS : KEEP_FILL_GAP_MS));
      }
      // Still have empty fields — yield so the page can paint instead of freezing.
      if (plans.length > batch.length) {
        stuckTicks = 0;
        return;
      }
      await new Promise((r) => setTimeout(r, pace === "slow" ? KEEP_SLOW_GAP_MS : hadCustom ? Math.max(40, KEEP_FILL_GAP_MS) : KEEP_FILL_GAP_MS));
      const after = scanDocument(document, frameId, profile);
      const stillEmpty = after.filter((q) => q.required && q.type !== "password" && !fieldLooksFilled(q.kind, q.value));
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
        const existing = priorLogin(logins, host);
        if (existing) {
          await chrome.storage.local.set({ boardLogins: upsertBoardLogin(logins, { ...existing, applied: true }) });
        }
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
      keepCooldownUntil = Date.now() + KEEP_COOLDOWN_MS;
      schedulePersist();
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
      if (keepBusy) return;
      clearTimeout((obs as unknown as { t?: number }).t);
      (obs as unknown as { t?: number }).t = window.setTimeout(() => {
        scan("delta");
        if (!paused && !keepBusy && Date.now() >= keepCooldownUntil) keepCycle().catch(() => {});
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
    if (!isVisibleTab()) {
      persistPage("hide");
      return;
    }
    keepRestored = false;
    whenReady(() => {
      watchPage();
      scan("full").catch(() => {});
      chrome.storage.local.get(["keepApplying"], (r) => {
        if (!r.keepApplying) return;
        startKeepLoop();
        keepCycle().catch(() => {});
      });
    });
  });
  window.addEventListener("pageshow", () => {
    keepRestored = false;
    persistPage("scan");
    chrome.storage.local.get(["keepApplying"], (r) => {
      if (r.keepApplying) {
        watchPage();
        startKeepLoop();
        keepCycle({ allowHidden: true }).catch(() => {});
        return;
      }
      if (!isVisibleTab()) return;
      scan("full").catch(() => {});
    });
  });
  window.addEventListener("pagehide", () => persistPage("hide"));
  window.addEventListener("beforeunload", () => persistPage("hide"));

  document.addEventListener(
    "input",
    (ev) => {
      const t = ev.target as HTMLElement | null;
      const id = t?.getAttribute("data-fillglen-id");
      if (!id) return;
      const value = (t as HTMLInputElement).value;
      const q = last.find((x) => x.id === id);
      if (q) {
        q.value = value;
        q.source = "user";
        q.status = value ? "filled" : "needs-you";
      }
      post({ type: "typed", questionId: id, value });
      schedulePersist();
    },
    true
  );

  function mountFab() {
    if (document.getElementById("fillglen-fab")) return;
    const root = document.createElement("div");
    root.id = "fillglen-fab";
    root.style.cssText =
      "all:initial; position:fixed; bottom:20px; right:20px; z-index:2147483647; display:flex; gap:8px; align-items:center;";
    const db = document.createElement("button");
    db.textContent = "Database";
    db.title = "Open Fillglen database in this extension";
    db.style.cssText =
      "height:44px;padding:0 14px;border-radius:14px;border:none;background:#1b3a2f;color:#f6f1e8;font:700 14px/1 ui-serif, Georgia, serif;cursor:pointer;box-shadow:0 8px 20px rgba(20,34,28,.28);";
    db.addEventListener("click", () => post({ type: "open-panel-database" }));
    const btn = document.createElement("button");
    btn.textContent = "Fg";
    btn.title = "Open Fillglen live question window";
    btn.style.cssText =
      "width:44px;height:44px;border-radius:14px;border:none;background:#1b3a2f;color:#f6f1e8;font:700 14px/1 ui-serif, Georgia, serif;cursor:pointer;box-shadow:0 8px 20px rgba(20,34,28,.28);";
    btn.addEventListener("click", () => post({ type: "open-panel" }));
    root.appendChild(db);
    root.appendChild(btn);
    document.documentElement.appendChild(root);
  }
}
