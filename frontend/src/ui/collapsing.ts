import { useStorage, type StorageLike } from "@vueuse/core";
import type { Ref } from "vue";

import { log } from "../ipc";
import { unexpected } from "./problem";

export type Collapsing = {
  readonly collapsing: Readonly<Ref<boolean>>;
  toggleCollapsing(): void;
};

const STORAGE_KEY = "yamt.collapse.unchanged";

export function createCollapsing(storage?: StorageLike): Collapsing {
  const collapsing = useStorage<boolean>(STORAGE_KEY, true, storage, {
    serializer: { read: (raw) => raw !== "false", write: (on) => String(on) },
    flush: "sync",
    writeDefaults: false,
    onError: (error) => {
      log.warn("collapse.storage_failed", { ...unexpected(error) });
    },
  });
  return {
    collapsing,
    toggleCollapsing: () => {
      collapsing.value = !collapsing.value;
    },
  };
}
