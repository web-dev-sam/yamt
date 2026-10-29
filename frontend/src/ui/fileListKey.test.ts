import { expect, test } from "vitest";
import { shallowRef } from "vue";

import { bindingsOf, DEFAULT_KEYS, pressesKey } from "../ipc";
import { createAsking } from "./asking";
import { fileListKey, windowKey, type KeyPress } from "./fileListKey";
import { startSettings } from "./settings";

const LINUX = "Linux x86_64";
const MAC = "MacIntel";

type Held = {
  readonly ctrl?: boolean;
  readonly meta?: boolean;
  readonly shift?: boolean;
  readonly prevented?: boolean;
};

type FakePress = KeyPress & { readonly prevents: () => number };

function press(key: string, held: Held = {}): FakePress {
  let prevents = 0;
  return {
    key,
    code: `Key${key.toUpperCase()}`,
    ctrlKey: held.ctrl ?? false,
    metaKey: held.meta ?? false,
    altKey: false,
    shiftKey: held.shift ?? false,
    defaultPrevented: held.prevented ?? false,
    preventDefault: () => {
      prevents += 1;
    },
    prevents: () => prevents,
  };
}

function target(keys: Parameters<typeof bindingsOf>[0] = {}) {
  return {
    asking: createAsking(),
    settings: shallowRef({ ...startSettings("dark"), keys: bindingsOf(keys) }),
  };
}

test("Ctrl+Shift+S on Linux and ⌘⇧S on macOS are the search key, taken with preventDefault", () => {
  const linux = press("S", { ctrl: true, shift: true });
  const mac = press("S", { meta: true, shift: true });

  expect(windowKey(target(), "toggle-search", linux, LINUX)).toBe(true);
  expect(windowKey(target(), "toggle-search", mac, MAC)).toBe(true);
  expect([linux.prevents(), mac.prevents()]).toEqual([1, 1]);
});

test("a press another handler already took is not the window's", () => {
  const taken = press("S", { ctrl: true, shift: true, prevented: true });

  expect(windowKey(target(), "toggle-search", taken, LINUX)).toBe(false);
  expect(taken.prevents()).toBe(0);
});

test("while a question waits the search key does nothing; once answered it is taken again", async () => {
  const keys = target();
  const asked = keys.asking.ask({ kind: "deleteNote" });

  const waiting = press("S", { ctrl: true, shift: true });
  expect(windowKey(keys, "toggle-search", waiting, LINUX)).toBe(false);
  expect(waiting.prevents()).toBe(0);

  keys.asking.answer(false);
  await asked;
  expect(windowKey(keys, "toggle-search", press("S", { ctrl: true, shift: true }), LINUX)).toBe(
    true,
  );
});

test("another action's key is not the search key, and the search key is not the file list's", () => {
  for (const other of [
    press("s", { ctrl: true }),
    press("b", { ctrl: true }),
    press("S", { shift: true }),
    press("f", { ctrl: true, shift: true }),
  ]) {
    expect(windowKey(target(), "toggle-search", other, LINUX)).toBe(false);
    expect(other.prevents()).toBe(0);
  }
  expect(
    windowKey(target(), "toggle-file-list", press("S", { ctrl: true, shift: true }), LINUX),
  ).toBe(false);
});

test("Ctrl+Shift+S never matches Save, and Ctrl+S never matches the search key", () => {
  const search = press("S", { ctrl: true, shift: true });
  const save = press("s", { ctrl: true });

  expect(pressesKey(search, DEFAULT_KEYS.save, LINUX)).toBe(false);
  expect(pressesKey(save, DEFAULT_KEYS["toggle-search"], LINUX)).toBe(false);
  expect(pressesKey(search, DEFAULT_KEYS["toggle-search"], LINUX)).toBe(true);
});

test("a re-bound search key is the one taken, and Ctrl+Shift+S is left alone", () => {
  const rebound = target({ "toggle-search": ["Mod-Shift-f"] });
  const old = press("S", { ctrl: true, shift: true });

  expect(windowKey(rebound, "toggle-search", old, LINUX)).toBe(false);
  expect(old.prevents()).toBe(0);
  expect(windowKey(rebound, "toggle-search", press("F", { ctrl: true, shift: true }), LINUX)).toBe(
    true,
  );
});

test("fileListKey flips the list only when the guard takes the press", () => {
  const keys = { ...target(), fileListShown: shallowRef(true) };

  fileListKey(keys, press("S", { ctrl: true, shift: true }), LINUX);
  expect(keys.fileListShown.value).toBe(true);

  fileListKey(keys, press("b", { ctrl: true }), LINUX);
  expect(keys.fileListShown.value).toBe(false);
});
