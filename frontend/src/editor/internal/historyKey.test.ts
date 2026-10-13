import { expect, test } from "vitest";

import { DEFAULT_KEYS, parseKey, type Key, type KeyBindings } from "../../ipc";
import { historyCommand } from "./historyKey";

const LINUX = "Linux x86_64";
const MAC = "MacIntel";

type Press = {
  key: string;
  code?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  prevented?: boolean;
  target?: EventTarget | null;
};

function command(
  platform: string,
  press: Press,
  keys: KeyBindings = DEFAULT_KEYS,
): "undo" | "redo" | null {
  return historyCommand(
    {
      key: press.key,
      code: press.code ?? "",
      ctrlKey: press.ctrl ?? false,
      metaKey: press.meta ?? false,
      shiftKey: press.shift ?? false,
      altKey: press.alt ?? false,
      defaultPrevented: press.prevented ?? false,
      target: press.target ?? null,
    },
    platform,
    keys,
  );
}

function key(text: string): Key {
  const parsed = parseKey(text);
  if (parsed === null) {
    throw new Error(`${text} does not parse`);
  }
  return parsed;
}

test("Linux: Ctrl+Z undoes, Ctrl+Shift+Z and Ctrl+Y redo, Meta+Z does nothing", () => {
  expect(command(LINUX, { key: "z", ctrl: true })).toBe("undo");
  expect(command(LINUX, { key: "Z", ctrl: true, shift: true })).toBe("redo");
  expect(command(LINUX, { key: "y", ctrl: true })).toBe("redo");
  expect(command(LINUX, { key: "z", meta: true })).toBeNull();
  expect(command(LINUX, { key: "z" })).toBeNull();
  expect(command(LINUX, { key: "a", ctrl: true })).toBeNull();
});

test("macOS: Cmd+Z undoes, Cmd+Shift+Z and Cmd+Y redo, Ctrl+Z does nothing", () => {
  expect(command(MAC, { key: "z", meta: true })).toBe("undo");
  expect(command(MAC, { key: "Z", meta: true, shift: true })).toBe("redo");
  expect(command(MAC, { key: "y", meta: true })).toBe("redo");
  expect(command(MAC, { key: "z", ctrl: true })).toBeNull();
});

test("Alt, a key someone already handled and a text field never undo here", () => {
  const field = Object.assign(new EventTarget(), { tagName: "INPUT" });
  const area = Object.assign(new EventTarget(), { tagName: "TEXTAREA" });
  const pane = Object.assign(new EventTarget(), { tagName: "DIV" });

  expect(command(LINUX, { key: "z", ctrl: true, alt: true })).toBeNull();
  expect(command(LINUX, { key: "z", ctrl: true, prevented: true })).toBeNull();
  expect(command(LINUX, { key: "z", ctrl: true, target: field })).toBeNull();
  expect(command(LINUX, { key: "y", ctrl: true, target: area })).toBeNull();
  expect(command(LINUX, { key: "z", ctrl: true, target: pane })).toBe("undo");
});

test("a non-Latin layout undoes and redoes by the physical key", () => {
  expect(command(LINUX, { key: "я", code: "KeyZ", ctrl: true })).toBe("undo");
  expect(command(LINUX, { key: "Я", code: "KeyZ", ctrl: true, shift: true })).toBe("redo");
  expect(command(LINUX, { key: "н", code: "KeyY", ctrl: true })).toBe("redo");
  expect(command(MAC, { key: "я", code: "KeyZ", meta: true })).toBe("undo");
  expect(command(LINUX, { key: "ф", code: "KeyA", ctrl: true })).toBeNull();
});

test("a layout whose physical Z types a vowel sign undoes by the physical key: Hindi InScript", () => {
  expect(command(LINUX, { key: "ॆ", code: "KeyZ", ctrl: true })).toBe("undo");
});

test("a Latin key wins over the physical key: QWERTZ Ctrl+Z undoes, Ctrl+Y redoes", () => {
  expect(command(LINUX, { key: "z", code: "KeyY", ctrl: true })).toBe("undo");
  expect(command(LINUX, { key: "y", code: "KeyZ", ctrl: true })).toBe("redo");
});

test("a Latin layout's non-letter on the physical Z or Y never undoes: Dvorak Ctrl+; does nothing", () => {
  expect(command(LINUX, { key: ";", code: "KeyZ", ctrl: true })).toBeNull();
  expect(command(LINUX, { key: ":", code: "KeyZ", ctrl: true, shift: true })).toBeNull();
  expect(command(LINUX, { key: "-", code: "KeyY", ctrl: true })).toBeNull();
});

test("a rebound Undo works window-wide by its new key only, also from a side pane, and Ctrl+Shift+Y redoes nothing", () => {
  const keys = { ...DEFAULT_KEYS, undo: [key("Alt-Backspace")] };
  const side = Object.assign(new EventTarget(), { tagName: "DIV" });

  expect(command(LINUX, { key: "Backspace", alt: true, target: side }, keys)).toBe("undo");
  expect(command(LINUX, { key: "z", ctrl: true }, keys)).toBeNull();
  expect(command(LINUX, { key: "Backspace" }, keys)).toBeNull();
  expect(command(LINUX, { key: "Y", ctrl: true, shift: true })).toBeNull();
});

test("a rebound Redo keeps the non-Latin fallback: Ctrl+Shift+я on a Russian layout redoes when Redo is Mod-Shift-z only", () => {
  const keys = { ...DEFAULT_KEYS, redo: [key("Mod-Shift-z")] };

  expect(command(LINUX, { key: "Я", code: "KeyZ", ctrl: true, shift: true }, keys)).toBe("redo");
  expect(command(LINUX, { key: "н", code: "KeyY", ctrl: true }, keys)).toBeNull();
});
