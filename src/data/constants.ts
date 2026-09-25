export const COMPANY_NAME = "Newport Specialty Partners"
export const PRODUCT_LINE = "Acquisition & Strategic Growth"

export const DASHBOARD_GREETING = "Good afternoon, Mary"
export const DASHBOARD_SUBTITLE = "Here's what's happening across Newport's acquisition pipeline."

export const SEARCH_PLACEHOLDER = "Search projects, companies, contacts..."

export const CURRENT_USER = {
  name: "Mary Sbaschnig",
  role: "Acquisition Team",
  initials: "MS",
}

export const PRIORITY_TABLE_LIMIT = 7

export const PRIORITY_LABELS = {
  A: "Must move this week",
  B: "Important but can wait",
  C: "Monitor only",
} as const

export const AI_SUGGESTED_PROMPTS = [
  "Which deals need attention?",
  "What changed this week?",
  "Show active deals with no next action",
  "Summarize Project Guardian",
] as const

export const ACTIVITY_KIND_LABELS = {
  stage: "Stage change",
  note: "Note",
  document: "Document",
  status: "Status change",
  terms: "Terms update",
} as const
