import type { DbQuery, FillPlan, Profile, Question, ScanSnapshot } from "@fillglen/core";

export type KeepStatus =
  | "fill"
  | "advanced"
  | "submitted"
  | "captcha"
  | "blocked"
  | "stuck"
  | "done-job"
  | "idle";

export type PageKeepPayload = {
  url: string;
  stuckTicks: number;
  googleClicked: boolean;
  waitingOnCaptcha: boolean;
  undoStack: { id: string; prev: string }[];
};

export type ToBackground =
  | { type: "hello"; frameId: string }
  | { type: "scan"; snapshot: ScanSnapshot }
  | { type: "delta"; questions: Question[] }
  | { type: "typed"; questionId: string; value: string }
  | { type: "open-panel" }
  | { type: "open-panel-database" }
  | { type: "create-application"; snapshot: ScanSnapshot }
  | { type: "keep-status"; status: KeepStatus; url?: string; detail?: string }
  | { type: "page-keep"; keep: PageKeepPayload }
  | { type: "persist-now"; snapshot?: ScanSnapshot; questions?: Question[] }
  | { type: "store-board-password"; email: string; password: string; url?: string };

export type ToContent =
  | { type: "fill-one"; questionId: string; value: string }
  | { type: "fill-plans"; plans: FillPlan[] }
  | { type: "focus"; questionId: string }
  | { type: "undo"; questionId?: string }
  | { type: "pause" }
  | { type: "keep-tick" };

export type ToPanel =
  | { type: "state"; snapshot: ScanSnapshot | null; profile: Profile | null; paused: boolean; tabId: number | null; keepApplying?: boolean }
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
  | { type: "edit-value"; questionId: string; value: string }
  | { type: "start-keep-applying" }
  | { type: "stop-keep-applying" };

export type DbMessage =
  | { type: "db-query"; query?: DbQuery | Record<string, unknown> }
  | { type: "db-refresh"; query?: DbQuery | Record<string, unknown> }
  | { type: "db-stats" }
  | { type: "db-get"; id: string }
  | { type: "db-ingest" };
