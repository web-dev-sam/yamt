import type { StorageLike } from "@vueuse/core";
import { computed, type Ref } from "vue";

import type { ServerKey } from "../lsp";
import { storedRecord } from "./windowStorage";

export type ServerPins = {
  readonly pinnedServers: Readonly<Ref<ReadonlySet<string>>>;
  togglePin(key: ServerKey): void;
};

const STORAGE_KEY = "yamt.servers.pinned";

function pinsOf(entry: unknown): readonly string[] {
  if (!Array.isArray(entry)) {
    return [];
  }
  const items: readonly unknown[] = entry;
  return items.every((key): key is string => typeof key === "string") ? items : [];
}

export function createServerPins(
  root: Readonly<Ref<string | null>>,
  storage?: StorageLike,
): ServerPins {
  const byRoot = storedRecord(STORAGE_KEY, "servers.pins_storage_failed", storage);
  const pinnedServers = computed(
    (): ReadonlySet<string> =>
      new Set(root.value === null ? [] : pinsOf(byRoot.entryAt(root.value))),
  );
  return {
    pinnedServers,
    togglePin: (key) => {
      const at = root.value;
      if (at === null) {
        return;
      }
      const before = pinsOf(byRoot.entryAt(at));
      const after = before.includes(key) ? before.filter((pin) => pin !== key) : [...before, key];
      if (after.length === 0) {
        byRoot.remove(at);
      } else {
        byRoot.set(at, after);
      }
    },
  };
}
