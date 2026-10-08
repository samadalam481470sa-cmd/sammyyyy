export type AnswerSource = "profile" | "saved" | "ai-draft" | "user" | "none";

export type QuestionStatus =
  | "filled"
  | "needs-review"
  | "needs-you"
  | "ai-draft-ready"
  | "skipped"
  | "scanning";

export type Confidence = "high" | "check-this";

export type FieldKind =
  | "text"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "custom-select"
  | "typeahead"
  | "date"
  | "file"
  | "repeating";

export type QuestionType =
  | "email"
  | "phone"
  | "firstName"
  | "lastName"
  | "fullName"
  | "preferredName"
  | "address"
  | "city"
  | "state"
  | "zip"
  | "country"
  | "linkedin"
  | "github"
  | "portfolio"
  | "website"
  | "resume"
  | "coverLetter"
  | "workAuthorization"
  | "visaSponsorship"
  | "salary"
  | "startDate"
  | "noticePeriod"
  | "relocation"
  | "remote"
  | "location"
  | "school"
  | "degree"
  | "major"
  | "gpa"
  | "company"
  | "jobTitle"
  | "workStart"
  | "workEnd"
  | "workBullets"
  | "gender"
  | "race"
  | "veteran"
  | "disability"
  | "motivation"
  | "behavioral"
  | "factual"
  | "unknown";

export interface Question {
  id: string;
  label: string;
  required: boolean;
  kind: FieldKind;
  type: QuestionType;
  value: string;
  source: AnswerSource;
  status: QuestionStatus;
  confidence: Confidence;
  frameId?: string;
  name?: string;
  placeholder?: string;
  options?: string[];
  wordLimit?: number;
  charLimit?: number;
  position: number;
  error?: string;
}

export interface JobMeta {
  company: string;
  title: string;
  board: string;
  url: string;
  description: string;
  stepLabel?: string;
  stepIndex?: number;
  stepTotal?: number;
}

export interface ScanSnapshot {
  tabId?: number;
  job: JobMeta;
  questions: Question[];
  blockedReason?: "linkedin-easy-apply" | "paused" | "no-form";
}

export interface Contact {
  legalName: string;
  preferredName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  linkedin: string;
  github: string;
  portfolio: string;
  website: string;
}

export interface WorkJob {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  location: string;
  bullets: { text: string; tags: string[] }[];
}

export interface School {
  id: string;
  school: string;
  degree: string;
  major: string;
  gpa: string;
  startDate: string;
  endDate: string;
}

export interface Skill {
  name: string;
  category: string;
  years: number;
  level: "beginner" | "intermediate" | "advanced" | "expert";
}

export interface DocumentFile {
  id: string;
  kind: "master-resume" | "tailored-resume" | "cover-letter";
  name: string;
  applicationId?: string;
  text: string;
}

export interface SavedAnswer {
  id: string;
  pattern: string;
  answer: string;
  tags: string[];
  useCount: number;
  lastUsedAt: string | null;
}

export interface Preferences {
  salaryMin: number | null;
  salaryMax: number | null;
  locations: string[];
  remote: "onsite" | "hybrid" | "remote" | "any";
  relocation: boolean;
  startDate: string;
  workAuthorized: boolean;
  needsSponsorship: boolean;
}

/** Defaults to Decline. Encrypt at rest. Never send to the AI model. */
export interface SelfIdentification {
  gender: string;
  race: string;
  veteran: string;
  disability: string;
}

export interface Profile {
  contact: Contact;
  work: WorkJob[];
  education: School[];
  skills: Skill[];
  documents: DocumentFile[];
  answers: SavedAnswer[];
  preferences: Preferences;
  selfIdentification: SelfIdentification;
  rawResumeText: string;
}

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "phone-screen"
  | "technical"
  | "final"
  | "offer"
  | "rejected"
  | "withdrawn"
  | "no-response";

export interface TrackedJob {
  id: string;
  company: string;
  title: string;
  url: string;
  board: string;
  description: string;
  createdAt: string;
}

export interface Application {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  resumeVersionId?: string;
  answersSent: { question: string; answer: string }[];
  notes: string;
  recruiter: string;
  interviewDates: string[];
  followUpOn: string | null;
  createdAt: string;
  appliedAt: string | null;
}

export interface StatusEvent {
  id: string;
  applicationId: string;
  status: ApplicationStatus;
  at: string;
}

export interface MatchBreakdown {
  score: number;
  matched: string[];
  missing: string[];
  haveButNotOnResume: string[];
  explanation: string;
}

export interface BoardAdapter {
  id: string;
  detect(url: string, doc?: { title?: string; bodyText?: string }): boolean;
  readJobMeta(input: { url: string; title?: string; bodyText?: string; heading?: string }): JobMeta;
  waitAfterResumeMs: number;
}

export interface FillPlan {
  questionId: string;
  value: string;
  source: AnswerSource;
  status: QuestionStatus;
  confidence: Confidence;
  type: QuestionType;
}

export const EMPTY_PROFILE: Profile = {
  contact: {
    legalName: "",
    preferredName: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
    linkedin: "",
    github: "",
    portfolio: "",
    website: "",
  },
  work: [],
  education: [],
  skills: [],
  documents: [],
  answers: [],
  preferences: {
    salaryMin: null,
    salaryMax: null,
    locations: [],
    remote: "any",
    relocation: false,
    startDate: "",
    workAuthorized: true,
    needsSponsorship: false,
  },
  selfIdentification: {
    gender: "Decline to self-identify",
    race: "Decline to self-identify",
    veteran: "Decline to self-identify",
    disability: "Decline to self-identify",
  },
  rawResumeText: "",
};

export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}
