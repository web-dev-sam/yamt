import { expect, test } from "vitest";

import { parseKey, type Key } from "../ipc";
import { fieldKey } from "./keyField";

const LINUX = "Linux x86_64";

function key(text: string): Key {
  const parsed = parseKey(text);
  if (parsed === null) {
    throw new Error(`${text} does not parse`);
  }
  return parsed;
}

function pressed(
  name: string,
  held: Partial<Record<"ctrlKey" | "metaKey" | "altKey" | "shiftKey", boolean>> = {},
): Parameters<typeof fieldKey>[0] {
  return {
    key: name,
    code: "",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...held,
  };
}

test("Tab and Shift+Tab leave the field; with Ctrl they are recorded", () => {
  expect(fieldKey(pressed("Tab"), null, LINUX)).toEqual({ kind: "leave" });
  expect(fieldKey(pressed("Tab", { shiftKey: true }), null, LINUX)).toEqual({ kind: "leave" });
  expect(fieldKey(pressed("Tab", { ctrlKey: true }), null, LINUX)).toEqual({
    kind: "record",
    key: key("Mod-Tab"),
  });
});

test("plain Enter confirms the shown key, and is recorded when no key is shown", () => {
  expect(fieldKey(pressed("Enter"), key("Mod-f"), LINUX)).toEqual({
    kind: "confirm",
    key: key("Mod-f"),
  });
  expect(fieldKey(pressed("Enter"), null, LINUX)).toEqual({ kind: "record", key: key("Enter") });
  expect(fieldKey(pressed("Enter", { shiftKey: true }), key("Mod-f"), LINUX)).toEqual({
    kind: "record",
    key: key("Shift-Enter"),
  });
});

test("plain Escape cancels; with Shift it is recorded", () => {
  expect(fieldKey(pressed("Escape"), key("Mod-f"), LINUX)).toEqual({ kind: "cancel" });
  expect(fieldKey(pressed("Escape", { shiftKey: true }), null, LINUX)).toEqual({
    kind: "record",
    key: key("Shift-Escape"),
  });
});

test("a key with its modifiers replaces the shown one; a modifier alone changes nothing", () => {
  expect(fieldKey(pressed("g", { ctrlKey: true }), key("Mod-f"), LINUX)).toEqual({
    kind: "record",
    key: key("Mod-g"),
  });
  expect(fieldKey(pressed("Control", { ctrlKey: true }), key("Mod-f"), LINUX)).toEqual({
    kind: "ignore",
  });
});
