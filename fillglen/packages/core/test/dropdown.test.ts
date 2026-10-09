import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DROPDOWN_SELECT_LAYERS,
  classifyFillControl,
  dropdownHintsFromAttrs,
  isDropdownFieldKind,
  isDropdownQuestionType,
  optionLabelOf,
  pickVisibleOption,
  planDropdownSelect,
  resolveOpenOptionLabels,
} from "../src/dropdown.js";

describe("dropdown open-and-select helpers", () => {
  it("treats EEO and country/state as dropdown question types", () => {
    assert.equal(isDropdownQuestionType("gender"), true);
    assert.equal(isDropdownQuestionType("race"), true);
    assert.equal(isDropdownQuestionType("transgender"), true);
    assert.equal(isDropdownQuestionType("sexualOrientation"), true);
    assert.equal(isDropdownQuestionType("firstGeneration"), true);
    assert.equal(isDropdownQuestionType("country"), true);
    assert.equal(isDropdownQuestionType("email"), false);
    assert.equal(isDropdownFieldKind("custom-select"), true);
    assert.equal(isDropdownFieldKind("text"), false);
  });

  it("detects Workday / React-Select style controls from attributes", () => {
    assert.equal(dropdownHintsFromAttrs({ role: "combobox" }), true);
    assert.equal(dropdownHintsFromAttrs({ ariaHaspopup: "listbox" }), true);
    assert.equal(dropdownHintsFromAttrs({ automationId: "gender--select--dropdown" }), true);
    assert.equal(dropdownHintsFromAttrs({ className: "select__control css-1" }), true);
    assert.equal(dropdownHintsFromAttrs({ tag: "select" }), true);
    assert.equal(dropdownHintsFromAttrs({ tag: "input", role: "textbox" }), false);
  });

  it("picks the visible option by reading the menu labels, not by typing", () => {
    const labels = [
      "Male",
      "Female",
      "I don't wish to answer",
      "South Asian (inclusive of Afghani, Bangladeshi, Bhutanese, Indian, Nepal)",
      "No, I am not a veteran",
    ];
    assert.equal(pickVisibleOption("Male", labels), "Male");
    assert.equal(pickVisibleOption("Male", labels), "Male");
    assert.notEqual(pickVisibleOption("Male", labels), "Female");
    assert.match(pickVisibleOption("South Asian", labels) || "", /South Asian/);
    assert.match(pickVisibleOption("No, I am not a veteran", labels) || "", /not a veteran/);
    assert.equal(optionLabelOf({ text: "  Male  ", ariaLabel: "" }), "Male");
  });

  it("distinguishes type-in fields from dropdowns and radio choices", () => {
    assert.equal(classifyFillControl("text", "email"), "type");
    assert.equal(classifyFillControl("select", "gender"), "dropdown");
    assert.equal(classifyFillControl("custom-select", "country"), "dropdown");
    assert.equal(classifyFillControl("text", "firstName", { role: "combobox" }), "dropdown");
    assert.equal(classifyFillControl("radio", "veteran"), "choice");
    assert.equal(classifyFillControl("checkbox", "disability"), "choice");
  });

  it("plans open-menu then click-choice on this control's options only", () => {
    const plan = planDropdownSelect({
      kind: "select",
      type: "gender",
      desired: "Male",
      controlledOptions: ["Male", "Female", "I don't wish to answer"],
      options: ["Yes", "No", "Male"],
    });
    assert.equal(plan.mode, "dropdown");
    assert.deepEqual(plan.layers, DROPDOWN_SELECT_LAYERS);
    assert.equal(plan.pick, "Male");
    assert.equal(plan.readyToClick, true);
    const typed = planDropdownSelect({ kind: "text", type: "email", desired: "a@b.com" });
    assert.equal(typed.mode, "type");
    assert.equal(typed.layers.length, 0);
    assert.deepEqual(resolveOpenOptionLabels(["Male"], ["Yes", "No"]), ["Male"]);
  });
});
