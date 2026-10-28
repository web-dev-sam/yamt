import type { StorageLike } from "@vueuse/core";
import type { Ref } from "vue";

import { storedValue } from "./windowStorage";

export type Collapsing = {
  readonly collapsing: Readonly<Ref<boolean>>;
  toggleCollapsing(): void;
};

export const COLLAPSE_LABEL = "Collapse unchanged fragments";

const STORAGE_KEY = "yamt.collapse.unchanged";

export function createCollapsing(storage?: StorageLike): Collapsing {
  const collapsing = storedValue<boolean>(
    STORAGE_KEY,
    true,
    { read: (raw) => raw !== "false", write: (on) => String(on) },
    "collapse.storage_failed",
    storage,
  );
  return {
    collapsing,
    toggleCollapsing: () => {
      collapsing.value = !collapsing.value;
    },
  };
}
