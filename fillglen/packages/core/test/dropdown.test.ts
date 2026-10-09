import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dropdownHintsFromAttrs,
  isDropdownFieldKind,
  isDropdownQuestionType,
  optionLabelOf,
  pickVisibleOption,
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
    assert.match(pickVisibleOption("South Asian", labels) || "", /South Asian/);
    assert.match(pickVisibleOption("No, I am not a veteran", labels) || "", /not a veteran/);
    assert.equal(optionLabelOf({ text: "  Male  ", ariaLabel: "" }), "Male");
  });
});
