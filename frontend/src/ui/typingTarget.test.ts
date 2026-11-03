import { expect, test } from "vitest";

import { isTypingTarget } from "./typingTarget";

function element(fields: Readonly<Record<string, string>>): EventTarget {
  return Object.assign(new EventTarget(), fields);
}

test("a text area and the text-like inputs are typing targets", () => {
  expect(isTypingTarget(element({ tagName: "TEXTAREA" }))).toBe(true);
  for (const type of ["text", "search", "url", "email", "password", "tel", "number"]) {
    expect(isTypingTarget(element({ tagName: "INPUT", type }))).toBe(true);
  }
});

test("buttons, checkboxes, other elements, the window and nothing are not typing targets", () => {
  expect(isTypingTarget(element({ tagName: "INPUT", type: "checkbox" }))).toBe(false);
  expect(isTypingTarget(element({ tagName: "INPUT", type: "button" }))).toBe(false);
  expect(isTypingTarget(element({ tagName: "INPUT" }))).toBe(false);
  expect(isTypingTarget(element({ tagName: "BUTTON", type: "text" }))).toBe(false);
  expect(isTypingTarget(element({ tagName: "DIV" }))).toBe(false);
  expect(isTypingTarget(element({ type: "text" }))).toBe(false);
  expect(isTypingTarget(new EventTarget())).toBe(false);
  expect(isTypingTarget(null)).toBe(false);
});

test("an input whose type is not a string is not a typing target, even one that reads as text", () => {
  const typed = Object.assign(new EventTarget(), { tagName: "INPUT", type: ["text"] });
  expect(isTypingTarget(typed)).toBe(false);
});
