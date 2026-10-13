import { expect, test } from "vitest";

import { parseKey, type Key } from "../../ipc";
import { cmKey, cmKeys } from "./keys";

const LINUX = "Linux x86_64";
const MAC = "MacIntel";

function key(text: string): Key {
  const parsed = parseKey(text);
  if (parsed === null) {
    throw new Error(`${text} does not parse`);
  }
  return parsed;
}

test("Shift with a letter alone is the upper-case letter, as CodeMirror matches it", () => {
  expect(cmKey(key("Shift-x"), LINUX)).toBe("X");
  expect(cmKey(key("Shift-я"), LINUX)).toBe("Я");
});

test("Shift with Mod, Alt or a named key keeps the Shift- prefix", () => {
  expect(cmKey(key("Mod-Shift-z"), LINUX)).toBe("Mod-Shift-z");
  expect(cmKey(key("Alt-Shift-x"), LINUX)).toBe("Alt-Shift-x");
  expect(cmKey(key("Shift-F3"), LINUX)).toBe("Shift-F3");
  expect(cmKey(key("Shift-Space"), LINUX)).toBe("Shift-Space");
});

test("named keys and plain characters pass through", () => {
  expect(cmKey(key("Space"), LINUX)).toBe("Space");
  expect(cmKey(key("Mod-Alt-ArrowUp"), LINUX)).toBe("Mod-Alt-ArrowUp");
  expect(cmKey(key("Mod--"), LINUX)).toBe("Mod--");
  expect(cmKey(key("x"), LINUX)).toBe("x");
});

test("a macOS Ctrl key is not bound on Linux and is Ctrl- on macOS", () => {
  expect(cmKey(key("MacCtrl-x"), LINUX)).toBeNull();
  expect(cmKey(key("MacCtrl-x"), MAC)).toBe("Ctrl-x");
  expect(cmKey(key("Mod-MacCtrl-Shift-x"), MAC)).toBe("Mod-Ctrl-Shift-x");
  expect(cmKeys([key("MacCtrl-x"), key("Enter")], LINUX)).toEqual(["Enter"]);
});
