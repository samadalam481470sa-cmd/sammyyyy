import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Profile, ScanSnapshot } from "@fillglen/core";
import { QuestionWindow, type DraftState } from "./QuestionWindow";
import type { FromPanel, ToPanel } from "../shared/messages";
import "./styles.css";

function PanelApp() {
  const popout = new URLSearchParams(location.search).has("popout");
  const [snapshot, setSnapshot] = useState<ScanSnapshot | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [paused, setPaused] = useState(false);
  const [keepApplying, setKeepApplying] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [port, setPort] = useState<chrome.runtime.Port | null>(null);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.connect) return;
    chrome.storage.local.get(["panelDrafts", "lastSnapshot", "keepApplying", "pausedOrigins"], (r) => {
      if (r.panelDrafts && typeof r.panelDrafts === "object") setDrafts(r.panelDrafts);
      if (r.lastSnapshot && typeof r.lastSnapshot === "object") setSnapshot(r.lastSnapshot as ScanSnapshot);
      if (typeof r.keepApplying === "boolean") setKeepApplying(r.keepApplying);
    });
    const p = chrome.runtime.connect({ name: "fillglen-panel" });
    setPort(p);
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      p.postMessage({ type: "subscribe", tabId: tabs[0]?.id } satisfies FromPanel);
    });
    p.onMessage.addListener((msg: ToPanel) => {
      if (msg.type === "state") {
        setSnapshot(msg.snapshot);
        setProfile(msg.profile);
        setPaused(msg.paused);
        setKeepApplying(Boolean(msg.keepApplying));
        if (msg.snapshot) chrome.storage.local.set({ lastSnapshot: msg.snapshot, lastSnapshotTabId: msg.tabId });
      }
      if (msg.type === "draft") {
        setDrafts((d) => {
          const next = { ...d, [msg.questionId]: msg };
          chrome.storage.local.set({ panelDrafts: next });
          return next;
        });
      }
    });
    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== "local") return;
      if (changes.keepApplying) setKeepApplying(Boolean(changes.keepApplying.newValue));
      if (changes.panelDrafts?.newValue && typeof changes.panelDrafts.newValue === "object") {
        setDrafts(changes.panelDrafts.newValue as Record<string, DraftState>);
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      p.disconnect();
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, []);

  const send = (msg: FromPanel) => port?.postMessage(msg);

  return (
    <QuestionWindow
      snapshot={snapshot}
      profile={profile}
      paused={paused}
      keepApplying={keepApplying}
      popout={popout}
      drafts={drafts}
      onFillPage={() => send({ type: "fill-page" })}
      onFillOne={(questionId, value) => send({ type: "fill-one", questionId, value })}
      onFocus={(questionId) => send({ type: "focus", questionId })}
      onSaveAnswer={(pattern, answer) => send({ type: "save-answer", pattern, answer })}
      onUndo={(questionId) => send({ type: "undo", questionId })}
      onPause={() => send({ type: "pause" })}
      onDraft={(questionId) => send({ type: "draft-ai", questionId })}
      onInsertDraft={(questionId, text) => send({ type: "insert-draft", questionId, text })}
      onPopout={() => send({ type: "popout" })}
      onEdit={(questionId, value) => send({ type: "edit-value", questionId, value })}
      onStartKeep={() => send({ type: "start-keep-applying" })}
      onStopKeep={() => send({ type: "stop-keep-applying" })}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PanelApp />
  </StrictMode>
);
