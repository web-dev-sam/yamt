import { expect, test } from "vitest";

import { DEFAULT_KEYS, KEY_ACTIONS, parseKey, type Key } from "../ipc";
import { keyOwners } from "./keymapEdit";
import {
  ACTION_NAMES,
  ACTION_PLACES,
  KEYMAP_GROUPS,
  keymapMenu,
  setKeyMenu,
  usedByText,
  type KeymapMenuEntry,
} from "./keyText";

const LINUX = "Linux x86_64";
const MAC = "MacIntel";

function key(text: string): Key {
  const parsed = parseKey(text);
  if (parsed === null) {
    throw new Error(`${text} does not parse`);
  }
  return parsed;
}

function labels(entries: readonly KeymapMenuEntry[]): string[] {
  return entries.map((entry) => (entry.kind === "separator" ? "---" : entry.label));
}

test("the keymap groups list every action once, in the settings order", () => {
  expect(KEYMAP_GROUPS.flatMap(({ actions }) => actions)).toEqual(KEY_ACTIONS);
  expect(KEYMAP_GROUPS.map(({ title }) => title)).toEqual([
    "Side panes",
    "Anywhere in the file",
    "Find",
    "Result pane",
    "Window",
  ]);
  expect(KEYMAP_GROUPS.at(-1)).toEqual({
    title: "Window",
    actions: ["toggle-file-list", "toggle-search"],
  });
});

test("each action says where it acts, matching its group", () => {
  expect(ACTION_PLACES.apply).toContain("side pane");
  expect(ACTION_PLACES.undo).toBe("anywhere in the shown file");
  expect(ACTION_PLACES["close-find"]).toContain("find box");
  expect(ACTION_PLACES.indent).toBe("in the Result pane");
  expect(ACTION_PLACES["toggle-file-list"]).toBe("anywhere in the window");
  expect(ACTION_NAMES["toggle-file-list"]).toBe("Toggle file list");
  expect(ACTION_PLACES["toggle-search"]).toBe("anywhere in the merge and range windows");
  expect(ACTION_NAMES["toggle-search"]).toBe("Toggle search");
});

test("giving Ctrl/⌘B to another action clashes with Toggle file list", () => {
  expect(usedByText(keyOwners(DEFAULT_KEYS, "find", key("Mod-b")))).toBe(
    "Already used by: Toggle file list",
  );
});

test("giving Ctrl/⌘⇧S to another action clashes with Toggle search, and Ctrl/⌘S still with Save only", () => {
  expect(usedByText(keyOwners(DEFAULT_KEYS, "find", key("Mod-Shift-s")))).toBe(
    "Already used by: Toggle search",
  );
  expect(keyOwners(DEFAULT_KEYS, "find", key("Mod-s"))).toEqual(["save"]);
});

test("Save is named, acts anywhere in the shown file, and Ctrl/⌘S clashes with it (plan §2 #65)", () => {
  expect(ACTION_NAMES.save).toBe("Save");
  expect(ACTION_PLACES.save).toBe("anywhere in the shown file");
  expect(KEYMAP_GROUPS[1]).toEqual({
    title: "Anywhere in the file",
    actions: ["undo", "redo", "save"],
  });
  expect(usedByText(keyOwners(DEFAULT_KEYS, "find", key("Mod-s")))).toBe("Already used by: Save");
});

test("the edit menu changes and removes each key by its label; default keys offer no reset", () => {
  const menu = keymapMenu("apply", DEFAULT_KEYS.apply, LINUX);

  expect(labels(menu)).toEqual([
    "Add Keyboard Shortcut",
    "---",
    "Change Enter…",
    "Remove Enter",
    "Change Space…",
    "Remove Space",
  ]);
  expect(menu[2]).toEqual({
    kind: "command",
    label: "Change Enter…",
    command: { kind: "change", key: key("Enter") },
  });
  expect(menu[3]).toEqual({
    kind: "command",
    label: "Remove Enter",
    command: { kind: "remove", key: key("Enter") },
  });
  expect(labels(keymapMenu("find", [key("Mod-Shift-f")], MAC)).slice(2, 4)).toEqual([
    "Change ⇧⌘F…",
    "Remove ⇧⌘F",
  ]);
});

test("Remove All shows past two keys, and Reset Shortcuts follows it without a separator", () => {
  expect(labels(keymapMenu("ignore", DEFAULT_KEYS.ignore, LINUX)).slice(-2)).toEqual([
    "---",
    "Remove All",
  ]);
  expect(
    labels(keymapMenu("ignore", [key("Delete"), key("x"), key("y")], LINUX)).slice(-3),
  ).toEqual(["---", "Remove All", "Reset Shortcuts"]);
  expect(labels(keymapMenu("apply", [key("a"), key("Enter")], LINUX)).slice(-3)).toEqual([
    "Remove Enter",
    "---",
    "Reset Shortcuts",
  ]);
});

test("an action left without keys offers Add and Reset with one separator between", () => {
  const menu = keymapMenu("find", [], LINUX);

  expect(labels(menu)).toEqual(["Add Keyboard Shortcut", "---", "Reset Shortcuts"]);
  expect(menu.map((entry) => (entry.kind === "command" ? entry.command.kind : null))).toEqual([
    "add",
    null,
    "reset",
  ]);
});

test("the + menu sets Enter, Escape, Tab and Shift+Tab, labelled for the platform", () => {
  expect(setKeyMenu(LINUX)).toEqual([
    { label: "Set Enter", key: key("Enter") },
    { label: "Set Escape", key: key("Escape") },
    { label: "Set Tab", key: key("Tab") },
    { label: "Set Shift+Tab", key: key("Shift-Tab") },
  ]);
  expect(setKeyMenu(MAC).map(({ label }) => label)).toEqual(["Set ⏎", "Set ⎋", "Set ⇥", "Set ⇧⇥"]);
});

test("the conflict line names every action already using the key", () => {
  expect(usedByText(["find"])).toBe("Already used by: Find");
  expect(usedByText(["undo", "find-next"])).toBe("Already used by: Undo, Find next");
});
