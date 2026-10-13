import { expect, test } from "vitest";

import { chordActions, parseChord, textActions, xdotoolChord } from "./keys";

const CTRL = "\uE009";
const SHIFT = "\uE008";

test("Ctrl+Shift+Z presses the modifiers first and releases them in reverse order", () => {
  expect(chordActions(parseChord("Ctrl+Shift+Z"))).toEqual([
    { type: "keyDown", value: CTRL },
    { type: "keyDown", value: SHIFT },
    { type: "keyDown", value: "z" },
    { type: "keyUp", value: "z" },
    { type: "keyUp", value: SHIFT },
    { type: "keyUp", value: CTRL },
  ]);
  expect(xdotoolChord(parseChord("Ctrl+Shift+Z"))).toBe("ctrl+shift+z");
});

test("named keys map to their WebDriver code points and X keysyms", () => {
  const cases: readonly (readonly [string, string, string])[] = [
    ["Enter", "\uE007", "Return"],
    ["Escape", "\uE00C", "Escape"],
    ["Tab", "\uE004", "Tab"],
    ["Backspace", "\uE003", "BackSpace"],
    ["Delete", "\uE017", "Delete"],
    ["Space", "\uE00D", "space"],
    ["ArrowUp", "\uE013", "Up"],
    ["ArrowDown", "\uE015", "Down"],
    ["ArrowLeft", "\uE012", "Left"],
    ["ArrowRight", "\uE014", "Right"],
    ["Home", "\uE011", "Home"],
    ["End", "\uE010", "End"],
    ["PageUp", "\uE00E", "Prior"],
    ["PageDown", "\uE00F", "Next"],
    ["F1", "\uE031", "F1"],
    ["F3", "\uE033", "F3"],
    ["F12", "\uE03C", "F12"],
  ];
  for (const [text, code, keysym] of cases) {
    const chord = parseChord(text);
    expect(chordActions(chord)[0], text).toEqual({ type: "keyDown", value: code });
    expect(xdotoolChord(chord), text).toBe(keysym);
  }
});

test("Shift+Tab and Alt and Meta use their own modifier codes", () => {
  expect(chordActions(parseChord("Shift+Tab")).map(({ value }) => value)).toEqual([
    SHIFT,
    "\uE004",
    "\uE004",
    SHIFT,
  ]);
  expect(chordActions(parseChord("Alt+a"))[0]).toEqual({ type: "keyDown", value: "\uE00A" });
  expect(chordActions(parseChord("Meta+a"))[0]).toEqual({ type: "keyDown", value: "\uE03D" });
  expect(xdotoolChord(parseChord("Alt+Meta+a"))).toBe("alt+super+a");
});

test("names and modifiers are case-insensitive and take the usual aliases", () => {
  expect(parseChord("control+shift+z")).toEqual(parseChord("Ctrl+Shift+Z"));
  expect(parseChord("esc")).toEqual(parseChord("Escape"));
  expect(parseChord("Return")).toEqual(parseChord("Enter"));
  expect(parseChord("cmd+up")).toEqual(parseChord("Meta+ArrowUp"));
  expect(parseChord(" ")).toEqual(parseChord("Space"));
});

test("a letter names a key, so upper case is the same key", () => {
  expect(parseChord("A")).toEqual({ modifiers: [], key: { kind: "char", char: "a" } });
});

test("the plus key is written as + or after a modifier as ++", () => {
  expect(parseChord("+")).toEqual({ modifiers: [], key: { kind: "char", char: "+" } });
  expect(parseChord("Ctrl++")).toEqual({ modifiers: ["Ctrl"], key: { kind: "char", char: "+" } });
  expect(xdotoolChord(parseChord("Ctrl++"))).toBe("ctrl+plus");
});

test("punctuation becomes its X keysym name; characters without one are refused", () => {
  expect(xdotoolChord(parseChord(","))).toBe("comma");
  expect(xdotoolChord(parseChord("Ctrl+/"))).toBe("ctrl+slash");
  expect(xdotoolChord(parseChord("7"))).toBe("7");
  expect(() => xdotoolChord(parseChord("é"))).toThrow(/no X keysym for "é"/);
  expect(chordActions(parseChord("é"))[0]).toEqual({ type: "keyDown", value: "é" });
});

test("unknown keys and modifiers, a repeated modifier and a missing key are refused", () => {
  expect(() => parseChord("Hyper+a")).toThrow(/unknown modifier "Hyper"/);
  expect(() => parseChord("Ctrl+Enterr")).toThrow(/unknown key "Enterr"/);
  expect(() => parseChord("Ctrl+Control+a")).toThrow(/repeated modifier/);
  expect(() => parseChord("Ctrl+")).toThrow(/no key in "Ctrl\+"/);
  expect(() => parseChord("")).toThrow(/no key/);
});

test("typed text sends each grapheme down and up, a newline as Enter", () => {
  expect(textActions("a\n👍🏽")).toEqual([
    { type: "keyDown", value: "a" },
    { type: "keyUp", value: "a" },
    { type: "keyDown", value: "\uE007" },
    { type: "keyUp", value: "\uE007" },
    { type: "keyDown", value: "👍🏽" },
    { type: "keyUp", value: "👍🏽" },
  ]);
});
