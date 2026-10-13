import { expect, test } from "vitest";

import { bindingsOf, DEFAULT_KEYS, parseKey, type Key, type KeyBindings } from "../ipc";
import { isDefault, keyOwners, planKeyEdit } from "./keymapEdit";

function key(text: string): Key {
  const parsed = parseKey(text);
  if (parsed === null) {
    throw new Error(`${text} does not parse`);
  }
  return parsed;
}

function bound(keys: Record<string, string[]>): KeyBindings {
  return bindingsOf(keys).bindings;
}

test("adding a key the action already has does nothing", () => {
  expect(planKeyEdit(DEFAULT_KEYS, { kind: "add", action: "apply", key: key("Enter") })).toEqual({
    kind: "nothing",
  });
});

test("adding a free key sends the action's whole list", () => {
  expect(planKeyEdit(DEFAULT_KEYS, { kind: "add", action: "apply", key: key("a") })).toEqual({
    kind: "send",
    changes: [{ action: "apply", keys: ["Enter", "Space", "a"] }],
  });
});

test("adding a key another action holds asks, and Move takes it from the owner in the same changes", () => {
  expect(planKeyEdit(DEFAULT_KEYS, { kind: "add", action: "undo", key: key("Mod-f") })).toEqual({
    kind: "ask",
    clash: { key: key("Mod-f"), action: "undo", owner: "find" },
    changes: [
      { action: "undo", keys: ["Mod-z", "Mod-f"] },
      { action: "find", keys: [] },
    ],
  });
});

test("an owner left with exactly its defaults is sent back to them as null", () => {
  const bindings = bound({ find: ["Mod-f", "Mod-g"] });

  expect(planKeyEdit(bindings, { kind: "add", action: "undo", key: key("Mod-g") })).toEqual({
    kind: "ask",
    clash: { key: key("Mod-g"), action: "undo", owner: "find" },
    changes: [
      { action: "undo", keys: ["Mod-z", "Mod-g"] },
      { action: "find", keys: null },
    ],
  });
});

test("changing a key replaces it in place", () => {
  expect(
    planKeyEdit(DEFAULT_KEYS, {
      kind: "change",
      action: "ignore",
      from: key("Delete"),
      to: key("d"),
    }),
  ).toEqual({ kind: "send", changes: [{ action: "ignore", keys: ["Backspace", "d", "x"] }] });
});

test("changing to a key another action holds asks first", () => {
  expect(
    planKeyEdit(DEFAULT_KEYS, {
      kind: "change",
      action: "find",
      from: key("Mod-f"),
      to: key("Mod-z"),
    }),
  ).toEqual({
    kind: "ask",
    clash: { key: key("Mod-z"), action: "find", owner: "undo" },
    changes: [
      { action: "find", keys: ["Mod-z"] },
      { action: "undo", keys: [] },
    ],
  });
});

test("changing to a key the action already has drops the old one; to itself or from a missing key does nothing", () => {
  expect(
    planKeyEdit(DEFAULT_KEYS, {
      kind: "change",
      action: "apply",
      from: key("Enter"),
      to: key("Space"),
    }),
  ).toEqual({ kind: "send", changes: [{ action: "apply", keys: ["Space"] }] });
  expect(
    planKeyEdit(DEFAULT_KEYS, {
      kind: "change",
      action: "apply",
      from: key("Enter"),
      to: key("Enter"),
    }),
  ).toEqual({ kind: "nothing" });
  expect(
    planKeyEdit(DEFAULT_KEYS, { kind: "change", action: "apply", from: key("q"), to: key("w") }),
  ).toEqual({ kind: "nothing" });
});

test("changing back to the defaults sends null", () => {
  const bindings = bound({ "find-next": ["F4"] });

  expect(
    planKeyEdit(bindings, { kind: "change", action: "find-next", from: key("F4"), to: key("F3") }),
  ).toEqual({ kind: "send", changes: [{ action: "find-next", keys: null }] });
});

test("removing a key sends the rest; removing a key the action lacks does nothing", () => {
  expect(planKeyEdit(DEFAULT_KEYS, { kind: "remove", action: "redo", key: key("Mod-y") })).toEqual({
    kind: "send",
    changes: [{ action: "redo", keys: ["Mod-Shift-z"] }],
  });
  expect(planKeyEdit(DEFAULT_KEYS, { kind: "remove", action: "redo", key: key("Mod-z") })).toEqual({
    kind: "nothing",
  });
});

test("removing the one added key goes back to the defaults as null", () => {
  const bindings = bound({ apply: ["Enter", "Space", "a"] });

  expect(planKeyEdit(bindings, { kind: "remove", action: "apply", key: key("a") })).toEqual({
    kind: "send",
    changes: [{ action: "apply", keys: null }],
  });
});

test("remove all sends an empty list, unless there is nothing left to remove", () => {
  expect(planKeyEdit(DEFAULT_KEYS, { kind: "removeAll", action: "indent" })).toEqual({
    kind: "send",
    changes: [{ action: "indent", keys: [] }],
  });
  expect(planKeyEdit(bound({ indent: [] }), { kind: "removeAll", action: "indent" })).toEqual({
    kind: "nothing",
  });
});

test("reset sends null", () => {
  expect(planKeyEdit(bound({ undo: [] }), { kind: "reset", action: "undo" })).toEqual({
    kind: "send",
    changes: [{ action: "undo", keys: null }],
  });
});

test("a list is the defaults when it holds exactly the default keys, in any order", () => {
  expect(isDefault("redo", [key("Mod-y"), key("Mod-Shift-z")])).toBe(true);
  expect(isDefault("redo", [key("Mod-y")])).toBe(false);
  expect(isDefault("redo", [key("Mod-y"), key("Mod-Shift-z"), key("Mod-r")])).toBe(false);
  expect(isDefault("redo", [key("Mod-y"), key("Mod-r")])).toBe(false);
});

test("a key's owners are every other action holding it, never the action itself", () => {
  const bindings: KeyBindings = { ...DEFAULT_KEYS, undo: [key("Mod-z"), key("Mod-f")] };
  expect(keyOwners(bindings, "redo", key("Mod-f"))).toEqual(["undo", "find"]);
  expect(keyOwners(bindings, "find", key("Mod-f"))).toEqual(["undo"]);
  expect(keyOwners(bindings, "apply", key("Enter"))).toEqual([]);
});
