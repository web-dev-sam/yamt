import { useStorage, type StorageLike } from "@vueuse/core";
import type { Ref } from "vue";

import { log } from "../ipc";
import { unexpected } from "./problem";

export type FileListMode = "list" | "tree";

const STORAGE_KEY = "yamt.files.view";

export function createFileListMode(storage?: StorageLike): {
  readonly mode: Readonly<Ref<FileListMode>>;
  toggle(): void;
} {
  const mode = useStorage<FileListMode>(STORAGE_KEY, "list", storage, {
    serializer: { read: (raw) => (raw === "tree" ? "tree" : "list"), write: (value) => value },
    flush: "sync",
    writeDefaults: false,
    onError: (error) => {
      log.warn("files.view_storage_failed", { ...unexpected(error) });
    },
  });
  return {
    mode,
    toggle: () => {
      mode.value = mode.value === "list" ? "tree" : "list";
    },
  };
}
