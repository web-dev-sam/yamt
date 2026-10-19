import { useStorage, type Serializer, type StorageLike } from "@vueuse/core";
import type { Ref } from "vue";

import { log } from "../ipc";
import { unexpected } from "./problem";

export function parseStored(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storedValue<T>(
  key: string,
  fallback: T,
  serializer: Serializer<T>,
  warnEvent: string,
  storage?: StorageLike,
): Ref<T> {
  return useStorage<T>(key, fallback, storage, {
    serializer,
    flush: "sync",
    writeDefaults: false,
    onError: (error) => {
      log.warn(warnEvent, { ...unexpected(error) });
    },
  });
}
