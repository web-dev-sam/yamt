import type { SettingsSource } from "./ChunkSource";
import type { KeysChange, SettingsRead, SourceResult, StoredSettings } from "./domain";

type Files = { readonly stored: Map<string, StoredSettings>; inUse: string };

const DEFAULT_PATH = "/fixture/settings.json";
const HOME = "/fixture/home/";
const HOME_PREFIX = "~/";

function copied({ theme, antialiasing, keys }: StoredSettings): StoredSettings {
  return {
    theme,
    antialiasing,
    keys: Object.fromEntries(Object.entries(keys).map(([action, texts]) => [action, [...texts]])),
  };
}

function replied(path: string, stored: StoredSettings): SourceResult<SettingsRead> {
  return { ok: true, value: { path, defaultPath: DEFAULT_PATH, stored: copied(stored) } };
}

function readOrCreate(files: Files, path: string, current: StoredSettings): StoredSettings {
  const stored = files.stored.get(path) ?? copied(current);
  files.stored.set(path, stored);
  return stored;
}

function withKeys(
  keys: StoredSettings["keys"],
  changes: readonly KeysChange[],
): StoredSettings["keys"] {
  const changed = { ...keys };
  for (const { action, keys: texts } of changes) {
    if (texts === null) {
      delete changed[action];
    } else {
      changed[action] = [...texts];
    }
  }
  return changed;
}

function change(
  files: Files,
  current: StoredSettings,
  edit: (stored: StoredSettings) => StoredSettings,
): SourceResult<SettingsRead> {
  const stored = edit(files.stored.get(files.inUse) ?? copied(current));
  files.stored.set(files.inUse, stored);
  return replied(files.inUse, stored);
}

function expanded(path: string): string | null {
  if (path.startsWith(HOME_PREFIX)) {
    return `${HOME}${path.slice(HOME_PREFIX.length)}`;
  }
  return path.startsWith("/") ? path : null;
}

export function createFixtureSettings(): SettingsSource {
  const files: Files = { stored: new Map(), inUse: DEFAULT_PATH };
  return {
    async loadSettings(current) {
      return replied(files.inUse, readOrCreate(files, files.inUse, current));
    },
    async setTheme(current, theme) {
      return change(files, current, (stored) => ({ ...stored, theme }));
    },
    async setAntialiasing(current, antialiasing) {
      return change(files, current, (stored) => ({ ...stored, antialiasing }));
    },
    async setKeys(current, changes) {
      return change(files, current, (stored) => ({
        ...stored,
        keys: withKeys(stored.keys, changes),
      }));
    },
    async moveSettings(current, path) {
      const target = expanded(path);
      if (target === null) {
        return { ok: false, failure: { kind: "NotAbsolute", path } };
      }
      const stored = readOrCreate(files, target, current);
      files.inUse = target;
      return replied(target, stored);
    },
  };
}
