import type { StorageLike } from "@vueuse/core";
import { computed, type Ref } from "vue";

import type { ServerKey } from "../lsp";
import { storedValue } from "./windowStorage";

export type ServerPins = {
  readonly pinnedServers: Readonly<Ref<ReadonlySet<string>>>;
  togglePin(key: ServerKey): void;
};

type PinsByRoot = Readonly<Record<string, unknown>>;

const STORAGE_KEY = "yamt.servers.pinned";

function readPins(raw: string): PinsByRoot {
  try {
    const stored: unknown = JSON.parse(raw);
    return typeof stored === "object" && stored !== null && !Array.isArray(stored)
      ? { ...stored }
      : {};
  } catch {
    return {};
  }
}

function pinsOf(byRoot: PinsByRoot, root: string): readonly string[] {
  const keys = byRoot[root];
  if (!Array.isArray(keys)) {
    return [];
  }
  const items: readonly unknown[] = keys;
  return items.every((key): key is string => typeof key === "string") ? items : [];
}

export function createServerPins(
  root: Readonly<Ref<string | null>>,
  storage?: StorageLike,
): ServerPins {
  const byRoot = storedValue<PinsByRoot>(
    STORAGE_KEY,
    {},
    { read: readPins, write: (value) => JSON.stringify(value) },
    "servers.pins_storage_failed",
    storage,
  );
  const pinnedServers = computed(
    (): ReadonlySet<string> => new Set(root.value === null ? [] : pinsOf(byRoot.value, root.value)),
  );
  return {
    pinnedServers,
    togglePin: (key) => {
      const at = root.value;
      if (at === null) {
        return;
      }
      const before = pinsOf(byRoot.value, at);
      const after = before.includes(key) ? before.filter((pin) => pin !== key) : [...before, key];
      const others = Object.fromEntries(
        Object.entries(byRoot.value).filter(([other]) => other !== at),
      );
      byRoot.value = after.length === 0 ? others : { ...others, [at]: after };
    },
  };
}
