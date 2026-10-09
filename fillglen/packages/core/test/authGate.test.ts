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
  shouldSkipWarmupFill,
  upsertBoardLogin,
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
});
