import { expect, test } from "vitest";

import type { KeyName } from ".";
import {
  bindingsOf,
  DEFAULT_KEYS,
  KEY_ACTIONS,
  isLinux,
  isMac,
  keyLabel,
  keyList,
  keyOfEvent,
  keyText,
  parseKey,
  pressesKey,
  sameKey,
  type Key,
} from "./keys";

const LINUX = "Linux x86_64";
const MAC = "MacIntel";

type Press = {
  key: string;
  code?: string;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
};

function key(text: string): Key {
  const parsed = parseKey(text);
  if (parsed === null) {
    throw new Error(`${text} does not parse`);
  }
  return parsed;
}

function texts(keys: readonly Key[]): string[] {
  return keys.map(keyText);
}

function event(press: Press): Parameters<typeof keyOfEvent>[0] {
  return {
    key: press.key,
    code: press.code ?? "",
    ctrlKey: press.ctrl ?? false,
    metaKey: press.meta ?? false,
    altKey: press.alt ?? false,
    shiftKey: press.shift ?? false,
  };
}

function pressed(platform: string, press: Press): string | null {
  const found = keyOfEvent(event(press), platform);
  return found === null ? null : keyText(found);
}

test("Linux and macOS are told apart by navigator.platform's start and CodeMirror's Mac test", () => {
  expect(isLinux("Linux x86_64")).toBe(true);
  expect(isLinux("Linux aarch64")).toBe(true);
  expect(isLinux("MacIntel")).toBe(false);
  expect(isLinux("Win32")).toBe(false);
  expect(isLinux("")).toBe(false);
  expect(isLinux("FreeBSD amd64 Linux")).toBe(false);
  expect(isMac(MAC)).toBe(true);
  expect(isMac(LINUX)).toBe(false);
});

test("the actions are listed in the settings order", () => {
  expect(KEY_ACTIONS).toEqual([
    "apply",
    "ignore",
    "next-change",
    "previous-change",
    "left-side",
    "right-side",
    "undo",
    "redo",
    "save",
    "find",
    "find-next",
    "find-previous",
    "close-find",
    "indent",
    "outdent",
    "toggle-file-list",
    "toggle-search",
  ]);
});

test("the defaults are the keys yamt bound before settings existed", () => {
  const defaults = Object.fromEntries(
    KEY_ACTIONS.map((action) => [action, texts(DEFAULT_KEYS[action])]),
  );

  expect(defaults).toEqual({
    // sideFocus.ts SIDE_KEYS at 9b717cb (plan §2 #54)
    apply: ["Enter", "Space"],
    ignore: ["Backspace", "Delete", "x"],
    "next-change": ["ArrowDown"],
    "previous-change": ["ArrowUp"],
    "left-side": ["ArrowLeft"],
    "right-side": ["ArrowRight"],
    // historyKey.ts historyCommand at 9b717cb: Mod-z, Mod-Shift-z, Mod-y (plan §2 #54)
    undo: ["Mod-z"],
    redo: ["Mod-Shift-z", "Mod-y"],
    // plan §2 #65
    save: ["Mod-s"],
    // find.ts:269-284 at 9b717cb (plan §2 #44)
    find: ["Mod-f"],
    "find-next": ["F3"],
    "find-previous": ["Shift-F3"],
    "close-find": ["Escape"],
    // pane.ts indentWithTab at 9b717cb (plan §2 #35)
    indent: ["Tab"],
    outdent: ["Shift-Tab"],
    // plan §2 #61
    "toggle-file-list": ["Mod-b"],
    // plan §2 row 127
    "toggle-search": ["Mod-Shift-s"],
  });
});

test("the file form reads modifiers in order, a named key or one character, and prints back exactly", () => {
  for (const text of [
    "Mod-MacCtrl-Alt-Shift-z",
    "Mod-Shift-z",
    "MacCtrl-x",
    "Alt-Backspace",
    "Shift-F12",
    "F1",
    "PageDown",
    "Mod--",
    "-",
    "?",
    "я",
    "Space",
  ]) {
    expect(keyText(key(text))).toBe(text);
  }
  expect(parseKey("Mod-MacCtrl-Alt-Shift-z")).toEqual({
    mod: true,
    macCtrl: true,
    alt: true,
    shift: true,
    name: "z",
  });
  const minus: KeyName = key("Mod--").name;
  expect(minus).toBe("-");
});

test("anything else is refused", () => {
  for (const text of [
    "",
    "Z",
    "Я",
    "Shift-Mod-z",
    "Alt-Mod-z",
    "Mod-Mod-z",
    "Ctrl-z",
    "Cmd-z",
    "Mod-",
    "Mod",
    " ",
    "\t",
    "F13",
    "F0",
    "enter",
    "Up",
    "ab",
    "Mod-zz",
    "Shift-1",
    "Shift-?",
  ]) {
    expect(parseKey(text)).toBeNull();
  }
});

test("keyList parses each text in order and refuses one that does not parse", () => {
  expect(texts(keyList("Mod-Enter", "Escape"))).toEqual(["Mod-Enter", "Escape"]);
  expect(keyList()).toEqual([]);
  expect(() => keyList("Escape", "Ctrl-z")).toThrow("key Ctrl-z does not parse");
});

test("sameKey compares every modifier and the name", () => {
  const base = key("Mod-z");

  expect(sameKey(base, key("Mod-z"))).toBe(true);
  for (const other of ["z", "Mod-y", "MacCtrl-z", "Mod-Alt-z", "Mod-Shift-z", "Mod-MacCtrl-z"]) {
    expect(sameKey(base, key(other))).toBe(false);
  }
});

test("pressesKey: no keys are never pressed", () => {
  const presses: Press[] = [{ key: "b", ctrl: true }, { key: "b" }];
  for (const press of presses) {
    expect(pressesKey(event(press), [], LINUX)).toBe(false);
  }
});

test("pressesKey: each of two keys is pressed, a near miss is not", () => {
  const keys = [key("Mod-b"), key("Mod-Shift-l")];

  expect(pressesKey(event({ key: "b", ctrl: true }), keys, LINUX)).toBe(true);
  expect(pressesKey(event({ key: "L", ctrl: true, shift: true }), keys, LINUX)).toBe(true);
  expect(pressesKey(event({ key: "B", ctrl: true, shift: true }), keys, LINUX)).toBe(false);
  expect(pressesKey(event({ key: "l", ctrl: true }), keys, LINUX)).toBe(false);
});

test("pressesKey on macOS: ⌘B presses Mod-b, ⌃B does not", () => {
  const keys = [key("Mod-b")];

  expect(pressesKey(event({ key: "b", meta: true }), keys, MAC)).toBe(true);
  expect(pressesKey(event({ key: "b", ctrl: true }), keys, MAC)).toBe(false);
});

test("Save by default: Ctrl+S on Linux and ⌘S on macOS, not ⌃S on macOS (plan §2 #65)", () => {
  expect(pressesKey(event({ key: "s", ctrl: true }), DEFAULT_KEYS.save, LINUX)).toBe(true);
  expect(pressesKey(event({ key: "s", meta: true }), DEFAULT_KEYS.save, MAC)).toBe(true);
  expect(pressesKey(event({ key: "s", ctrl: true }), DEFAULT_KEYS.save, MAC)).toBe(false);
  expect(pressesKey(event({ key: "s" }), DEFAULT_KEYS.save, LINUX)).toBe(false);
});

test("Linux labels: Ctrl, Alt, Shift and WebStorm's key names", () => {
  expect(keyLabel(key("Mod-Shift-z"), LINUX)).toBe("Ctrl+Shift+Z");
  expect(keyLabel(key("Mod-Alt-Shift-x"), LINUX)).toBe("Ctrl+Alt+Shift+X");
  expect(keyLabel(key("Shift-F3"), LINUX)).toBe("Shift+F3");
  expect(keyLabel(key("Space"), LINUX)).toBe("Space");
  expect(keyLabel(key("ArrowUp"), LINUX)).toBe("↑");
  expect(keyLabel(key("PageDown"), LINUX)).toBe("Page Down");
  expect(keyLabel(key("Escape"), LINUX)).toBe("Escape");
  expect(keyLabel(key("Mod-/"), LINUX)).toBe("Ctrl+/");
});

test("macOS labels: Apple's order ⌃⌥⇧⌘ and its key symbols", () => {
  expect(keyLabel(key("Mod-Shift-z"), MAC)).toBe("⇧⌘Z");
  expect(keyLabel(key("MacCtrl-Alt-x"), MAC)).toBe("⌃⌥X");
  expect(keyLabel(key("Mod-MacCtrl-Alt-Shift-z"), MAC)).toBe("⌃⌥⇧⌘Z");
  expect(keyLabel(key("Enter"), MAC)).toBe("⏎");
  expect(keyLabel(key("Backspace"), MAC)).toBe("⌫");
  expect(keyLabel(key("Escape"), MAC)).toBe("⎋");
  expect(keyLabel(key("Space"), MAC)).toBe("Space");
  expect(keyLabel(key("Shift-F3"), MAC)).toBe("⇧F3");
});

test("a macOS Ctrl key on Linux is shown the macOS way and marked as macOS", () => {
  expect(keyLabel(key("MacCtrl-x"), LINUX)).toBe("⌃X (macOS)");
  expect(keyLabel(key("Mod-MacCtrl-x"), LINUX)).toBe("⌃⌘X (macOS)");
});

test("a modifier pressed alone is no key", () => {
  for (const name of ["Control", "Shift", "Alt", "Meta", "AltGraph", "CapsLock"]) {
    expect(pressed(LINUX, { key: name, ctrl: name === "Control", shift: name === "Shift" })).toBe(
      null,
    );
  }
  expect(pressed(LINUX, { key: "Dead", code: "Quote" })).toBeNull();
});

test("Linux: Ctrl is Mod and Meta is no key; macOS: Cmd is Mod and Ctrl is MacCtrl", () => {
  expect(pressed(LINUX, { key: "z", ctrl: true })).toBe("Mod-z");
  expect(pressed(LINUX, { key: "z", meta: true })).toBeNull();
  expect(pressed(MAC, { key: "z", meta: true })).toBe("Mod-z");
  expect(pressed(MAC, { key: "z", ctrl: true })).toBe("MacCtrl-z");
  expect(pressed(MAC, { key: "z", ctrl: true, meta: true })).toBe("Mod-MacCtrl-z");
  expect(pressed(LINUX, { key: "Backspace", alt: true })).toBe("Alt-Backspace");
});

test("Ctrl+B on Linux and ⌘B on macOS are Mod-b; ⌃B on macOS is MacCtrl-b", () => {
  expect(pressed(LINUX, { key: "b", code: "KeyB", ctrl: true })).toBe("Mod-b");
  expect(pressed(MAC, { key: "b", code: "KeyB", meta: true })).toBe("Mod-b");
  expect(pressed(MAC, { key: "b", code: "KeyB", ctrl: true })).toBe("MacCtrl-b");
});

test("a non-Latin layout falls back to the physical letter only with a modifier", () => {
  expect(pressed(LINUX, { key: "я", code: "KeyZ", ctrl: true })).toBe("Mod-z");
  expect(pressed(LINUX, { key: "Я", code: "KeyZ", ctrl: true, shift: true })).toBe("Mod-Shift-z");
  expect(pressed(MAC, { key: "я", code: "KeyZ", meta: true })).toBe("Mod-z");
  expect(pressed(LINUX, { key: "ॆ", code: "KeyZ", ctrl: true })).toBe("Mod-z");
  expect(pressed(LINUX, { key: "я", code: "KeyZ" })).toBe("я");
  expect(pressed(LINUX, { key: "Я", code: "KeyZ", shift: true })).toBe("Shift-я");
});

test("a Latin key wins over the physical one, and a non-letter stays as typed: Dvorak's ; on KeyZ", () => {
  expect(pressed(LINUX, { key: "z", code: "KeyY", ctrl: true })).toBe("Mod-z");
  expect(pressed(LINUX, { key: ";", code: "KeyZ", ctrl: true })).toBe("Mod-;");
  expect(pressed(MAC, { key: "≈", code: "KeyX", alt: true })).toBe("Alt-≈");
});

test("a shifted symbol carries no Shift, a shifted letter or named key does, and a space is Space", () => {
  expect(pressed(LINUX, { key: "?", code: "Slash", shift: true })).toBe("?");
  expect(pressed(LINUX, { key: ":", code: "Semicolon", ctrl: true, shift: true })).toBe("Mod-:");
  expect(pressed(LINUX, { key: "X", code: "KeyX", shift: true })).toBe("Shift-x");
  expect(pressed(LINUX, { key: "X", code: "KeyX" })).toBe("x");
  expect(pressed(LINUX, { key: "F3", code: "F3", shift: true })).toBe("Shift-F3");
  expect(pressed(LINUX, { key: " ", code: "Space" })).toBe("Space");
  expect(pressed(LINUX, { key: " ", code: "Space", shift: true })).toBe("Shift-Space");
});

test("bindingsOf: no entry keeps the defaults, an entry replaces them, [] leaves no key", () => {
  const { bindings, problems } = bindingsOf({
    apply: ["a"],
    undo: [],
    "some-later-action": ["Mod-q"],
  });

  expect(texts(bindings.apply)).toEqual(["a"]);
  expect(bindings.undo).toEqual([]);
  expect(texts(bindings.redo)).toEqual(["Mod-Shift-z", "Mod-y"]);
  expect(problems).toEqual([]);
  expect(bindingsOf({}).bindings).toEqual(DEFAULT_KEYS);
});

test("bindingsOf: a malformed key keeps that action's defaults and is reported", () => {
  const { bindings, problems } = bindingsOf({ redo: ["Mod-y", "Ctrl+Q"], find: ["Mod-g"] });

  expect(texts(bindings.redo)).toEqual(["Mod-Shift-z", "Mod-y"]);
  expect(texts(bindings.find)).toEqual(["Mod-g"]);
  expect(problems).toEqual([{ kind: "unreadable", action: "redo", text: "Ctrl+Q" }]);
});

test("bindingsOf: Shift before a symbol is unreadable, since no key press gives it", () => {
  const { bindings, problems } = bindingsOf({ apply: ["Shift-1"], find: ["Mod-Shift-?"] });

  expect(texts(bindings.apply)).toEqual(["Enter", "Space"]);
  expect(texts(bindings.find)).toEqual(["Mod-f"]);
  expect(problems).toEqual([
    { kind: "unreadable", action: "apply", text: "Shift-1" },
    { kind: "unreadable", action: "find", text: "Mod-Shift-?" },
  ]);
});

test("bindingsOf: a key on two actions stays with the first in list order and is reported", () => {
  const { bindings, problems } = bindingsOf({ indent: ["Mod-f"], "find-next": ["Enter"] });

  expect(texts(bindings.find)).toEqual(["Mod-f"]);
  expect(bindings.indent).toEqual([]);
  expect(texts(bindings.apply)).toEqual(["Enter", "Space"]);
  expect(bindings["find-next"]).toEqual([]);
  expect(problems).toEqual([
    { kind: "twice", key: key("Enter"), actions: ["apply", "find-next"] },
    { kind: "twice", key: key("Mod-f"), actions: ["find", "indent"] },
  ]);
});

test("bindingsOf: the same key twice in one entry counts once", () => {
  const { bindings, problems } = bindingsOf({ apply: ["a", "a"] });

  expect(texts(bindings.apply)).toEqual(["a"]);
  expect(problems).toEqual([]);
});
