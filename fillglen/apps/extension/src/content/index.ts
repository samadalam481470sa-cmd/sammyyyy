import {
  adapterFor,
  diffQuestions,
  EMPTY_PROFILE,
  ensureVaultSecret,
  feedMetaForUrl,
  analysisIsFresh,
  analysisSummary,
  analyzeApplyPage,
  cycleOverBudget,
  keepBusyExpired,
  looksLikeConfirmationCopy,
  looksLikeConfirmationUrl,
  mayHandoffToNextJob,
  submitWaitElapsed,
  buildAutofillBatch,
  fieldLooksFilled,
  fillBudgetForAnalysis,
  fillMatchedIntent,
  filterRealQuestions,
  hostHasPriorApply,
  isAuthChoiceScreen,
  hydrateProfile,
  hydrateSession,
  applyWidgetDocuments,
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
  SCREEN_CLICK_BUDGET,
  shouldAutofillPlan,
  trimScreenSkip,
  type PageAnalysis,
  type SubmitEvidence,
  loginForFill,
  loginHost,
  looksLikeApplicationPage,
  looksLikeAppliedBeforePrompt,
  mayAdvance,
  overlaySavedValues,
  pageKeepForUrl,
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
  clickAdvance,
  clickAppliedBefore,
  clickAuthGate,
  clickGoogleSignIn,
  clickMatchingDropdown,
  clickScreenAction,
  clickVisibleGoogleAccount,
  collectAuthButtons,
  detectCaptcha,
  fieldShouldUseDropdown,
  fillBoardLogin,
  findAdvanceControl,
  findFileInputs,
  flashAndScroll,
  readWorkdayStep,
  scanDocument,
  selectDropdownById,
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
  let lastAnalysis: PageAnalysis | null = null;
  let clickedSubmitAt = 0;
  let leavingJob = false;
  let keepBusySince = 0;

  function connect() {
    port = chrome.runtime.connect({ name: "fillglen-content" });
    port.onMessage.addListener((msg: ToContent) => {
      if (msg.type === "pause") paused = true;
      if (paused) return;
      if (msg.type === "fill-one") applyOne(msg.questionId, msg.value);
      if (msg.type === "fill-plans") {
        for (const plan of msg.plans) {
          const q = last.find((x) => x.id === plan.questionId);
          if (!shouldAutofillPlan(plan, q) || (q && fieldLooksFilled(q.kind, q.value))) continue;
          applyOne(plan.questionId, plan.value);
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
        if (keep.clickedSubmitAt) clickedSubmitAt = keep.clickedSubmitAt;
        if (keep.leavingJob) leavingJob = true;
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
        clickedSubmitAt,
        leavingJob,
      },
    });
    if (reason === "hide" || !port) {
      chrome.runtime.sendMessage({ type: "persist-now", snapshot: snap, questions: last }).catch(() => {});
      chrome.runtime
        .sendMessage({
          type: "page-keep",
          keep: {
            url: pageUrl,
            stuckTicks,
            googleClicked,
            waitingOnCaptcha,
            undoStack: undoStack.slice(-80),
            clickedSubmitAt,
            leavingJob,
          },
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
    let questions = filterRealQuestions(scanDocument(document, frameId, profile));
    if (reason === "full" || last.length === 0) {
      questions = filterRealQuestions(await restoreSaved(questions));
      last = questions;
      post({ type: "scan", snapshot: snapshot(questions, stored.finderMatches as Parameters<typeof snapshot>[1]) });
      persistPage("scan");
      if (window === window.top && isVisibleTab() && questions.length > 0) {
        const { ready } = buildAutofillBatch(questions, profile, 40);
        for (const { plan } of ready) applyOne(plan.questionId, plan.value);
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

  async function applyOnePaced(
    id: string,
    value: string,
    pace: "fast" | "slow"
  ): Promise<{ ok: boolean; readBack: string; error?: string }> {
    const el = document.querySelector(`[data-fillglen-id="${CSS.escape(id)}"]`) as HTMLElement | null;
    const prev =
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        ? el.value
        : tidyText(el?.textContent || "");
    undoStack.push({ id, prev });
    const q = last.find((x) => x.id === id);
    let result: { ok: boolean; readBack: string; error?: string };
    if (q && fieldShouldUseDropdown(q.kind, q.type)) {
      const ok = await selectDropdownById(id, value);
      result = { ok, readBack: ok ? value : "", error: ok ? undefined : "Could not open dropdown and select that option." };
    } else {
      result = await setFieldPaced(id, value, pace);
    }
    if (q) {
      q.value = result.readBack || value;
      q.status = result.ok ? "filled" : "needs-review";
      q.error = result.error;
      q.source = "profile";
    }
    post({ type: "delta", questions: last });
    schedulePersist();
    return result;
  }

  function tidyText(text: string): string {
    return text.replace(/\s+/g, " ").trim().slice(0, 220);
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

  function tryFinishSubmitted(evidence: SubmitEvidence, detail: string) {
    const gate = mayHandoffToNextJob({ reason: "submitted", evidence });
    if (!gate.ok) return false;
    leavingJob = true;
    stuckTicks = 0;
    post({ type: "keep-status", status: "submitted", url, detail, submitEvidence: evidence });
    return true;
  }

  async function keepCycle(_opts?: { allowHidden?: boolean }) {
    if (window !== window.top) return;
    if (leavingJob) return;
    if (keepBusy) {
      if (keepBusyExpired(keepBusySince)) {
        keepBusy = false;
        keepBusySince = 0;
      } else {
        return;
      }
    }
    if (Date.now() < keepCooldownUntil) return;
    keepBusy = true;
    keepBusySince = Date.now();
    const cycleStarted = Date.now();
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
      const authButtonsEarly = collectAuthButtons(document);
      const hasPasswordEarly = Boolean(document.querySelector("input[type=password]"));
      const fileCount = findFileInputs(document).length;
      const visibleEarly = [...document.querySelectorAll("input, textarea, select")].filter((n) => {
        const el = n as HTMLInputElement;
        if (el.type === "hidden" || el.disabled) return false;
        const s = window.getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden";
      }).length;
      const advanceEarly = findAdvanceControl(document, "keep-applying");
      const earlyFacts = {
        url,
        title: document.title,
        bodyText: pageBlob,
        readyState: document.readyState,
        visibleFieldCount: visibleEarly,
        hasPassword: hasPasswordEarly,
        hasFileInput: fileCount > 0 || /attach|enter manually|upload (your )?(resume|cv)/i.test(pageBlob),
        authButtonCount: authButtonsEarly.length,
        captcha: detectCaptcha(document),
        hasNext: advanceEarly?.kind === "next",
        hasSubmit: advanceEarly?.kind === "submit",
        hasApplyCta: /apply now|start application|apply for this job/i.test(pageBlob),
      };
      const early = analyzeApplyPage(earlyFacts);
      if (!analysisIsFresh(lastAnalysis, earlyFacts) || early.action !== lastAnalysis?.action) {
        lastAnalysis = early;
        try {
          chrome.storage.local.set({ lastPageAnalysis: analysisSummary(early) });
        } catch {
          /* storage unavailable */
        }
      }
      if (early.action === "skip" && !/accounts\.google\.com/i.test(location.host)) return;
      if (early.action === "wait" && early.stage === "loading") return;
      if (clickedSubmitAt || early.action === "handoff") {
        const evidence: SubmitEvidence = {
          clickedSubmit: clickedSubmitAt > 0,
          confirmationPage: early.stage === "submitted" || looksLikeConfirmationCopy(pageBlob),
          confirmationUrl: looksLikeConfirmationUrl(url),
        };
        if (early.action === "handoff" && !clickedSubmitAt && !evidence.confirmationUrl) {
          // Job-description "thank you" copy is not a submit.
        } else if (
          evidence.confirmationPage ||
          evidence.confirmationUrl ||
          (clickedSubmitAt > 0 && submitWaitElapsed(clickedSubmitAt) && !earlyFacts.hasSubmit)
        ) {
          if (tryFinishSubmitted(evidence, analysisSummary(early))) return;
        } else if (clickedSubmitAt) {
          post({ type: "keep-status", status: "fill", url, detail: "waiting for submit confirmation" });
          return;
        }
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
      for (let n = 0; n < SCREEN_CLICK_BUDGET; n++) {
        if (cycleOverBudget(cycleStarted)) break;
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
        const uploaded = await applyWidgetDocuments(document, profile);
        if (uploaded.did) {
          stuckTicks = 0;
          post({ type: "keep-status", status: "fill", url, detail: uploaded.detail });
        }
      } catch {
        /* File/DataTransfer unavailable */
      }
      const late = analyzeApplyPage({
        ...earlyFacts,
        requiredEmpty: questions.filter((q) => q.required && !fieldLooksFilled(q.kind, q.value)).length,
        filledCount: questions.filter((q) => fieldLooksFilled(q.kind, q.value)).length,
      });
      lastAnalysis = late;
      if (late.action === "handoff" && (clickedSubmitAt || looksLikeConfirmationUrl(url))) {
        if (
          tryFinishSubmitted(
            {
              clickedSubmit: clickedSubmitAt > 0,
              confirmationPage: true,
              confirmationUrl: looksLikeConfirmationUrl(url),
            },
            analysisSummary(late)
          )
        ) {
          return;
        }
      }
      const fillLimit = late.action === "fill" ? fillBudgetForAnalysis(late) : KEEP_FIELDS_PER_TICK;
      const { realQuestions, ready, remainder } = buildAutofillBatch(questions, profile, fillLimit);
      last = realQuestions;
      let hadCustom = false;
      let verified = 0;
      for (const { plan, question: q } of ready) {
        if (cycleOverBudget(cycleStarted)) {
          stuckTicks = 0;
          return;
        }
        const useDropdown = fieldShouldUseDropdown(q.kind, q.type);
        let readBack = "";
        if (useDropdown) {
          hadCustom = true;
          const ok = await selectDropdownById(plan.questionId, plan.value);
          if (!ok) await clickMatchingDropdown(plan.questionId, plan.value);
          readBack = plan.value;
          q.value = plan.value;
          q.status = "filled";
          q.source = "profile";
          await new Promise((r) => setTimeout(r, KEEP_DROPDOWN_SETTLE_MS));
        } else {
          const result = await applyOnePaced(plan.questionId, plan.value, pace);
          readBack = result?.readBack || q.value || plan.value;
          if (q.kind === "radio" || q.kind === "checkbox") {
            await clickMatchingDropdown(plan.questionId, plan.value);
            await new Promise((r) => setTimeout(r, KEEP_DROPDOWN_SETTLE_MS));
            readBack = plan.value;
          }
        }
        if (fillMatchedIntent(plan.value, readBack, q.kind)) {
          verified += 1;
          q.status = "filled";
        } else {
          q.status = "needs-review";
        }
        await new Promise((r) => setTimeout(r, pace === "slow" ? KEEP_SLOW_GAP_MS : KEEP_FILL_GAP_MS));
      }
      if (ready.length) {
        post({
          type: "keep-status",
          status: "fill",
          url,
          detail: `filled ${verified}/${ready.length} real fields`,
        });
      }
      // Still have empty fields — yield so the page can paint instead of freezing.
      if (remainder > 0) {
        stuckTicks = 0;
        return;
      }
      await new Promise((r) => setTimeout(r, pace === "slow" ? KEEP_SLOW_GAP_MS : hadCustom ? Math.max(40, KEEP_FILL_GAP_MS) : KEEP_FILL_GAP_MS));
      const after = filterRealQuestions(scanDocument(document, frameId, profile));
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
        clickedSubmitAt = Date.now();
        const existing = priorLogin(logins, host);
        if (existing) {
          await chrome.storage.local.set({ boardLogins: upsertBoardLogin(logins, { ...existing, applied: true }) });
        }
        post({ type: "keep-status", status: "fill", url, detail: "clicked submit — waiting for confirmation" });
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
      keepBusySince = 0;
      keepCooldownUntil = Date.now() + KEEP_COOLDOWN_MS;
      schedulePersist();
    }
  }

  function startKeepLoop() {
    if (keepTimer || window !== window.top) return;
    keepTimer = window.setInterval(() => {
      if (keepBusy && keepBusyExpired(keepBusySince)) {
        keepBusy = false;
        keepBusySince = 0;
      }
      keepCycle().catch(() => {
        keepBusy = false;
        keepBusySince = 0;
      });
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
      if (keepBusy || leavingJob) return;
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
    const existing = document.getElementById("fillglen-fab");
    chrome.storage.local.get(["keepApplying"], (r) => {
      if (r.keepApplying) {
        // While the auto bot runs, keep the page clean — no question-window FAB.
        existing?.remove();
        mountBotChip();
        return;
      }
      document.getElementById("fillglen-bot-chip")?.remove();
      if (existing) return;
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
      btn.title = "Open Fillglen";
      btn.style.cssText =
        "width:44px;height:44px;border-radius:14px;border:none;background:#1b3a2f;color:#f6f1e8;font:700 14px/1 ui-serif, Georgia, serif;cursor:pointer;box-shadow:0 8px 20px rgba(20,34,28,.28);";
      btn.addEventListener("click", () => post({ type: "open-panel" }));
      root.appendChild(db);
      root.appendChild(btn);
      document.documentElement.appendChild(root);
    });
  }

  function mountBotChip() {
    if (document.getElementById("fillglen-bot-chip")) return;
    const chip = document.createElement("button");
    chip.id = "fillglen-bot-chip";
    chip.textContent = "Bot ON";
    chip.title = "Fillglen auto bot is running in the background. Click to open the popup controls.";
    chip.style.cssText =
      "all:initial; position:fixed; bottom:16px; right:16px; z-index:2147483647; height:36px; padding:0 12px; border-radius:12px; border:none; background:#c45c2a; color:#fff8f1; font:700 12px/36px ui-sans-serif, system-ui, sans-serif; cursor:pointer; box-shadow:0 6px 16px rgba(20,34,28,.25);";
    chip.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "open-panel" }).catch(() => {});
    });
    document.documentElement.appendChild(chip);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.keepApplying) mountFab();
  });
}
