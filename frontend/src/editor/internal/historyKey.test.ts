import { expect, test } from "vitest";

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

function command(platform: string, press: Press): "undo" | "redo" | null {
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
  );
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

test("a Latin key wins over the physical key: QWERTZ Ctrl+Z undoes, Ctrl+Y redoes", () => {
  expect(command(LINUX, { key: "z", code: "KeyY", ctrl: true })).toBe("undo");
  expect(command(LINUX, { key: "y", code: "KeyZ", ctrl: true })).toBe("redo");
});
