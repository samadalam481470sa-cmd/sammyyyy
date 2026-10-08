import type { FillPlan, Profile, Question, ScanSnapshot } from "@fillglen/core";

export type ToBackground =
  | { type: "hello"; frameId: string }
  | { type: "scan"; snapshot: ScanSnapshot }
  | { type: "delta"; questions: Question[] }
  | { type: "typed"; questionId: string; value: string }
  | { type: "open-panel" }
  | { type: "create-application"; snapshot: ScanSnapshot };

export type ToContent =
  | { type: "fill-one"; questionId: string; value: string }
  | { type: "fill-plans"; plans: FillPlan[] }
  | { type: "focus"; questionId: string }
  | { type: "undo"; questionId?: string }
  | { type: "pause" };

export type ToPanel =
  | { type: "state"; snapshot: ScanSnapshot | null; profile: Profile | null; paused: boolean; tabId: number | null }
  | { type: "draft"; questionId: string; text: string; usedFacts: string[]; refused: boolean; reason?: string };

export type FromPanel =
  | { type: "subscribe"; tabId?: number }
  | { type: "fill-one"; questionId: string; value: string }
  | { type: "fill-page" }
  | { type: "focus"; questionId: string }
  | { type: "save-answer"; pattern: string; answer: string }
  | { type: "undo"; questionId?: string }
  | { type: "pause"; origin?: string }
  | { type: "draft-ai"; questionId: string }
  | { type: "insert-draft"; questionId: string; text: string }
  | { type: "popout" }
  | { type: "edit-value"; questionId: string; value: string };
