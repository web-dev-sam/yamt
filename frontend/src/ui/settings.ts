import type { ShallowRef } from "vue";

import {
  bindingsOf,
  KEY_ACTIONS,
  keyText,
  type ChunkSource,
  type Key,
  type KeyAction,
  type KeysRead,
  type SettingsRead,
  type SourceResult,
  type StoredSettings,
  type Theme,
} from "../ipc";
import type { Asking } from "./asking";
import { isDefault, planKeyEdit, type KeyEdit } from "./keymapEdit";
import { attempt, report, type Problem } from "./problem";
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

function use(target: SettingsTarget, read: SettingsRead): void {
  const keys = bindingsOf(read.stored.keys);
  target.settings.value = { read, theme: read.stored.theme, keys };
  if (keys.problems.length > 0) {
    const cause = {
      kind: "Keys",
      path: read.path,
      problems: keys.problems,
    } satisfies Problem["cause"];
    report(target, { action: "settings", cause });
  } else if (target.problem.value?.action === "settings") {
    target.problem.value = null;
  }
}

async function send(target: SettingsTarget, call: Send): Promise<void> {
  const current = storedSettings(target.settings.value);
  const outcome = await attempt(() => call(current));
  if (!outcome.ok) {
    report(target, { action: "settings", cause: outcome.cause });
    return;
  }
  use(target, outcome.value);
}

async function editKeys(target: SettingsTarget, edit: KeyEdit): Promise<void> {
  const plan = planKeyEdit(target.settings.value.keys.bindings, edit);
  if (plan.kind === "nothing") {
    return;
  }
  if (plan.kind === "ask" && !(await target.asking.ask({ kind: "clash", ...plan.clash }))) {
    return;
  }
  await send(target, (current) => target.source.setKeys(current, plan.changes));
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
