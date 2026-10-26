import { expect, test } from "vitest";

import { boxKeydown, isTypingTarget } from "./rangeKeys";

const LINUX = "Linux x86_64";
const MAC = "MacIntel";

type Held = Partial<Record<"ctrl" | "meta" | "alt" | "shift" | "composing", true>>;

function element(fields: Readonly<Record<string, string>>): EventTarget {
  return Object.assign(new EventTarget(), fields);
}

function boxPress(key: string, platform: string, held: Held = {}): string {
  const seen: string[] = [];
  boxKeydown(
    {
      key,
      code: "",
      ctrlKey: held.ctrl === true,
      metaKey: held.meta === true,
      altKey: held.alt === true,
      shiftKey: held.shift === true,
      isComposing: held.composing === true,
      preventDefault: () => {
        seen.push("prevented");
      },
      stopPropagation: () => {
        seen.push("stopped");
      },
    },
    platform,
    {
      submit: () => {
        seen.push("submit");
      },
      cancel: () => {
        seen.push("cancel");
      },
    },
  );
  return seen.join(" ");
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

test("Ctrl+Enter submits on Linux, Cmd+Enter on macOS, each kept from the column and the window", () => {
  expect(boxPress("Enter", LINUX, { ctrl: true })).toBe("prevented stopped submit");
  expect(boxPress("Enter", MAC, { meta: true })).toBe("prevented stopped submit");
  expect(boxPress("Enter", LINUX, { meta: true })).toBe("");
  expect(boxPress("Enter", MAC, { ctrl: true })).toBe("");
  expect(boxPress("Enter", LINUX, { ctrl: true, meta: true })).toBe("");
  expect(boxPress("Enter", MAC, { ctrl: true, meta: true })).toBe("");
});

test("a plain Enter, Shift or Alt with Ctrl+Enter, and other keys with Ctrl type as usual", () => {
  expect(boxPress("Enter", LINUX)).toBe("");
  expect(boxPress("Enter", LINUX, { ctrl: true, shift: true })).toBe("");
  expect(boxPress("Enter", LINUX, { ctrl: true, alt: true })).toBe("");
  expect(boxPress("a", LINUX, { ctrl: true })).toBe("");
  expect(boxPress("ArrowDown", LINUX)).toBe("");
});

test("Escape alone cancels on every platform, kept from the column and the window; with a modifier it does nothing", () => {
  expect(boxPress("Escape", LINUX)).toBe("prevented stopped cancel");
  expect(boxPress("Escape", MAC)).toBe("prevented stopped cancel");
  expect(boxPress("Escape", LINUX, { ctrl: true })).toBe("");
  expect(boxPress("Escape", MAC, { meta: true })).toBe("");
  expect(boxPress("Escape", LINUX, { shift: true })).toBe("");
  expect(boxPress("Escape", LINUX, { alt: true })).toBe("");
});

test("keys pressed while an input method composes neither submit nor cancel", () => {
  expect(boxPress("Enter", LINUX, { ctrl: true, composing: true })).toBe("");
  expect(boxPress("Escape", LINUX, { composing: true })).toBe("");
});
