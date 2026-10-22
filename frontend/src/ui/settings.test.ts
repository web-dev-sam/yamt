import { afterEach, expect, test, vi } from "vitest";
import { shallowRef, type ShallowRef } from "vue";

import type {
  LanguageServerSettings,
  SettingsRead,
  SettingsSource,
  SourceFailure,
  SourceResult,
  StoredSettings,
} from "../ipc";
import type { Reply } from "./asking";
import type { Problem } from "./problem";
import {
  settingsActions,
  showsAntialiasing,
  startSettings,
  type SettingsActions,
  type SettingsInUse,
} from "./settings";

type Target = {
  readonly settings: ShallowRef<SettingsInUse>;
  readonly problem: ShallowRef<Problem | null>;
};

const PATH = "/home/me/.config/yamt/settings.json";
const ROOT = "/home/me/yamt";
const NO_SERVERS: LanguageServerSettings = { repositories: {}, off: {}, added: [] };
const OXLINT = { command: ["oxlint", "--lsp"], fileTypes: ["ts", "vue"] };
const SERVERS: LanguageServerSettings = {
  repositories: { [ROOT]: "start" },
  off: {},
  added: [OXLINT],
};
const OXFMT_KEY = "oxfmt (repository root)";
const OFF: LanguageServerSettings = { ...SERVERS, off: { [ROOT]: [OXFMT_KEY] } };
const BROKEN: SourceFailure = { kind: "SettingsBroken", path: PATH, message: "x at line 3" };

afterEach(() => {
  vi.restoreAllMocks();
});

function read(stored: StoredSettings): SourceResult<SettingsRead> {
  return { ok: true, value: { path: PATH, defaultPath: PATH, stored } };
}

function settingsTarget(loads: StoredSettings[]): {
  actions: SettingsActions;
  target: Target;
  sent: unknown[][];
} {
  const sent: unknown[][] = [];
  const source: SettingsSource = {
    loadSettings: async (current) => {
      sent.push(["loadSettings", current]);
      return read(loads.shift() ?? current);
    },
    setTheme: async (current, theme) => {
      sent.push(["setTheme", current, theme]);
      return read({ ...current, theme });
    },
    setAntialiasing: async () => read(startStored()),
    setKeys: async () => read(startStored()),
    moveSettings: async () => read(startStored()),
    setServerSwitch: async (current, server, on) => {
      sent.push(["setServerSwitch", current, server, on]);
      const off = on ? {} : { [ROOT]: [server] };
      return read({ ...current, languageServers: { ...current.languageServers, off } });
    },
    setServerAnswer: async (current, answer) => {
      sent.push(["setServerAnswer", current, answer]);
      return answer === "dontStart"
        ? { ok: false, failure: BROKEN }
        : read({ ...current, languageServers: { ...SERVERS, repositories: {} } });
    },
    setAddedServers: async (current, added) => {
      sent.push(["setAddedServers", current, added]);
      return read({
        ...current,
        languageServers: { ...current.languageServers, added: [...added] },
      });
    },
  };
  const target = {
    source,
    settings: shallowRef(startSettings("dark")),
    problem: shallowRef<Problem | null>(null),
    asking: { ask: async (): Promise<Reply> => "no" },
    latestSettings: 0,
  };
  return { actions: settingsActions(target), target, sent };
}

function startStored(): StoredSettings {
  return { theme: "dark", antialiasing: "subpixel", keys: {}, languageServers: NO_SERVERS };
}

test("antialiasing is shown on Linux platforms only", () => {
  expect(showsAntialiasing("Linux x86_64")).toBe(true);
  expect(showsAntialiasing("MacIntel")).toBe(false);
  expect(showsAntialiasing("Win32")).toBe(false);
});

test("before any read the servers entry is empty, and the first load sends it so", async () => {
  const { actions, target, sent } = settingsTarget([]);

  expect(target.settings.value.languageServers).toEqual(NO_SERVERS);

  await actions.loadSettings();

  expect(sent).toEqual([["loadSettings", startStored()]]);
  expect(target.settings.value.languageServers).toEqual(NO_SERVERS);
});

test("a loaded servers entry is in use and survives a theme change, sent back in current", async () => {
  const { actions, target, sent } = settingsTarget([
    { ...startStored(), languageServers: SERVERS },
  ]);

  await actions.loadSettings();
  await actions.setTheme("light");

  expect(sent[1]).toEqual(["setTheme", { ...startStored(), languageServers: SERVERS }, "light"]);
  expect(target.settings.value.theme).toBe("light");
  expect(target.settings.value.languageServers).toEqual(SERVERS);
});

test("setServerAnswer and setAddedServers send the settings in use and adopt the reply", async () => {
  const { actions, target, sent } = settingsTarget([
    { ...startStored(), languageServers: SERVERS },
  ]);
  await actions.loadSettings();

  await actions.setServerAnswer(null);
  expect(sent[1]).toEqual([
    "setServerAnswer",
    { ...startStored(), languageServers: SERVERS },
    null,
  ]);
  expect(target.settings.value.languageServers).toEqual({ ...SERVERS, repositories: {} });

  await actions.setAddedServers([]);
  expect(sent[2]).toEqual([
    "setAddedServers",
    { ...startStored(), languageServers: { ...SERVERS, repositories: {} } },
    [],
  ]);
  expect(target.settings.value.languageServers).toEqual(NO_SERVERS);
});

test("setServerSwitch sends the settings in use, the key and on, and adopts the reply", async () => {
  const { actions, target, sent } = settingsTarget([
    { ...startStored(), languageServers: SERVERS },
  ]);
  await actions.loadSettings();

  await actions.setServerSwitch(OXFMT_KEY, false);
  expect(sent[1]).toEqual([
    "setServerSwitch",
    { ...startStored(), languageServers: SERVERS },
    OXFMT_KEY,
    false,
  ]);
  expect(target.settings.value.languageServers).toEqual(OFF);

  await actions.setServerSwitch(OXFMT_KEY, true);
  expect(sent[2]).toEqual([
    "setServerSwitch",
    { ...startStored(), languageServers: OFF },
    OXFMT_KEY,
    true,
  ]);
  expect(target.settings.value.languageServers).toEqual({ ...SERVERS, off: {} });
});

test("a failed server answer is reported as a settings problem and keeps the settings", async () => {
  vi.spyOn(console, "error").mockReturnValue();
  vi.spyOn(console, "warn").mockReturnValue();
  const { actions, target } = settingsTarget([]);
  await actions.loadSettings();
  const inUse = target.settings.value;

  await actions.setServerAnswer("dontStart");

  expect(target.problem.value).toEqual({ action: "settings", cause: BROKEN });
  expect(target.settings.value).toBe(inUse);
});

test.each<[string, LanguageServerSettings]>([
  ["an answer", { ...SERVERS, repositories: {} }],
  ["another answer", { ...SERVERS, repositories: { [ROOT]: "dontStart" } }],
  ["one more answer", { ...SERVERS, repositories: { [ROOT]: "start", "/other": "start" } }],
  ["an answer for another root", { ...SERVERS, repositories: { "/other": "start" } }],
  ["one server fewer", { ...SERVERS, added: [] }],
  ["one server more", { ...SERVERS, added: [OXLINT, OXLINT] }],
  ["a shorter command", { ...SERVERS, added: [{ ...OXLINT, command: ["oxlint"] }] }],
  ["a command word", { ...SERVERS, added: [{ ...OXLINT, command: ["oxlint", "--stdio"] }] }],
  ["a longer command", { ...SERVERS, added: [{ ...OXLINT, command: ["oxlint", "--lsp", "-v"] }] }],
  ["fewer file types", { ...SERVERS, added: [{ ...OXLINT, fileTypes: ["ts"] }] }],
  ["a file type", { ...SERVERS, added: [{ ...OXLINT, fileTypes: ["ts", "tsx"] }] }],
])("a load whose only difference is %s is adopted", async (_difference, changed) => {
  const { actions, target } = settingsTarget([
    { ...startStored(), languageServers: SERVERS },
    { ...startStored(), languageServers: changed },
  ]);
  await actions.loadSettings();

  await actions.loadSettings();

  expect(target.settings.value.languageServers).toEqual(changed);
});

test.each<[string, LanguageServerSettings]>([
  ["no server switched off", SERVERS],
  ["another server switched off", { ...OFF, off: { [ROOT]: ["oxlint (repository root)"] } }],
  ["one more server switched off", { ...OFF, off: { [ROOT]: [OXFMT_KEY, "oxlint (web)"] } }],
  ["a server switched off under another root", { ...OFF, off: { "/other": [OXFMT_KEY] } }],
  ["one more root with servers switched off", { ...OFF, off: { ...OFF.off, "/other": [] } }],
])("a load that differs only in off (%s) is adopted", async (_difference, changed) => {
  const { actions, target } = settingsTarget([
    { ...startStored(), languageServers: OFF },
    { ...startStored(), languageServers: changed },
  ]);
  await actions.loadSettings();

  await actions.loadSettings();

  expect(target.settings.value.languageServers).toEqual(changed);
});

test("a load whose only difference is the action a key belongs to is adopted", async () => {
  const { actions, target } = settingsTarget([
    { ...startStored(), keys: { undo: ["Alt-U"] } },
    { ...startStored(), keys: { redo: ["Alt-U"] } },
  ]);
  await actions.loadSettings();

  await actions.loadSettings();

  expect(target.settings.value.read?.stored.keys).toEqual({ redo: ["Alt-U"] });
});

test("a load of the same servers entry keeps the settings in use", async () => {
  const { actions, target } = settingsTarget([
    { ...startStored(), languageServers: structuredClone(OFF) },
    { ...startStored(), languageServers: structuredClone(OFF) },
  ]);
  await actions.loadSettings();
  const inUse = target.settings.value;

  await actions.loadSettings();

  expect(target.settings.value).toBe(inUse);
});
