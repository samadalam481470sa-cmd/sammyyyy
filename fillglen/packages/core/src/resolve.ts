import { classifyAiBucket, isSelfId } from "./classify.js";
import { bestSavedMatch } from "./fuzzy.js";
import { splitName, type FillPlan, type Profile, type Question, type QuestionType } from "./types.js";

function yesNo(value: boolean, options?: string[]): string {
  const yes = options?.find((o) => /^(yes|true|y)$/i.test(o.trim())) ?? "Yes";
  const no = options?.find((o) => /^(no|false|n)$/i.test(o.trim())) ?? "No";
  return value ? yes : no;
}

export function valueForType(type: QuestionType, profile: Profile, options?: string[]): string {
  const c = profile.contact;
  const names = splitName(c.legalName);
  const latestJob = profile.work[0];
  const school = profile.education[0];
  switch (type) {
    case "email":
      return c.email;
    case "phone":
      return c.phone;
    case "firstName":
      return names.first;
    case "lastName":
      return names.last;
    case "fullName":
    case "preferredName":
      return type === "preferredName" && c.preferredName ? c.preferredName : c.legalName;
    case "address":
      return [c.addressLine1, c.addressLine2].filter(Boolean).join(", ");
    case "city":
      return c.city;
    case "state":
      return c.state;
    case "zip":
      return c.zip;
    case "country":
      return c.country;
    case "linkedin":
      return c.linkedin;
    case "github":
      return c.github;
    case "portfolio":
    case "website":
      return c.portfolio || c.website;
    case "workAuthorization":
      return yesNo(profile.preferences.workAuthorized, options);
    case "visaSponsorship":
      return yesNo(profile.preferences.needsSponsorship, options);
    case "salary":
      if (profile.preferences.salaryMin && profile.preferences.salaryMax) {
        return `${profile.preferences.salaryMin}-${profile.preferences.salaryMax}`;
      }
      return profile.preferences.salaryMin ? String(profile.preferences.salaryMin) : "";
    case "startDate":
      return profile.preferences.startDate;
    case "relocation":
      return yesNo(profile.preferences.relocation, options);
    case "remote":
      return profile.preferences.remote;
    case "school":
      return school?.school ?? "";
    case "degree":
      return school?.degree ?? "";
    case "major":
      return school?.major ?? "";
    case "gpa":
      return school?.gpa ?? "";
    case "company":
      return latestJob?.company ?? "";
    case "jobTitle":
      return latestJob?.title ?? "";
    case "workStart":
      return latestJob?.startDate ?? "";
    case "workEnd":
      return latestJob?.endDate ?? "";
    case "gender":
      return profile.selfIdentification.gender;
    case "race":
      return profile.selfIdentification.race;
    case "veteran":
      return profile.selfIdentification.veteran;
    case "disability":
      return profile.selfIdentification.disability;
    default:
      return "";
  }
}

export function planFill(question: Question, profile: Profile): FillPlan {
  const saved = bestSavedMatch(question.label, profile.answers);
  if (saved) {
    return {
      questionId: question.id,
      value: saved.answer,
      source: "saved",
      status: "filled",
      confidence: saved.score >= 0.8 ? "high" : "check-this",
      type: question.type,
    };
  }

  if (isSelfId(question.type)) {
    const value = valueForType(question.type, profile, question.options);
    return {
      questionId: question.id,
      value,
      source: "profile",
      status: value ? "filled" : "needs-you",
      confidence: "high",
      type: question.type,
    };
  }

  const bucket = classifyAiBucket(question.type);
  if (bucket === "draft") {
    return {
      questionId: question.id,
      value: "",
      source: "none",
      status: "needs-you",
      confidence: "check-this",
      type: question.type,
    };
  }

  const value = valueForType(question.type, profile, question.options);
  if (value) {
    return {
      questionId: question.id,
      value,
      source: "profile",
      status: "filled",
      confidence: question.type === "unknown" ? "check-this" : "high",
      type: question.type,
    };
  }

  return {
    questionId: question.id,
    value: "",
    source: "none",
    status: "needs-you",
    confidence: "check-this",
    type: question.type,
  };
}

export function planPage(questions: Question[], profile: Profile): FillPlan[] {
  return questions.map((q) => planFill(q, profile));
}
