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

export type StoredRecord = {
  entryAt(at: string): unknown;
  set(at: string, entry: unknown): void;
  remove(at: string): void;
};

type Entries = Readonly<Record<string, unknown>>;

function readEntries(raw: string): Entries {
  const stored = parseStored(raw);
  return typeof stored === "object" && stored !== null && !Array.isArray(stored)
    ? { ...stored }
    : {};
}

function without(entries: Entries, at: string): Entries {
  return Object.fromEntries(Object.entries(entries).filter(([other]) => other !== at));
}

export function storedRecord(key: string, warnEvent: string, storage?: StorageLike): StoredRecord {
  const entries = storedValue<Entries>(
    key,
    {},
    { read: readEntries, write: (value) => JSON.stringify(value) },
    warnEvent,
    storage,
  );
  return {
    entryAt: (at) => entries.value[at],
    set: (at, entry) => {
      entries.value = { ...without(entries.value, at), [at]: entry };
    },
    remove: (at) => {
      entries.value = without(entries.value, at);
    },
  };
}
