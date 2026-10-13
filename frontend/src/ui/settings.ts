import type { ShallowRef } from "vue";

import {
  bindingsOf,
  KEY_ACTIONS,
  keyText,
  type ChunkSource,
  type Key,
  type KeyAction,
  type KeyProblem,
  type KeysRead,
  type SettingsRead,
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
  readonly keys: KeysRead;
};

type SettingsTarget = {
  readonly source: ChunkSource;
  readonly settings: ShallowRef<SettingsInUse>;
  readonly problem: ShallowRef<Problem | null>;
  readonly asking: Pick<Asking, "ask">;
  latestSettings: number;
};

export type SettingsActions = {
  loadSettings(): Promise<void>;
  setTheme(theme: Theme): Promise<void>;
  addKey(action: KeyAction, key: Key): Promise<void>;
  changeKey(action: KeyAction, from: Key, to: Key): Promise<void>;
  removeKey(action: KeyAction, key: Key): Promise<void>;
  removeAllKeys(action: KeyAction): Promise<void>;
  resetKeys(action: KeyAction): Promise<void>;
  moveSettings(path: string): Promise<void>;
};

type Send = (current: StoredSettings) => Promise<SourceResult<SettingsRead>>;

export function startSettings(theme: Theme): SettingsInUse {
  return { read: null, theme, keys: bindingsOf({}) };
}

export function preferencesOf({ theme, keys }: SettingsInUse): Preferences {
  return { theme, keys: keys.bindings };
}

function storedSettings({ theme, keys }: SettingsInUse): StoredSettings {
  const changed = KEY_ACTIONS.filter((action) => !isDefault(action, keys.bindings[action]));
  return {
    theme,
    keys: Object.fromEntries(changed.map((action) => [action, keys.bindings[action].map(keyText)])),
  };
}

function sameTexts(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((text, index) => text === b[index]);
}

function sameStored(inUse: SettingsRead | null, read: SettingsRead): boolean {
  if (inUse === null || inUse.path !== read.path || inUse.stored.theme !== read.stored.theme) {
    return false;
  }
  const before = Object.entries(inUse.stored.keys);
  const after = read.stored.keys;
  return (
    before.length === Object.keys(after).length &&
    before.every(([action, texts]) => {
      const now = after[action];
      return now !== undefined && sameTexts(texts, now);
    })
  );
}

function problemKey(problem: KeyProblem): string {
  return problem.kind === "unreadable"
    ? `unreadable ${problem.action} ${problem.text}`
    : `twice ${keyText(problem.key)} ${problem.actions.join(" ")}`;
}

function showKeyProblems(target: SettingsTarget, read: SettingsRead, before: KeysRead): void {
  const { problems } = target.settings.value.keys;
  const shown = target.problem.value;
  const settingsShown = shown?.action === "settings" ? shown.cause.kind : null;
  if (problems.length === 0) {
    if (settingsShown !== null) {
      target.problem.value = null;
    }
    return;
  }
  const sameProblems = sameTexts(before.problems.map(problemKey), problems.map(problemKey));
  if (!sameProblems || (settingsShown !== null && settingsShown !== "Keys")) {
    report(target, { action: "settings", cause: { kind: "Keys", path: read.path, problems } });
  }
}

function adopt(target: SettingsTarget, read: SettingsRead): void {
  const before = target.settings.value;
  if (!sameStored(before.read, read)) {
    target.settings.value = { read, theme: read.stored.theme, keys: bindingsOf(read.stored.keys) };
  }
  showKeyProblems(target, read, before.keys);
}

async function send(target: SettingsTarget, call: Send): Promise<void> {
  target.latestSettings += 1;
  const ticket = target.latestSettings;
  const current = storedSettings(target.settings.value);
  const outcome = await attempt(() => call(current));
  const latest = ticket === target.latestSettings;
  if (!outcome.ok) {
    const failure: Problem = { action: "settings", cause: outcome.cause };
    logProblem(failure);
    if (latest) {
      target.problem.value = failure;
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
  if (plan.kind === "ask" && !(await target.asking.ask({ kind: "clash", ...plan.clash }))) {
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
    addKey: (action, key) => editKeys(target, { kind: "add", action, key }),
    changeKey: (action, from, to) => editKeys(target, { kind: "change", action, from, to }),
    removeKey: (action, key) => editKeys(target, { kind: "remove", action, key }),
    removeAllKeys: (action) => editKeys(target, { kind: "removeAll", action }),
    resetKeys: (action) => editKeys(target, { kind: "reset", action }),
    moveSettings: (path) => send(target, (current) => source.moveSettings(current, path)),
  };
}
