import { expect, test } from "vitest";

import type { StoredSettings } from "./domain";
import { createFixtureSettings } from "./fixtureSettings";

const DEFAULT_PATH = "/fixture/settings.json";
const IN_USE: StoredSettings = { theme: "dark", antialiasing: "subpixel", keys: { apply: ["a"] } };
const LIGHT: StoredSettings = { theme: "light", antialiasing: "subpixel", keys: {} };

test("the first load creates the file from the settings in use; later loads read the file", async () => {
  const settings = createFixtureSettings();

  expect(await settings.loadSettings(IN_USE)).toEqual({
    ok: true,
    value: { path: DEFAULT_PATH, defaultPath: DEFAULT_PATH, stored: IN_USE },
  });
  expect(await settings.loadSettings(LIGHT)).toEqual({
    ok: true,
    value: { path: DEFAULT_PATH, defaultPath: DEFAULT_PATH, stored: IN_USE },
  });
});

test("setTheme replaces the theme and keeps the keys and unknown actions", async () => {
  const settings = createFixtureSettings();
  await settings.loadSettings({
    theme: "dark",
    antialiasing: "greyscale",
    keys: { "later-action": ["Mod-q"] },
  });

  const read = await settings.setTheme(
    { theme: "dark", antialiasing: "greyscale", keys: {} },
    "light",
  );

  expect(read).toEqual({
    ok: true,
    value: {
      path: DEFAULT_PATH,
      defaultPath: DEFAULT_PATH,
      stored: { theme: "light", antialiasing: "greyscale", keys: { "later-action": ["Mod-q"] } },
    },
  });
});

test("setAntialiasing replaces the antialiasing, keeps the rest, and the next load reads it", async () => {
  const settings = createFixtureSettings();
  await settings.loadSettings({ ...LIGHT, keys: { "later-action": ["Mod-q"] } });

  const read = await settings.setAntialiasing(LIGHT, "greyscale");
  const load = await settings.loadSettings(IN_USE);

  const stored = { theme: "light", antialiasing: "greyscale", keys: { "later-action": ["Mod-q"] } };
  expect(read).toEqual({
    ok: true,
    value: { path: DEFAULT_PATH, defaultPath: DEFAULT_PATH, stored },
  });
  expect(load).toEqual(read);
});

test("setKeys sets an entry with a list, removes it with null, and leaves the others", async () => {
  const settings = createFixtureSettings();
  await settings.loadSettings({
    theme: "dark",
    antialiasing: "subpixel",
    keys: { apply: ["a"], undo: ["Alt-Backspace"] },
  });

  const read = await settings.setKeys(IN_USE, [
    { action: "apply", keys: null },
    { action: "find", keys: [] },
    { action: "redo", keys: ["Mod-y"] },
  ]);

  expect(read.ok && read.value.stored.keys).toEqual({
    undo: ["Alt-Backspace"],
    find: [],
    redo: ["Mod-y"],
  });
});

test("a change before any load creates the file from the settings in use", async () => {
  const settings = createFixtureSettings();

  const read = await settings.setTheme(IN_USE, "light");

  expect(read.ok && read.value.stored).toEqual({
    theme: "light",
    antialiasing: "subpixel",
    keys: { apply: ["a"] },
  });
});

test("a reply is a copy: changing it changes nothing stored", async () => {
  const settings = createFixtureSettings();
  const first = await settings.loadSettings(IN_USE);
  if (first.ok) {
    first.value.stored.keys["apply"]?.push("b");
  }

  const again = await settings.loadSettings(IN_USE);

  expect(again.ok && again.value.stored.keys).toEqual({ apply: ["a"] });
});

test("moving to an unknown path creates it from the settings in use, a known one is used", async () => {
  const settings = createFixtureSettings();
  await settings.loadSettings(IN_USE);

  const created = await settings.moveSettings(LIGHT, "/elsewhere.json");
  await settings.setTheme(LIGHT, "dark");
  const back = await settings.moveSettings(LIGHT, DEFAULT_PATH);
  const again = await settings.moveSettings(LIGHT, "/elsewhere.json");

  expect(created).toEqual({
    ok: true,
    value: { path: "/elsewhere.json", defaultPath: DEFAULT_PATH, stored: LIGHT },
  });
  expect(back.ok && back.value.stored).toEqual(IN_USE);
  expect(again.ok && again.value.stored).toEqual({ ...LIGHT, theme: "dark" });
});

test("a move to ~/ goes below the fixture home; a relative path is refused and nothing moves", async () => {
  const settings = createFixtureSettings();

  const home = await settings.moveSettings(IN_USE, "~/yamt.json");
  const refused = await settings.moveSettings(IN_USE, "yamt.json");
  const load = await settings.loadSettings(IN_USE);

  expect(home.ok && home.value.path).toBe("/fixture/home/yamt.json");
  expect(refused).toEqual({ ok: false, failure: { kind: "NotAbsolute", path: "yamt.json" } });
  expect(load.ok && load.value.path).toBe("/fixture/home/yamt.json");
});
