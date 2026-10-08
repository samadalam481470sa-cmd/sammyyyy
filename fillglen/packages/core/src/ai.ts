import { classifyAiBucket, neverSendToAi } from "./classify.js";
import type { Profile, QuestionType } from "./types.js";

export interface AiDraftRequest {
  question: string;
  type: QuestionType;
  wordLimit?: number;
  charLimit?: number;
  jobTitle: string;
  company: string;
  jobDescription: string;
  similarAnswers: string[];
}

export interface AiDraft {
  text: string;
  usedFacts: string[];
  refused: boolean;
  reason?: string;
}

export function buildAiPrompt(req: AiDraftRequest, profile: Profile): { system: string; user: string } | { refused: true; reason: string } {
  if (neverSendToAi(req.type) || classifyAiBucket(req.type) === "never") {
    return { refused: true, reason: "Self-identification and authorization questions never go to the model." };
  }
  const limit = req.wordLimit
    ? `Stay under ${req.wordLimit} words.`
    : req.charLimit
      ? `Stay under ${req.charLimit} characters.`
      : "Stay under 150 words.";
  const system = `You draft job-application answers.
Use ONLY facts from the profile and resume.
Never invent jobs, skills, numbers, degrees, or employers.
If the facts do not answer the question, reply with exactly NEEDS_HUMAN.
${limit}
After the answer, list the resume facts you used as a bullet list prefixed with FACTS:`;
  const user = JSON.stringify({
    question: req.question,
    company: req.company,
    jobTitle: req.jobTitle,
    jobDescription: req.jobDescription.slice(0, 4000),
    profile: {
      contact: { name: profile.contact.legalName, location: `${profile.contact.city}, ${profile.contact.state}` },
      work: profile.work.map((w) => ({ company: w.company, title: w.title, bullets: w.bullets.map((b) => b.text) })),
      education: profile.education,
      skills: profile.skills.map((s) => s.name),
      resume: profile.rawResumeText.slice(0, 6000),
    },
    similarAnswers: req.similarAnswers.slice(0, 3),
  });
  return { system, user };
}

export function parseAiDraft(raw: string): AiDraft {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("NEEDS_HUMAN")) {
    return { text: "", usedFacts: [], refused: true, reason: "Model had no facts for this question." };
  }
  const factsIdx = trimmed.lastIndexOf("FACTS:");
  if (factsIdx >= 0) {
    const text = trimmed.slice(0, factsIdx).trim();
    const usedFacts = trimmed
      .slice(factsIdx + 6)
      .split(/\n/)
      .map((l) => l.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
    return { text, usedFacts, refused: false };
  }
  return { text: trimmed, usedFacts: [], refused: false };
}
