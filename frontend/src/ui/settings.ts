import type { ShallowRef } from "vue";

import {
  bindingsOf,
  KEY_ACTIONS,
  keyText,
  type AddedServer,
  type Antialiasing,
  type Key,
  type KeyAction,
  type KeyProblem,
  type KeysRead,
  type LanguageServerSettings,
  type RepositoryAnswer,
  type SettingsRead,
  type SettingsSource,
  type SourceResult,
  type StoredSettings,
  type Theme,
} from "../ipc";
import type { Asking } from "./asking";
import { isDefault, planKeyEdit, type KeyEdit } from "./keymapEdit";
import { attempt, logProblem, report, type Problem } from "./problem";
import type { Preferences } from "./useMergeController";

export type SettingsInUse = {
  readonly read: SettingsRead | null;
  readonly theme: Theme;
  readonly antialiasing: Antialiasing;
  readonly keys: KeysRead;
  readonly languageServers: LanguageServerSettings;
};

type SettingsTarget = {
  readonly source: SettingsSource;
  readonly settings: ShallowRef<SettingsInUse>;
  readonly problem: ShallowRef<Problem | null>;
  readonly asking: Pick<Asking, "ask">;
  latestSettings: number;
};

export type SettingsActions = {
  loadSettings(): Promise<void>;
  setTheme(theme: Theme): Promise<void>;
  setAntialiasing(antialiasing: Antialiasing): Promise<void>;
  addKey(action: KeyAction, key: Key): Promise<void>;
  changeKey(action: KeyAction, from: Key, to: Key): Promise<void>;
  removeKey(action: KeyAction, key: Key): Promise<void>;
  removeAllKeys(action: KeyAction): Promise<void>;
  resetKeys(action: KeyAction): Promise<void>;
  moveSettings(path: string): Promise<void>;
  setServerAnswer(answer: RepositoryAnswer | null): Promise<void>;
  setAddedServers(added: readonly AddedServer[]): Promise<void>;
};

type Send = (current: StoredSettings) => Promise<SourceResult<SettingsRead>>;

export function startSettings(theme: Theme): SettingsInUse {
  return {
    read: null,
    theme,
    antialiasing: "subpixel",
    keys: bindingsOf({}),
    languageServers: { repositories: {}, added: [] },
  };
}

export function preferencesOf({ theme, keys }: SettingsInUse): Preferences {
  return { theme, keys: keys.bindings };
}

export function showsAntialiasing(platform: string): boolean {
  return platform.startsWith("Linux");
}

function storedSettings({
  theme,
  antialiasing,
  keys,
  languageServers,
}: SettingsInUse): StoredSettings {
  const changed = KEY_ACTIONS.filter((action) => !isDefault(action, keys.bindings[action]));
  return {
    theme,
    antialiasing,
    keys: Object.fromEntries(changed.map((action) => [action, keys.bindings[action].map(keyText)])),
    languageServers,
  };
}

function sameTexts(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((text, index) => text === b[index]);
}

function sameAdded(a: AddedServer, b: AddedServer): boolean {
  const { command, fileTypes, ...rest } = a;
  rest satisfies Record<string, never>;
  return sameTexts(command, b.command) && sameTexts(fileTypes, b.fileTypes);
}

function sameServers(a: LanguageServerSettings, b: LanguageServerSettings): boolean {
  const { repositories, off = {}, added, ...rest } = a;
  rest satisfies Record<string, never>;
  const answers = Object.entries(repositories);
  const offRoots = Object.entries(off);
  const otherOff = b.off ?? {};
  return (
    answers.length === Object.keys(b.repositories).length &&
    answers.every(([root, answer]) => b.repositories[root] === answer) &&
    offRoots.length === Object.keys(otherOff).length &&
    offRoots.every(([root, keys]) => {
      const other = otherOff[root];
      return other !== undefined && sameTexts(keys, other);
    }) &&
    added.length === b.added.length &&
    added.every((server, index) => {
      const other = b.added[index];
      return other !== undefined && sameAdded(server, other);
    })
  );
}

function sameKeys(before: StoredSettings["keys"], after: StoredSettings["keys"]): boolean {
  const entries = Object.entries(before);
  return (
    entries.length === Object.keys(after).length &&
    entries.every(([action, texts]) => {
      const now = after[action];
      return now !== undefined && sameTexts(texts, now);
    })
  );
}

function sameStored(inUse: SettingsRead | null, read: SettingsRead): boolean {
  if (inUse === null || inUse.path !== read.path) {
    return false;
  }
  const { theme, antialiasing, keys, languageServers, ...rest } = read.stored;
  rest satisfies Record<string, never>;
  const before = inUse.stored;
  return (
    theme === before.theme &&
    antialiasing === before.antialiasing &&
    sameServers(before.languageServers, languageServers) &&
    sameKeys(before.keys, keys)
  );
}

function problemKey(problem: KeyProblem): string {
  return problem.kind === "unreadable"
    ? `unreadable ${problem.action} ${problem.text}`
    : `twice ${keyText(problem.key)} ${problem.actions.join(" ")}`;
}

function showKeyProblems(target: SettingsTarget, read: SettingsRead, before: SettingsInUse): void {
  const { problems } = target.settings.value.keys;
  const shown = target.problem.value;
  const settingsShown = shown?.action === "settings" ? shown.cause.kind : null;
  if (problems.length === 0) {
    if (settingsShown !== null) {
      target.problem.value = null;
    }
    return;
  }
  const sameProblems =
    before.read?.path === read.path &&
    sameTexts(before.keys.problems.map(problemKey), problems.map(problemKey));
  if (!sameProblems || (settingsShown !== null && settingsShown !== "Keys")) {
    report(target, { action: "settings", cause: { kind: "Keys", path: read.path, problems } });
  }
}

function adopt(target: SettingsTarget, read: SettingsRead): void {
  const before = target.settings.value;
  if (!sameStored(before.read, read)) {
    const { theme, antialiasing, keys, languageServers } = read.stored;
    target.settings.value = { read, theme, antialiasing, keys: bindingsOf(keys), languageServers };
  }
  showKeyProblems(target, read, before);
}

async function send(target: SettingsTarget, call: Send): Promise<void> {
  target.latestSettings += 1;
  const ticket = target.latestSettings;
  const current = storedSettings(target.settings.value);
  const outcome = await attempt(() => call(current));
  const latest = ticket === target.latestSettings;
  if (!outcome.ok) {
    const failure: Problem = { action: "settings", cause: outcome.cause };
    if (latest) {
      report(target, failure);
    } else {
      logProblem(failure);
    }
    return;
  }
  if (latest) {
    adopt(target, outcome.value);
  }
}

async function editKeys(target: SettingsTarget, edit: KeyEdit): Promise<void> {
  const plan = planKeyEdit(target.settings.value.keys.bindings, edit);
  if (plan.kind === "nothing") {
    return;
  }
  if (
    plan.kind === "ask" &&
    (await target.asking.ask({ kind: "clash", ...plan.clash })) !== "yes"
  ) {
    return;
  }
  const replanned = planKeyEdit(target.settings.value.keys.bindings, edit);
  if (replanned.kind === "nothing") {
    return;
  }
  await send(target, (current) => target.source.setKeys(current, replanned.changes));
}

export function settingsActions(target: SettingsTarget): SettingsActions {
  const { source } = target;
  return {
    loadSettings: () => send(target, (current) => source.loadSettings(current)),
    setTheme: (theme) => send(target, (current) => source.setTheme(current, theme)),
    setAntialiasing: (antialiasing) =>
      send(target, (current) => source.setAntialiasing(current, antialiasing)),
    addKey: (action, key) => editKeys(target, { kind: "add", action, key }),
    changeKey: (action, from, to) => editKeys(target, { kind: "change", action, from, to }),
    removeKey: (action, key) => editKeys(target, { kind: "remove", action, key }),
    removeAllKeys: (action) => editKeys(target, { kind: "removeAll", action }),
    resetKeys: (action) => editKeys(target, { kind: "reset", action }),
    moveSettings: (path) => send(target, (current) => source.moveSettings(current, path)),
    setServerAnswer: (answer) => send(target, (current) => source.setServerAnswer(current, answer)),
    setAddedServers: (added) => send(target, (current) => source.setAddedServers(current, added)),
  };
}
