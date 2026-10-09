import { matchOption } from "./applyLoop.js";
import { bestEffortAnswer, pickCitizenAnswer, pickCountryAnswer, pickDemographicOption } from "./answers.js";
import { classifyAiBucket, isSelfId } from "./classify.js";
import { filterRealQuestions, rankFillPlans, shouldAutofillPlan } from "./fieldNoise.js";
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
      return c.zip || "75006";
    case "country":
      return options?.length ? pickCountryAnswer("country", options) : c.country || "United States";
    case "linkedin":
      return c.linkedin;
    case "github":
      return c.github;
    case "portfolio":
    case "website":
      return c.portfolio || c.website;
    case "workAuthorization":
      return pickDemographicOption("workAuthorization", yesNo(profile.preferences.workAuthorized !== false, options), options);
    case "visaSponsorship":
      return yesNo(profile.preferences.needsSponsorship === true, options);
    case "citizenship":
      return pickCitizenAnswer(options);
    case "consent":
      return pickDemographicOption("consent", "Yes", options);
    case "password":
      return "";
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
      return pickDemographicOption("gender", profile.selfIdentification.gender || "Male", options);
    case "race":
      return pickDemographicOption("race", profile.selfIdentification.race || "South Asian", options);
    case "veteran":
      return pickDemographicOption("veteran", profile.selfIdentification.veteran || "No, I am not a veteran", options);
    case "disability":
      return pickDemographicOption("disability", profile.selfIdentification.disability || "No", options);
    case "transgender":
      return pickDemographicOption("transgender", profile.selfIdentification.transgender || "No", options);
    case "sexualOrientation":
      return pickDemographicOption(
        "sexualOrientation",
        profile.selfIdentification.sexualOrientation || "I don't wish to answer",
        options
      );
    case "firstGeneration":
      return pickDemographicOption("firstGeneration", profile.selfIdentification.firstGeneration || "Yes", options);
    default:
      return "";
  }
}

export function planFill(question: Question, profile: Profile): FillPlan {
  if (question.type === "password") {
    return {
      questionId: question.id,
      value: "",
      source: "none",
      status: "needs-you",
      confidence: "high",
      type: "password",
    };
  }
  // Known field types: profile/self-id first so a loose Q&A pattern cannot mis-fill Name/Email.
  if (isSelfId(question.type) || (question.type !== "unknown" && question.type !== "factual" && question.type !== "motivation" && question.type !== "behavioral")) {
    const typed = valueForType(question.type, profile, question.options);
    if (typed) {
      const value =
        question.options?.length && question.type !== "zip" && question.type !== "phone" && question.type !== "email"
          ? matchOption(typed, question.options) || typed
          : typed;
      return {
        questionId: question.id,
        value,
        source: "profile",
        status: "filled",
        confidence: "high",
        type: question.type,
      };
    }
  }

  const saved = bestSavedMatch(question.label, profile.answers, question.type === "unknown" ? 0.62 : 0.55);
  if (saved) {
    const mapped = question.options?.length ? matchOption(saved.answer, question.options) : saved.answer;
    if (mapped || !question.options?.length) {
      return {
        questionId: question.id,
        value: mapped || saved.answer,
        source: "saved",
        status: "filled",
        confidence: saved.score >= 0.8 ? "high" : "check-this",
        type: question.type,
      };
    }
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
    const drafted = bestEffortAnswer(question, profile);
    return {
      questionId: question.id,
      value: drafted,
      source: drafted ? "profile" : "none",
      status: drafted ? "filled" : "needs-you",
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

  const effort = bestEffortAnswer(question, profile);
  return {
    questionId: question.id,
    value: effort,
    source: effort ? "profile" : "none",
    status: effort ? "filled" : "needs-you",
    confidence: "check-this",
    type: question.type,
  };
}

export function planPage(questions: Question[], profile: Profile): FillPlan[] {
  const real = filterRealQuestions(questions);
  const plans = real.map((q) => planFill(q, profile)).filter((p) => {
    const q = real.find((x) => x.id === p.questionId);
    return shouldAutofillPlan(p, q);
  });
  return rankFillPlans(plans, real);
}
