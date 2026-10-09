import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyAppliedBeforeChoice,
  classifyAuthGate,
  decideKeepAuth,
  deriveBoardPassword,
  hostHasPriorApply,
  loginForFill,
  loginHost,
  looksLikeAppliedBeforePrompt,
  looksLikeAuthWall,
  pickAuthGate,
  sameBoardCompany,
  shouldSkipWarmupFill,
  upsertBoardLogin,
  workdayTenant,
} from "../src/authGate.js";

describe("auth gate", () => {
  it("prefers Use last application when this board was used before", () => {
    const buttons = [
      { label: "Sign In" },
      { label: "Use My Last Application" },
      { label: "Create Account" },
    ];
    assert.equal(pickAuthGate(buttons, true)?.action, "last-application");
    assert.equal(pickAuthGate(buttons, false)?.action, "create-account");
    assert.equal(classifyAuthGate("Autofill with Last Resume"), "last-application");
    assert.equal(classifyAuthGate("Sign Up"), "create-account");
  });

  it("reads Workday applied-before yes/no", () => {
    assert.equal(looksLikeAppliedBeforePrompt("Have you applied to this company before?"), true);
    assert.equal(classifyAppliedBeforeChoice("Yes, I have applied before"), "yes");
    assert.equal(classifyAppliedBeforeChoice("No, this is my first time"), "no");
  });

  it("keeps a stable site password and remembers the host after signup", () => {
    const host = loginHost("https://austintexas.wd5.myworkdayjobs.com/COA_Careers");
    assert.equal(host, "austintexas.wd5.myworkdayjobs.com");
    const a = deriveBoardPassword("sam@example.com", host, "secret1");
    const b = deriveBoardPassword("sam@example.com", host, "secret1");
    assert.equal(a, b);
    assert.match(a, /Fg!/);
    assert.ok(a.length >= 12);
    const made = loginForFill([], "https://austintexas.wd5.myworkdayjobs.com/x", "sam@example.com", "secret1");
    assert.equal(made.created, true);
    assert.equal(hostHasPriorApply(host, made.logins, []), false);
    const again = loginForFill(made.logins, "https://austintexas.wd5.myworkdayjobs.com/y", "sam@example.com", "secret1");
    assert.equal(again.created, false);
    assert.equal(again.login.password, made.login.password);
    const applied = upsertBoardLogin(again.logins, { ...again.login, applied: true });
    assert.equal(hostHasPriorApply(host, applied, []), true);
  });

  it("does not sign in with a made-up password when this board is new to us", () => {
    const buttons = [{ label: "Sign In" }, { label: "Create Account" }];
    assert.equal(pickAuthGate(buttons, true, false), null);
    assert.equal(pickAuthGate(buttons, true, true)?.action, "sign-in");
    assert.equal(pickAuthGate(buttons, false, true)?.action, "create-account");
  });

  it("treats Workday auth walls as apply work and skips the warmup tab", () => {
    assert.equal(looksLikeAuthWall("Create Account or Sign In to apply"), true);
    assert.equal(shouldSkipWarmupFill("https://jobs.example/next", "https://jobs.example/next"), true);
    assert.equal(shouldSkipWarmupFill("https://jobs.example/current", "https://jobs.example/next"), false);
    const plan = decideKeepAuth({
      buttons: [{ label: "Use My Last Application" }, { label: "Create Account" }],
      returning: true,
      canSignIn: false,
      appliedBeforePrompt: true,
    });
    assert.equal(plan.appliedBefore, "yes");
    assert.equal(plan.gate?.action, "last-application");
  });

  it("uses last application only after a real submit at that same Workday company", () => {
    const austinUrl = "https://austintexas.wd5.myworkdayjobs.com/COA_Careers";
    const dallasUrl = "https://dallascityhall.wd1.myworkdayjobs.com/External";
    const buttons = [
      { label: "Use My Last Application" },
      { label: "Create Account" },
      { label: "Sign In" },
    ];
    assert.equal(workdayTenant(austinUrl), "austintexas");
    assert.equal(workdayTenant(dallasUrl), "dallascityhall");
    assert.equal(sameBoardCompany(austinUrl, dallasUrl), false);
    assert.equal(pickAuthGate(buttons, false)?.action, "create-account");

    const signup = loginForFill([], austinUrl, "sam@example.com", "secret1");
    assert.equal(signup.created, true);
    assert.equal(hostHasPriorApply(signup.login.host, signup.logins, [], austinUrl), false);
    assert.equal(
      pickAuthGate(buttons, hostHasPriorApply(signup.login.host, signup.logins, [], austinUrl))?.action,
      "create-account"
    );

    const applied = upsertBoardLogin(signup.logins, { ...signup.login, applied: true });
    assert.equal(hostHasPriorApply(loginHost(austinUrl), applied, [], austinUrl), true);
    assert.equal(pickAuthGate(buttons, true)?.action, "last-application");
    assert.equal(hostHasPriorApply(loginHost(dallasUrl), applied, [], dallasUrl), false);
    assert.equal(
      pickAuthGate(buttons, hostHasPriorApply(loginHost(dallasUrl), applied, [], dallasUrl))?.action,
      "create-account"
    );
    assert.equal(
      hostHasPriorApply(loginHost(dallasUrl), [], [{ url: austinUrl, appliedAt: "2026-01-01T00:00:00.000Z" }], dallasUrl),
      false
    );
    assert.equal(
      hostHasPriorApply(loginHost(austinUrl), [], [{ url: austinUrl, appliedAt: "2026-01-01T00:00:00.000Z" }], austinUrl),
      true
    );
  });

  it("honors Workday automation ids so a new company still hits Sign Up", () => {
    const buttons = [
      { label: "wd-UseLastApplication", action: "last-application" as const },
      { label: "wd-CreateAccount", action: "create-account" as const },
    ];
    assert.equal(pickAuthGate(buttons, false)?.action, "create-account");
    assert.equal(pickAuthGate(buttons, true)?.action, "last-application");
  });

  it("keeps Greenhouse boards on different company slugs separate", () => {
    const acme = "https://boards.greenhouse.io/acme/jobs/1";
    const other = "https://boards.greenhouse.io/other/jobs/2";
    assert.equal(loginHost(acme), "boards.greenhouse.io/acme");
    assert.equal(loginHost(other), "boards.greenhouse.io/other");
    const applied = upsertBoardLogin([], {
      host: loginHost(acme),
      email: "sam@example.com",
      password: "Fg!x",
      applied: true,
    });
    assert.equal(hostHasPriorApply(loginHost(acme), applied, [], acme), true);
    assert.equal(hostHasPriorApply(loginHost(other), applied, [], other), false);
  });
});
