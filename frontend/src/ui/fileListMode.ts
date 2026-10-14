import type { StorageLike } from "@vueuse/core";
import type { Ref } from "vue";

import { storedValue } from "./windowStorage";

export type FileListMode = "list" | "tree";

const STORAGE_KEY = "yamt.files.view";

export function createFileListMode(storage?: StorageLike): {
  readonly mode: Readonly<Ref<FileListMode>>;
  toggle(): void;
} {
  const mode = storedValue<FileListMode>(
    STORAGE_KEY,
    "list",
    { read: (raw) => (raw === "tree" ? "tree" : "list"), write: (value) => value },
    "files.view_storage_failed",
    storage,
  );
  return {
    mode,
    toggle: () => {
      mode.value = mode.value === "list" ? "tree" : "list";
    },
  };
}
