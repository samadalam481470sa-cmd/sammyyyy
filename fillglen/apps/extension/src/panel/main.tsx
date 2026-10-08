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
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [port, setPort] = useState<chrome.runtime.Port | null>(null);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.connect) return;
    const p = chrome.runtime.connect({ name: "fillglen-panel" });
    setPort(p);
    p.postMessage({ type: "subscribe" } satisfies FromPanel);
    p.onMessage.addListener((msg: ToPanel) => {
      if (msg.type === "state") {
        setSnapshot(msg.snapshot);
        setProfile(msg.profile);
        setPaused(msg.paused);
      }
      if (msg.type === "draft") {
        setDrafts((d) => ({ ...d, [msg.questionId]: msg }));
      }
    });
    return () => p.disconnect();
  }, []);

  const send = (msg: FromPanel) => port?.postMessage(msg);

  return (
    <QuestionWindow
      snapshot={snapshot}
      profile={profile}
      paused={paused}
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
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PanelApp />
  </StrictMode>
);
